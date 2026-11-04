import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor, configure } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

configure({ asyncUtilTimeout: 4000 });

function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

const ESTADO = { clientes_activos: 40, con_membresia_vigente: 31, con_membresia_vencida: 6, con_membresia_por_vencer: 4 };

function datosDe(url) {
  const consulta = new URL(url, 'http://x').searchParams;
  const tipo = consulta.get('periodo') ?? 'hoy';
  const periodo =
    tipo === 'rango'
      ? { tipo, desde: consulta.get('desde'), hasta: consulta.get('hasta') }
      : tipo === 'semana'
        ? { tipo, desde: '2026-11-02', hasta: '2026-11-04' }
        : tipo === 'mes'
          ? { tipo, desde: '2026-11-01', hasta: '2026-11-04' }
          : { tipo, desde: '2026-11-04', hasta: '2026-11-04' };
  return {
    periodo,
    estado_actual: ESTADO,
    periodo_datos: { ingresos: tipo === 'hoy' ? 5400 : 12500.5, accesos_autorizados: 212, accesos_rechazados: 9 },
    accesos_recientes:
      tipo === 'mes'
        ? []
        : [
            { id_acceso: 2, fecha: '2026-11-04', hora: '18:40:10', tipo: 'entrada', resultado: 'rechazado', motivo_rechazo: 'Pago pendiente', cliente: { id_cliente: 9, nombre: 'Luis', apellido: 'Soto' } },
            { id_acceso: 1, fecha: '2026-11-04', hora: '07:15:00', tipo: 'entrada', resultado: 'autorizado', motivo_rechazo: null, cliente: null },
          ],
  };
}

// Abre /dashboard con la cuenta del rol. `responder(url)` permite simular errores. Devuelve las URL pedidas.
function abrir(rol, responder = (url) => respuesta(200, datosDe(url))) {
  const cuenta = { id_usuario: 1, nombre: 'Noemi', correo: 'n@example.com', rol, estado: 'activo', id_cliente: null };
  sessionStorage.setItem('gym_token', 'token-de-prueba');
  sessionStorage.setItem('gym_usuario', JSON.stringify(cuenta));
  const pedidas = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      if (url === '/api/auth/me') return respuesta(200, cuenta);
      if (url.startsWith('/api/dashboard')) {
        pedidas.push(url);
        return responder(url);
      }
      return respuesta(404, { error: { code: 'NOT_FOUND', message: 'No existe.' } });
    }),
  );
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <App />
    </MemoryRouter>,
  );
  return pedidas;
}

const tarjeta = (etiqueta) => screen.getByText(etiqueta).closest('.stat-card');

describe('Dashboard', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('carga "Hoy" por defecto con sus fechas y las 7 cifras', async () => {
    const pedidas = abrir('administrador');
    expect(await screen.findByText('Hoy: 4 nov 2026')).toBeInTheDocument();
    expect(pedidas[0]).toBe('/api/dashboard?periodo=hoy');
    expect(screen.getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-pressed', 'true');
    expect(tarjeta('Clientes activos')).toHaveTextContent('40');
    expect(tarjeta('Con membresía vigente')).toHaveTextContent('31');
    expect(tarjeta('Con membresía por vencer')).toHaveTextContent('4');
    expect(tarjeta('Con membresía vencida')).toHaveTextContent('6');
    expect(tarjeta('Ingresos')).toHaveTextContent('$5,400.00');
    expect(tarjeta('Accesos autorizados')).toHaveTextContent('212');
    expect(tarjeta('Accesos rechazados')).toHaveTextContent('9');
    expect(screen.getByText(/a la fecha de hoy/)).toBeInTheDocument();
  });

  it('lista los accesos recientes con insignia y "No identificado"', async () => {
    abrir('administrador');
    const t = within(await screen.findByRole('table', { name: 'Accesos recientes' }));
    const filas = t.getAllByRole('row').slice(1);
    expect(filas[0]).toHaveTextContent('Luis Soto');
    expect(filas[0]).toHaveTextContent('Pago pendiente');
    expect(within(filas[0]).getByText('Rechazado')).toHaveClass('badge');
    expect(filas[1]).toHaveTextContent('No identificado');
  });

  it('cambiar el periodo vuelve a pedir los datos con los parámetros correctos', async () => {
    const pedidas = abrir('administrador');
    await screen.findByText('Hoy: 4 nov 2026');
    fireEvent.click(screen.getByRole('button', { name: 'Semana' }));
    expect(await screen.findByText('Semana: del 2 nov 2026 al 4 nov 2026')).toBeInTheDocument();
    expect(pedidas.at(-1)).toBe('/api/dashboard?periodo=semana');
    fireEvent.click(screen.getByRole('button', { name: 'Mes en curso' }));
    expect(await screen.findByText('Mes en curso: del 1 nov 2026 al 4 nov 2026')).toBeInTheDocument();
    expect(pedidas.at(-1)).toBe('/api/dashboard?periodo=mes');
    expect(tarjeta('Ingresos')).toHaveTextContent('$12,500.50');
    expect(screen.getByText('No hay accesos en este periodo.')).toBeInTheDocument();
  });

  it('rango: valida en la pantalla y envía desde y hasta al aplicar', async () => {
    const pedidas = abrir('administrador');
    await screen.findByText('Hoy: 4 nov 2026');
    fireEvent.click(screen.getByRole('button', { name: 'Rango' }));
    const antes = pedidas.length;
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-10' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(await screen.findByText('La fecha final no puede ser anterior a la inicial.')).toBeInTheDocument();
    expect(pedidas.length).toBe(antes);

    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(await screen.findByText('Rango: del 10 oct 2026 al 20 oct 2026')).toBeInTheDocument();
    expect(pedidas.at(-1)).toBe('/api/dashboard?periodo=rango&desde=2026-10-10&hasta=2026-10-20');
  });

  it('rango rechazado por el servidor: muestra el motivo y conserva las cifras', async () => {
    abrir('administrador', (url) =>
      url.includes('periodo=rango')
        ? respuesta(400, { error: { code: 'VALIDATION_ERROR', message: 'Revisa el periodo.', details: [{ field: 'hasta', message: 'El rango no puede incluir fechas futuras.' }] } })
        : respuesta(200, datosDe(url)),
    );
    await screen.findByText('Hoy: 4 nov 2026');
    fireEvent.click(screen.getByRole('button', { name: 'Rango' }));
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-12-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(await screen.findByText('El rango no puede incluir fechas futuras.')).toBeInTheDocument();
    expect(tarjeta('Clientes activos')).toHaveTextContent('40');
  });

  it('"Actualizar" vuelve a pedir los datos', async () => {
    const pedidas = abrir('administrador');
    await screen.findByText('Hoy: 4 nov 2026');
    const antes = pedidas.length;
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(pedidas.length).toBe(antes + 1));
  });

  it('error de carga: aviso claro', async () => {
    abrir('administrador', () => respuesta(500, { error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } }));
    expect(await screen.findByText('Ocurrió un error inesperado.')).toBeInTheDocument();
  });

  for (const rol of ['recepcionista', 'entrenador', 'cliente']) {
    it(`${rol}: "Sin permiso" y no se pide el dashboard`, async () => {
      const pedidas = abrir(rol);
      expect(await screen.findByText('Sin permiso')).toBeInTheDocument();
      expect(pedidas).toHaveLength(0);
    });
  }
});
