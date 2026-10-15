import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor, configure } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

// La primera pantalla carga varios módulos; con la máquina ocupada 1 s a veces no alcanza.
configure({ asyncUtilTimeout: 4000 });

function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

const cliente = {
  id_cliente: 7,
  nombre: 'Luis',
  apellido: 'Soto',
  correo: 'luis@example.com',
  telefono: '555-100-2000',
  direccion: null,
  fecha_registro: '2026-10-12T15:00:00.000Z',
  estado: 'activo',
};

const membresia = (id, extra = {}) => ({
  id_membresia: id,
  id_cliente: 7,
  tipo: { id_tipo_membresia: 1, nombre: 'Plan Mensual', duracion: 30 },
  fecha_inicio: '2026-10-01',
  fecha_fin: '2026-10-30',
  estado: 'vigente',
  dias_restantes: 16,
  por_vencer: false,
  precio: 450,
  adeudo: 0,
  pago: { id_pago: 1, fecha_pago: '2026-10-01T10:00:00', metodo_pago: 'efectivo', monto: 450 },
  ...extra,
});

const planes = [
  { id_tipo_membresia: 1, nombre: 'Plan Mensual', descripcion: null, duracion: 30, precio: 450, estado: 'activo' },
  { id_tipo_membresia: 2, nombre: 'Plan Anual', descripcion: null, duracion: 365, precio: 4200, estado: 'activo' },
];

// Abre /clientes/7 con la API simulada. `resumen` es la respuesta de GET /clientes/7/membresias;
// `alEscribir(url, metodo, cuerpo)` responde a las escrituras.
function abrir(rol, resumen, { alEscribir } = {}) {
  const cuenta = { id_usuario: 9, nombre: 'Persona', correo: 'p@example.com', rol, estado: 'activo', id_cliente: null };
  sessionStorage.setItem('gym_token', 'token-de-prueba');
  sessionStorage.setItem('gym_usuario', JSON.stringify(cuenta));
  const llamadas = [];
  let actual = resumen;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, opciones = {}) => {
      const metodo = opciones.method ?? 'GET';
      const cuerpo = opciones.body ? JSON.parse(opciones.body) : undefined;
      llamadas.push({ url, metodo, cuerpo });
      if (url === '/api/auth/me') return respuesta(200, cuenta);
      if (url === '/api/clientes/7') return respuesta(200, rol === 'entrenador' ? { id_cliente: 7, nombre: 'Luis', apellido: 'Soto', estado: 'activo' } : cliente);
      if (url === '/api/clientes/7/membresias' && metodo === 'GET') return respuesta(200, actual);
      if (url.startsWith('/api/tipos-membresia?')) return respuesta(200, { data: planes, page: 1, limit: 100, total: 2 });
      if (alEscribir) {
        const resultado = alEscribir(url, metodo, cuerpo, (nuevo) => (actual = nuevo));
        if (resultado) return resultado;
      }
      return respuesta(404, { error: { code: 'NOT_FOUND', message: 'No existe.' } });
    }),
  );
  render(
    <MemoryRouter initialEntries={['/clientes/7']}>
      <App />
    </MemoryRouter>,
  );
  return llamadas;
}

const panel = async () => (await screen.findByRole('heading', { name: 'Membresía' })).closest('section');
const vacio = { actual: null, proxima: null, historial: [] };

describe('Panel de membresía del cliente', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  describe('lectura', () => {
    it('muestra la membresía actual con plan, fechas, estado, días restantes y precio', async () => {
      abrir('recepcionista', { actual: membresia(1), proxima: null, historial: [] });
      const seccion = await panel();
      expect(await within(seccion).findByText('Plan Mensual')).toBeInTheDocument();
      expect(within(seccion).getByText('Vigente')).toBeInTheDocument();
      expect(within(seccion).getByText('1 oct 2026')).toBeInTheDocument();
      expect(within(seccion).getByText('30 oct 2026')).toBeInTheDocument();
      expect(within(seccion).getByText('16 días restantes')).toBeInTheDocument();
      expect(within(seccion).getByText('$450.00')).toBeInTheDocument();
    });

    it('avisa cuando está por vencer y muestra el adeudo de una pendiente de pago', async () => {
      abrir('recepcionista', {
        actual: membresia(1, { estado: 'pendiente_de_pago', por_vencer: false, adeudo: 450, pago: null, dias_restantes: 0 }),
        proxima: null,
        historial: [],
      });
      const seccion = await panel();
      expect(await within(seccion).findByText('Pendiente de pago')).toBeInTheDocument();
      expect(within(seccion).getByRole('status')).toHaveTextContent('Adeudo: $450.00');
      expect(within(seccion).getByText('Vence hoy')).toBeInTheDocument();
    });

    it('muestra la insignia "Por vencer" y la próxima membresía', async () => {
      abrir('recepcionista', {
        actual: membresia(1, { por_vencer: true, dias_restantes: 3 }),
        proxima: membresia(2, { estado: 'pendiente_de_pago', fecha_inicio: '2026-10-31', fecha_fin: '2026-11-29', adeudo: 450, pago: null, dias_restantes: 45 }),
        historial: [],
      });
      const seccion = await panel();
      expect(await within(seccion).findByText('Por vencer')).toBeInTheDocument();
      expect(within(seccion).getByText('Próxima membresía')).toBeInTheDocument();
      expect(within(seccion).getByText('29 nov 2026')).toBeInTheDocument();
    });

    it('lista el historial con su estado', async () => {
      abrir('recepcionista', {
        actual: null,
        proxima: null,
        historial: [membresia(3, { estado: 'cancelada', fecha_inicio: '2026-08-01', fecha_fin: '2026-08-30' }), membresia(2, { estado: 'vencida', fecha_inicio: '2026-06-01', fecha_fin: '2026-06-30', dias_restantes: -100 })],
      });
      const tabla = await screen.findByRole('table', { name: /historial de membresías/i });
      const filas = tabla.querySelectorAll('tbody tr');
      expect(filas).toHaveLength(2);
      expect(within(filas[0]).getByText('Cancelada')).toBeInTheDocument();
      expect(within(filas[1]).getByText('Vencida')).toBeInTheDocument();
    });

    it('sin membresías muestra estados vacíos y el botón para asignar', async () => {
      abrir('recepcionista', vacio);
      expect(await screen.findByText('El cliente no tiene una membresía en curso.')).toBeInTheDocument();
      expect(screen.getByText('Sin membresías anteriores.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Asignar membresía' })).toBeInTheDocument();
    });

    it('el entrenador no ve el panel de membresía ni hace la consulta', async () => {
      const llamadas = abrir('entrenador', vacio);
      await screen.findByText(/Soto/);
      expect(screen.queryByRole('heading', { name: 'Membresía' })).not.toBeInTheDocument();
      expect(llamadas.some((l) => l.url.includes('/membresias'))).toBe(false);
    });

    it('un error del servidor al cargar se muestra como aviso dentro del panel', async () => {
      const cuenta = { id_usuario: 9, nombre: 'P', correo: 'p@example.com', rol: 'recepcionista', estado: 'activo', id_cliente: null };
      sessionStorage.setItem('gym_token', 't');
      sessionStorage.setItem('gym_usuario', JSON.stringify(cuenta));
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url) => {
          if (url === '/api/auth/me') return respuesta(200, cuenta);
          if (url === '/api/clientes/7') return respuesta(200, cliente);
          return respuesta(500, { error: { code: 'INTERNAL_ERROR', message: 'Error interno.' } });
        }),
      );
      render(
        <MemoryRouter initialEntries={['/clientes/7']}>
          <App />
        </MemoryRouter>,
      );
      const seccion = await panel();
      expect(await within(seccion).findByRole('alert')).toHaveTextContent('Error interno.');
    });
  });

  describe('asignar', () => {
    it('ofrece solo planes activos con duración y precio, y envía el plan y la fecha elegidos', async () => {
      const llamadas = abrir('recepcionista', vacio, {
        alEscribir: (url, metodo) => (url === '/api/clientes/7/membresias' && metodo === 'POST' ? respuesta(201, { membresia: membresia(9), pago: null }) : null),
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Asignar membresía' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Asignar membresía' });
      const selector = await within(dialogo).findByLabelText('Plan');
      expect(within(selector).getByRole('option', { name: 'Plan Mensual — 30 días — $450.00' })).toBeInTheDocument();
      expect(within(selector).getByRole('option', { name: 'Plan Anual — 365 días — $4,200.00' })).toBeInTheDocument();
      expect(llamadas.some((l) => l.url === '/api/tipos-membresia?estado=activo&limit=100')).toBe(true);

      fireEvent.change(selector, { target: { value: '2' } });
      fireEvent.change(within(dialogo).getByLabelText(/Fecha de inicio/), { target: { value: '2099-01-10' } });
      expect(within(dialogo).getByText(/Vigente del 10 ene 2099 al 9 ene 2100/)).toBeInTheDocument();
      expect(dialogo.querySelector('.resumen-membresia strong')).toHaveTextContent('$4,200.00');

      fireEvent.click(within(dialogo).getByRole('button', { name: 'Asignar' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Asignar membresía' })).not.toBeInTheDocument());
      const envio = llamadas.find((l) => l.metodo === 'POST');
      expect(envio.cuerpo).toEqual({ id_tipo_membresia: 2, fecha_inicio: '2099-01-10' });
      expect(await screen.findByText('Membresía asignada.')).toBeInTheDocument();
    });

    it('sin fecha no envía fecha_inicio (empieza hoy) y exige elegir un plan', async () => {
      const llamadas = abrir('recepcionista', vacio, {
        alEscribir: (url, metodo) => (metodo === 'POST' ? respuesta(201, { membresia: membresia(9), pago: null }) : null),
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Asignar membresía' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Asignar membresía' });
      await within(dialogo).findByLabelText('Plan');
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Asignar' }));
      expect(await within(dialogo).findByText('Elige un plan.')).toBeInTheDocument();
      expect(llamadas.some((l) => l.metodo === 'POST')).toBe(false);

      fireEvent.change(within(dialogo).getByLabelText('Plan'), { target: { value: '1' } });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Asignar' }));
      await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST')).toBe(true));
      expect(llamadas.find((l) => l.metodo === 'POST').cuerpo).toEqual({ id_tipo_membresia: 1 });
    });

    it('un conflicto del servidor (ya tiene una en curso) se muestra como aviso en el diálogo', async () => {
      abrir('recepcionista', vacio, {
        alEscribir: (url, metodo) =>
          metodo === 'POST'
            ? respuesta(409, { error: { code: 'CONFLICT', message: 'El cliente ya tiene una membresía vigente o programada. Usa la renovación para extenderla.' } })
            : null,
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Asignar membresía' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Asignar membresía' });
      fireEvent.change(await within(dialogo).findByLabelText('Plan'), { target: { value: '1' } });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Asignar' }));
      expect(await within(dialogo).findByRole('alert')).toHaveTextContent(/ya tiene una membresía vigente/);
    });

    it('no ofrece asignar a un cliente dado de baja ni cuando ya hay una en curso', async () => {
      abrir('recepcionista', { actual: membresia(1), proxima: null, historial: [] });
      await screen.findByText('Plan Mensual');
      expect(screen.queryByRole('button', { name: 'Asignar membresía' })).not.toBeInTheDocument();
    });
  });

  describe('renovar', () => {
    it('con la membresía vigente la renovación empieza el día siguiente a su fin y se envía sin fecha', async () => {
      const llamadas = abrir('recepcionista', { actual: membresia(1), proxima: null, historial: [] }, {
        alEscribir: (url, metodo) =>
          url === '/api/membresias/1/renovar' && metodo === 'POST'
            ? respuesta(201, { membresia: membresia(2, { estado: 'pendiente_de_pago', fecha_inicio: '2026-10-31', fecha_fin: '2026-11-29', adeudo: 450, pago: null }), pago: null })
            : null,
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Renovar' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Renovar membresía' });
      expect(within(dialogo).getByText(/Vigente del 31 oct 2026 al 29 nov 2026/)).toBeInTheDocument();
      expect(within(dialogo).queryByLabelText(/Fecha de inicio/)).not.toBeInTheDocument();

      fireEvent.click(within(dialogo).getByRole('button', { name: 'Renovar' }));
      await waitFor(() => expect(llamadas.some((l) => l.url === '/api/membresias/1/renovar')).toBe(true));
      expect(llamadas.find((l) => l.url === '/api/membresias/1/renovar').cuerpo).toEqual({});
      expect(await screen.findByText('Membresía renovada.')).toBeInTheDocument();
    });

    it('una vencida se renueva desde hoy o desde la fecha elegida', async () => {
      const llamadas = abrir(
        'recepcionista',
        { actual: null, proxima: null, historial: [membresia(5, { estado: 'vencida', fecha_inicio: '2026-06-01', fecha_fin: '2026-06-30', dias_restantes: -100 })] },
        { alEscribir: (url, metodo) => (metodo === 'POST' ? respuesta(201, { membresia: membresia(6), pago: null }) : null) },
      );
      fireEvent.click(await screen.findByRole('button', { name: 'Renovar' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Renovar membresía' });
      fireEvent.change(within(dialogo).getByLabelText(/Fecha de inicio/), { target: { value: '2099-03-01' } });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Renovar' }));
      await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST')).toBe(true));
      expect(llamadas.find((l) => l.metodo === 'POST').cuerpo).toEqual({ fecha_inicio: '2099-03-01' });
    });

    it('no ofrece renovar si ya hay una renovación programada', async () => {
      abrir('recepcionista', {
        actual: membresia(1),
        proxima: membresia(2, { estado: 'pendiente_de_pago', fecha_inicio: '2026-10-31', fecha_fin: '2026-11-29', adeudo: 450, pago: null }),
        historial: [],
      });
      await screen.findByText('Próxima membresía');
      expect(screen.queryByRole('button', { name: 'Renovar' })).not.toBeInTheDocument();
    });
  });

  describe('suspender, reactivar y cancelar', () => {
    it('el recepcionista no ve esas acciones', async () => {
      abrir('recepcionista', { actual: membresia(1), proxima: null, historial: [] });
      await screen.findByText('Plan Mensual');
      for (const nombre of ['Suspender', 'Reactivar', 'Cancelar membresía']) {
        expect(screen.queryByRole('button', { name: nombre })).not.toBeInTheDocument();
      }
    });

    it('el administrador confirma antes de suspender y envía la acción', async () => {
      const llamadas = abrir('administrador', { actual: membresia(1), proxima: null, historial: [] }, {
        alEscribir: (url, metodo, cuerpo) =>
          url === '/api/membresias/1/estado' && metodo === 'PATCH' ? respuesta(200, membresia(1, { estado: 'suspendida' })) : null,
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Suspender' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Suspender membresía' });
      expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(false); // nada se envía antes de confirmar
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Suspender' }));
      await waitFor(() => expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(true));
      expect(llamadas.find((l) => l.metodo === 'PATCH').cuerpo).toEqual({ accion: 'suspender' });
      expect(await screen.findByText('Membresía suspendida.')).toBeInTheDocument();
    });

    it('cancelar pide confirmación, advierte que no se deshace y se puede abortar', async () => {
      const llamadas = abrir('administrador', { actual: membresia(1), proxima: null, historial: [] });
      fireEvent.click(await screen.findByRole('button', { name: 'Cancelar membresía' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Cancelar membresía' });
      expect(within(dialogo).getByText(/no se puede deshacer/i)).toBeInTheDocument();
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByRole('dialog', { name: 'Cancelar membresía' })).not.toBeInTheDocument();
      expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(false);
    });

    it('una suspendida ofrece reactivar en lugar de suspender', async () => {
      abrir('administrador', { actual: membresia(1, { estado: 'suspendida' }), proxima: null, historial: [] });
      expect(await screen.findByRole('button', { name: 'Reactivar' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Suspender' })).not.toBeInTheDocument();
    });

    it('un error del servidor al cambiar el estado se muestra como aviso', async () => {
      abrir('administrador', { actual: membresia(1), proxima: null, historial: [] }, {
        alEscribir: (url, metodo) => (metodo === 'PATCH' ? respuesta(409, { error: { code: 'CONFLICT', message: 'La membresía ya está cancelada.' } }) : null),
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Cancelar membresía' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Cancelar membresía' });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Sí, cancelar' }));
      expect(await screen.findByText('La membresía ya está cancelada.')).toBeInTheDocument();
    });
  });
});
