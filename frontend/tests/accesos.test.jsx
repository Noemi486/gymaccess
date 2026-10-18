import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor, configure } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

configure({ asyncUtilTimeout: 4000 });

function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

const completo = [
  {
    id_acceso: 5,
    fecha: '2026-10-15',
    hora: '18:40:10',
    tipo: 'entrada',
    resultado: 'rechazado',
    motivo_rechazo: 'Pago pendiente',
    cliente: { id_cliente: 9, nombre: 'Luis', apellido: 'Soto' },
  },
  {
    id_acceso: 4,
    fecha: '2026-10-15',
    hora: '07:15:00',
    tipo: 'entrada',
    resultado: 'autorizado',
    motivo_rechazo: null,
    cliente: { id_cliente: 7, nombre: 'Min', apellido: 'Cabrera' },
  },
  {
    id_acceso: 3,
    fecha: '2026-10-14',
    hora: '20:05:00',
    tipo: 'entrada',
    resultado: 'rechazado',
    motivo_rechazo: 'Rostro no reconocido',
    cliente: null,
  },
];
// Lo que recibe el entrenador: sin tipo ni motivo.
const basico = completo.map(({ tipo, motivo_rechazo, ...resto }) => resto);

// Abre /accesos con la cuenta del rol. `datos` es la respuesta del servidor; devuelve las URL pedidas.
function abrir(rol, datos = { data: completo, page: 1, limit: 20, total: 3 }) {
  const cuenta = { id_usuario: 9, nombre: 'Persona', correo: 'p@example.com', rol, estado: 'activo', id_cliente: null };
  sessionStorage.setItem('gym_token', 'token-de-prueba');
  sessionStorage.setItem('gym_usuario', JSON.stringify(cuenta));
  const pedidas = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      if (url === '/api/auth/me') return respuesta(200, cuenta);
      if (url.startsWith('/api/accesos')) {
        pedidas.push(url);
        return respuesta(200, typeof datos === 'function' ? datos(url) : datos);
      }
      return respuesta(404, { error: { code: 'NOT_FOUND', message: 'No existe.' } });
    }),
  );
  render(
    <MemoryRouter initialEntries={['/accesos']}>
      <App />
    </MemoryRouter>,
  );
  return pedidas;
}

const tabla = async () => within(await screen.findByRole('table', { name: 'Accesos' }));

describe('Accesos', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  describe('tabla (administrador y recepcionista)', () => {
    for (const rol of ['administrador', 'recepcionista']) {
      it(`${rol}: fecha y hora, cliente o "No identificado", tipo, insignia de resultado y motivo`, async () => {
        abrir(rol);
        const t = await tabla();
        await t.findByText('Luis Soto');

        for (const encabezado of ['Fecha y hora', 'Cliente', 'Tipo', 'Resultado', 'Motivo']) {
          expect(t.getByRole('columnheader', { name: encabezado })).toBeInTheDocument();
        }
        const filas = t.getAllByRole('row').slice(1);
        expect(filas).toHaveLength(3);

        expect(filas[0]).toHaveTextContent('15 oct 2026 · 18:40');
        expect(filas[0]).toHaveTextContent('Luis Soto');
        expect(within(filas[0]).getByText('Rechazado')).toHaveClass('badge', 'badge-error');
        expect(filas[0]).toHaveTextContent('Pago pendiente');

        expect(within(filas[1]).getByText('Autorizado')).toHaveClass('badge', 'badge-exito');
        expect(filas[1]).toHaveTextContent('Entrada');

        expect(filas[2]).toHaveTextContent('No identificado');
        expect(filas[2]).toHaveTextContent('Rostro no reconocido');
      });
    }

    it('pide la lista del más reciente al más antiguo tal como la entrega el servidor (página 1, 20 por página)', async () => {
      const pedidas = abrir('administrador');
      await tabla();
      await waitFor(() => expect(pedidas.length).toBeGreaterThan(0));
      expect(pedidas[0]).toBe('/api/accesos?page=1&limit=20');
    });

    it('no ofrece editar ni eliminar accesos', async () => {
      abrir('administrador');
      const t = await tabla();
      await t.findByText('Luis Soto');
      expect(screen.queryByRole('button', { name: /editar|eliminar|borrar/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /editar|eliminar|borrar/i })).not.toBeInTheDocument();
    });
  });

  describe('vista básica del entrenador', () => {
    it('solo fecha y hora, cliente y resultado: sin tipo ni motivo', async () => {
      abrir('entrenador', { data: basico, page: 1, limit: 20, total: 3 });
      const t = await tabla();
      await t.findByText('Luis Soto');

      expect(t.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Fecha y hora', 'Cliente', 'Resultado']);
      expect(t.queryByText('Pago pendiente')).not.toBeInTheDocument();
      expect(t.getByText('No identificado')).toBeInTheDocument();
      expect(t.getAllByText('Rechazado')).toHaveLength(2);
    });
  });

  describe('permisos', () => {
    it('el rol cliente ve "Sin permiso" y no se pide ningún acceso', async () => {
      const pedidas = abrir('cliente');
      expect(await screen.findByText('Sin permiso')).toBeInTheDocument();
      expect(pedidas).toHaveLength(0);
    });
  });

  describe('filtros', () => {
    it('por fecha o rango: desde y hasta viajan en la consulta y vuelve a la página 1', async () => {
      const pedidas = abrir('recepcionista');
      await tabla();
      fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-10' } });
      await waitFor(() => expect(pedidas.at(-1)).toContain('desde=2026-10-10'));
      fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-15' } });
      await waitFor(() => expect(pedidas.at(-1)).toContain('hasta=2026-10-15'));
      expect(pedidas.at(-1)).toContain('page=1');
    });

    it('por resultado', async () => {
      const pedidas = abrir('recepcionista');
      await tabla();
      fireEvent.change(screen.getByLabelText('Resultado'), { target: { value: 'rechazado' } });
      await waitFor(() => expect(pedidas.at(-1)).toContain('resultado=rechazado'));
    });

    it('por nombre de cliente al pulsar Buscar', async () => {
      const pedidas = abrir('recepcionista');
      await tabla();
      fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: ' Luis ' } });
      expect(pedidas.at(-1)).not.toContain('q=');
      fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
      await waitFor(() => expect(pedidas.at(-1)).toContain('q=Luis'));
    });

    it('un rango invertido avisa y no consulta al servidor', async () => {
      const pedidas = abrir('recepcionista');
      await tabla();
      const antes = pedidas.length;
      fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-15' } });
      await waitFor(() => expect(pedidas.length).toBe(antes + 1));
      fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-01' } });
      expect(await screen.findByText('La fecha final no puede ser anterior a la inicial.')).toBeInTheDocument();
      expect(pedidas.length).toBe(antes + 1);
    });

    it('"Limpiar" quita todos los filtros', async () => {
      const pedidas = abrir('recepcionista');
      await tabla();
      fireEvent.change(screen.getByLabelText('Resultado'), { target: { value: 'autorizado' } });
      await waitFor(() => expect(pedidas.at(-1)).toContain('resultado=autorizado'));
      fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
      await waitFor(() => expect(pedidas.at(-1)).toBe('/api/accesos?page=1&limit=20'));
    });
  });

  describe('estados', () => {
    it('sin accesos registrados: estado vacío claro', async () => {
      abrir('recepcionista', { data: [], page: 1, limit: 20, total: 0 });
      expect(await screen.findByText('Todavía no hay accesos registrados.')).toBeInTheDocument();
    });

    it('sin resultados para los filtros: estado vacío con la sugerencia de cambiarlos', async () => {
      abrir('recepcionista', (url) => (url.includes('resultado=') ? { data: [], page: 1, limit: 20, total: 0 } : { data: completo, page: 1, limit: 20, total: 3 }));
      await tabla();
      fireEvent.change(screen.getByLabelText('Resultado'), { target: { value: 'autorizado' } });
      expect(await screen.findByText('No hay accesos con esos criterios.')).toBeInTheDocument();
    });

    it('muestra el error si el servidor falla', async () => {
      const cuenta = { id_usuario: 9, nombre: 'P', correo: 'p@example.com', rol: 'recepcionista', estado: 'activo', id_cliente: null };
      sessionStorage.setItem('gym_token', 't');
      sessionStorage.setItem('gym_usuario', JSON.stringify(cuenta));
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url) =>
          url === '/api/auth/me' ? respuesta(200, cuenta) : respuesta(500, { error: { code: 'INTERNAL_ERROR', message: 'Error interno.' } }),
        ),
      );
      render(
        <MemoryRouter initialEntries={['/accesos']}>
          <App />
        </MemoryRouter>,
      );
      expect(await screen.findByRole('alert')).toHaveTextContent('Error interno.');
    });
  });

  describe('paginación', () => {
    it('muestra "Página 1 de 3" y al pulsar Siguiente pide la página 2', async () => {
      const pedidas = abrir('recepcionista', { data: completo, page: 1, limit: 20, total: 45 });
      await tabla();
      expect(await screen.findByText('Página 1 de 3 (45 en total)')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
      await waitFor(() => expect(pedidas.at(-1)).toContain('page=2'));
    });
  });
});
