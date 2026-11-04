import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor, configure } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { formatearFechaHora } from '../src/utils/formato.js';

configure({ asyncUtilTimeout: 4000 });

function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

const PAGOS = {
  data: [
    {
      id_pago: 31,
      fecha_pago: '2026-10-14T10:02:11',
      cliente: { id_cliente: 7, nombre: 'Min', apellido: 'Cabrera' },
      membresia: { id_membresia: 12, plan: 'Plan Mensual' },
      monto: 450,
      metodo_pago: 'efectivo',
      registrado_por: 'Noemi',
    },
    {
      id_pago: 30,
      fecha_pago: '2026-10-13T18:30:00',
      cliente: { id_cliente: 9, nombre: 'Luis', apellido: 'Soto' },
      membresia: { id_membresia: 11, plan: 'Plan Anual' },
      monto: 1250.5,
      metodo_pago: 'tarjeta',
      registrado_por: null,
    },
  ],
  page: 1,
  limit: 20,
  total: 2,
  total_monto: 1700.5,
};

const ADEUDOS = {
  data: [
    {
      id_membresia: 20,
      cliente: { id_cliente: 5, nombre: 'Ana', apellido: 'Ruiz' },
      plan: 'Plan Mensual',
      adeudo: 450,
      fecha_inicio: '2026-10-01',
      fecha_fin: '2026-10-30',
    },
  ],
  page: 1,
  limit: 20,
  total: 1,
  total_adeudo: 450,
};

const VACIO_ADEUDOS = { data: [], page: 1, limit: 20, total: 0, total_adeudo: 0 };

// Abre una ruta con la cuenta del rol. Devuelve las peticiones hechas a /api/pagos y /api/adeudos.
function abrir(ruta, rol, { pagos = PAGOS, adeudos = ADEUDOS } = {}) {
  const cuenta = { id_usuario: 9, nombre: 'Persona', correo: 'p@example.com', rol, estado: 'activo', id_cliente: null };
  sessionStorage.setItem('gym_token', 'token-de-prueba');
  sessionStorage.setItem('gym_usuario', JSON.stringify(cuenta));
  const pedidas = [];
  let adeudosActuales = adeudos;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, opciones = {}) => {
      if (url === '/api/auth/me') return respuesta(200, cuenta);
      if (url.startsWith('/api/pagos') || url.startsWith('/api/adeudos')) {
        pedidas.push({ url, metodo: opciones.method ?? 'GET', cuerpo: opciones.body ? JSON.parse(opciones.body) : null });
        if (url === '/api/pagos' && opciones.method === 'POST') {
          adeudosActuales = VACIO_ADEUDOS;
          return respuesta(201, { pago: { id_pago: 40 }, membresia: { id_membresia: 20, estado: 'vigente' } });
        }
        if (url.startsWith('/api/pagos')) return respuesta(200, pagos);
        return respuesta(200, adeudosActuales);
      }
      return respuesta(404, { error: { code: 'NOT_FOUND', message: 'No existe.' } });
    }),
  );
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
    </MemoryRouter>,
  );
  return pedidas;
}

describe('Pagos y Adeudos', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('formatea fecha y hora sin desfase de zona horaria', () => {
    expect(formatearFechaHora('2026-10-14T10:02:11')).toBe('14 oct 2026 · 10:02');
    expect(formatearFechaHora('2026-01-03 23:59:59')).toBe('3 ene 2026 · 23:59');
    const instante = new Date(2026, 9, 14, 10, 2, 11).toISOString(); // 10:02 hora local, enviado en UTC
    expect(formatearFechaHora(instante)).toBe('14 oct 2026 · 10:02');
  });

  describe('Pagos', () => {
    it('tabla con fecha, cliente, membresía, monto, método y quién lo registró, más el total', async () => {
      abrir('/pagos', 'administrador');
      const t = within(await screen.findByRole('table', { name: 'Pagos' }));
      await t.findByText('Min Cabrera');
      for (const encabezado of ['Fecha', 'Cliente', 'Membresía', 'Monto', 'Método', 'Registró']) {
        expect(t.getByRole('columnheader', { name: encabezado })).toBeInTheDocument();
      }
      const filas = t.getAllByRole('row').slice(1);
      expect(filas[0]).toHaveTextContent('14 oct 2026 · 10:02');
      expect(filas[0]).toHaveTextContent('Plan Mensual');
      expect(filas[0]).toHaveTextContent('$450.00');
      expect(filas[0]).toHaveTextContent('Efectivo');
      expect(filas[0]).toHaveTextContent('Noemi');
      expect(filas[1]).toHaveTextContent('$1,250.50');
      expect(filas[1]).toHaveTextContent('Tarjeta');
      expect(screen.getByText('$1,700.50')).toBeInTheDocument();
    });

    it('los filtros viajan en la consulta y vuelven a la página 1', async () => {
      const pedidas = abrir('/pagos', 'recepcionista');
      await screen.findByText('Min Cabrera');
      fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-01' } });
      fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-31' } });
      fireEvent.change(screen.getByLabelText('Método'), { target: { value: 'tarjeta' } });
      fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'Luis' } });
      fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
      await waitFor(() => {
        const ultima = pedidas.at(-1).url;
        expect(ultima).toContain('page=1');
        expect(ultima).toContain('desde=2026-10-01');
        expect(ultima).toContain('hasta=2026-10-31');
        expect(ultima).toContain('metodo_pago=tarjeta');
        expect(ultima).toContain('q=Luis');
      });
    });

    it('avisa del rango invertido sin pedir datos', async () => {
      const pedidas = abrir('/pagos', 'administrador');
      await screen.findByText('Min Cabrera');
      const antes = pedidas.length;
      fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-31' } });
      fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-01' } });
      expect(await screen.findByText('La fecha final no puede ser anterior a la inicial.')).toBeInTheDocument();
      expect(pedidas.length).toBe(antes);
    });

    it('"Registrar pago" permite elegir una membresía pendiente y cobra el monto completo', async () => {
      const pedidas = abrir('/pagos', 'recepcionista');
      await screen.findByText('Min Cabrera');
      fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
      const lista = await screen.findByRole('list', { name: 'Membresías pendientes de pago' });
      fireEvent.click(within(lista).getByRole('button', { name: /Ana Ruiz/ }));
      const dialogo = await screen.findByRole('dialog', { name: 'Registrar pago' });
      expect(within(dialogo).getByDisplayValue('$450.00')).toHaveAttribute('readonly');
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar pago' }));
      await waitFor(() => expect(pedidas.some((p) => p.metodo === 'POST')).toBe(true));
      const post = pedidas.find((p) => p.metodo === 'POST');
      expect(post.cuerpo).toEqual({ id_membresia: 20, metodo_pago: 'efectivo', monto: 450 });
      expect(await screen.findByText('Pago registrado.')).toBeInTheDocument();
    });

    it('estado vacío y sin opciones para editar o eliminar', async () => {
      abrir('/pagos', 'administrador', { pagos: { data: [], page: 1, limit: 20, total: 0, total_monto: 0 } });
      expect(await screen.findByText('Todavía no hay pagos registrados.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /editar|eliminar|borrar/i })).not.toBeInTheDocument();
    });
  });

  describe('Adeudos', () => {
    it('muestra cliente, plan, adeudo, fechas, estado y el total por cobrar', async () => {
      abrir('/adeudos', 'administrador');
      const t = within(await screen.findByRole('table', { name: 'Adeudos' }));
      const fila = (await t.findByText('Ana Ruiz')).closest('tr');
      expect(fila).toHaveTextContent('Plan Mensual');
      expect(fila).toHaveTextContent('$450.00');
      expect(fila).toHaveTextContent('1 oct 2026');
      expect(fila).toHaveTextContent('30 oct 2026');
      expect(within(fila).getByText('Pendiente de pago')).toHaveClass('badge');
      expect(screen.getByText(/1 membresía pendiente/)).toBeInTheDocument();
    });

    it('registrar el pago desde la fila: la membresía sale de la lista', async () => {
      const pedidas = abrir('/adeudos', 'recepcionista');
      const t = within(await screen.findByRole('table', { name: 'Adeudos' }));
      await t.findByText('Ana Ruiz');
      fireEvent.click(t.getByRole('button', { name: 'Registrar pago' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Registrar pago' });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar pago' }));
      expect(await screen.findByText('No hay adeudos.')).toBeInTheDocument();
      expect(pedidas.filter((p) => p.metodo === 'POST')).toHaveLength(1);
    });

    it('estado vacío claro', async () => {
      abrir('/adeudos', 'administrador', { adeudos: VACIO_ADEUDOS });
      expect(await screen.findByText('No hay adeudos.')).toBeInTheDocument();
    });
  });

  describe('permisos', () => {
    for (const rol of ['entrenador', 'cliente']) {
      for (const ruta of ['/pagos', '/adeudos']) {
        it(`${rol} en ${ruta}: "Sin permiso" y no se piden datos`, async () => {
          const pedidas = abrir(ruta, rol);
          expect(await screen.findByText('Sin permiso')).toBeInTheDocument();
          expect(pedidas).toHaveLength(0);
        });
      }
    }
  });
});
