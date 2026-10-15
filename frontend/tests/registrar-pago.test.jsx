import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor, configure } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

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
  estado: 'pendiente_de_pago',
  dias_restantes: 16,
  por_vencer: false,
  precio: 450,
  adeudo: 450,
  pago: null,
  ...extra,
});

const pagada = (id, extra = {}) =>
  membresia(id, { estado: 'vigente', adeudo: 0, pago: { id_pago: 1, fecha_pago: '2026-10-01T10:00:00', metodo_pago: 'efectivo', monto: 450 }, ...extra });

const planes = [{ id_tipo_membresia: 1, nombre: 'Plan Mensual', descripcion: null, duracion: 30, precio: 450, estado: 'activo' }];

function abrir(rol, resumen, alEscribir) {
  const cuenta = { id_usuario: 9, nombre: 'Persona', correo: 'p@example.com', rol, estado: 'activo', id_cliente: null };
  sessionStorage.setItem('gym_token', 'token-de-prueba');
  sessionStorage.setItem('gym_usuario', JSON.stringify(cuenta));
  const llamadas = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, opciones = {}) => {
      const metodo = opciones.method ?? 'GET';
      const cuerpo = opciones.body ? JSON.parse(opciones.body) : undefined;
      llamadas.push({ url, metodo, cuerpo });
      if (url === '/api/auth/me') return respuesta(200, cuenta);
      if (url === '/api/clientes/7') return respuesta(200, cliente);
      if (url === '/api/clientes/7/membresias' && metodo === 'GET') return respuesta(200, typeof resumen === 'function' ? resumen() : resumen);
      if (url.startsWith('/api/tipos-membresia?')) return respuesta(200, { data: planes, page: 1, limit: 100, total: 1 });
      if (url === '/api/tipos-membresia/1') return respuesta(200, { ...planes[0], membresias_pendientes_de_pago: 0 });
      const resultado = alEscribir?.(url, metodo, cuerpo);
      if (resultado) return resultado;
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

describe('Registrar pago', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('solo ofrece "Registrar pago" cuando la membresía está pendiente de pago (recepcionista incluido)', async () => {
    abrir('recepcionista', { actual: pagada(1), proxima: null, historial: [] });
    await screen.findByText('Plan Mensual');
    expect(screen.queryByRole('button', { name: 'Registrar pago' })).not.toBeInTheDocument();
  });

  it('el diálogo muestra el monto completo de solo lectura y los tres métodos de pago', async () => {
    abrir('recepcionista', { actual: membresia(1), proxima: null, historial: [] });
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar pago' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Registrar pago' });
    const monto = within(dialogo).getByLabelText('Monto');
    expect(monto).toHaveValue('$450.00');
    expect(monto).toHaveAttribute('readonly');
    const metodos = within(within(dialogo).getByLabelText('Método de pago')).getAllByRole('option').map((o) => o.textContent);
    expect(metodos).toEqual(['Efectivo', 'Tarjeta', 'Transferencia']);
  });

  it('envía POST /pagos con el adeudo y el método elegido, avisa y recarga la membresía como vigente', async () => {
    let resumen = { actual: membresia(1), proxima: null, historial: [] };
    const llamadas = abrir('recepcionista', () => resumen, (url, metodo) => {
      if (url === '/api/pagos' && metodo === 'POST') {
        resumen = { actual: pagada(1), proxima: null, historial: [] };
        return respuesta(201, { pago: pagada(1).pago, membresia: pagada(1) });
      }
      return null;
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar pago' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Registrar pago' });
    fireEvent.change(within(dialogo).getByLabelText('Método de pago'), { target: { value: 'tarjeta' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar pago' }));

    await waitFor(() => expect(llamadas.some((l) => l.url === '/api/pagos')).toBe(true));
    expect(llamadas.find((l) => l.url === '/api/pagos').cuerpo).toEqual({ id_membresia: 1, metodo_pago: 'tarjeta', monto: 450 });
    expect(await screen.findByText('Pago registrado.')).toBeInTheDocument();
    expect(await screen.findByText('Vigente')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar pago' })).not.toBeInTheDocument();
  });

  it('el error del monto se muestra como error del campo', async () => {
    abrir('recepcionista', { actual: membresia(1), proxima: null, historial: [] }, (url, metodo) =>
      url === '/api/pagos' && metodo === 'POST'
        ? respuesta(400, { error: { code: 'VALIDATION_ERROR', message: 'Revisa los datos enviados.', details: [{ field: 'monto', message: 'El pago debe ser por el monto completo: $500.00.' }] } })
        : null,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar pago' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Registrar pago' });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar pago' }));
    expect(await within(dialogo).findByText('El pago debe ser por el monto completo: $500.00.')).toBeInTheDocument();
  });

  it('un conflicto (ya pagada) se muestra como aviso general en el diálogo', async () => {
    abrir('recepcionista', { actual: membresia(1), proxima: null, historial: [] }, (url, metodo) =>
      url === '/api/pagos' && metodo === 'POST' ? respuesta(409, { error: { code: 'CONFLICT', message: 'La membresía ya está pagada.' } }) : null,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar pago' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Registrar pago' });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar pago' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('La membresía ya está pagada.');
  });

  it('asignar con "Registrar el pago ahora" envía el pago junto con la membresía', async () => {
    const llamadas = abrir('recepcionista', { actual: null, proxima: null, historial: [] }, (url, metodo) =>
      url === '/api/clientes/7/membresias' && metodo === 'POST' ? respuesta(201, { membresia: pagada(2), pago: pagada(2).pago }) : null,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Asignar membresía' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Asignar membresía' });
    fireEvent.change(await within(dialogo).findByLabelText('Plan'), { target: { value: '1' } });
    fireEvent.click(within(dialogo).getByLabelText('Registrar el pago ahora'));
    fireEvent.change(within(dialogo).getByLabelText('Método de pago'), { target: { value: 'transferencia' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Asignar' }));
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST')).toBe(true));
    expect(llamadas.find((l) => l.metodo === 'POST').cuerpo).toEqual({ id_tipo_membresia: 1, pago: { metodo_pago: 'transferencia', monto: 450 } });
  });

  it('asignar sin marcar la casilla no envía pago', async () => {
    const llamadas = abrir('recepcionista', { actual: null, proxima: null, historial: [] }, (url, metodo) =>
      metodo === 'POST' ? respuesta(201, { membresia: membresia(2), pago: null }) : null,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Asignar membresía' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Asignar membresía' });
    fireEvent.change(await within(dialogo).findByLabelText('Plan'), { target: { value: '1' } });
    expect(within(dialogo).queryByLabelText('Método de pago')).not.toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Asignar' }));
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST')).toBe(true));
    expect(llamadas.find((l) => l.metodo === 'POST').cuerpo).toEqual({ id_tipo_membresia: 1 });
  });

  it('renovar con "Registrar el pago ahora" envía el pago al precio vigente del plan', async () => {
    const llamadas = abrir('recepcionista', { actual: pagada(1), proxima: null, historial: [] }, (url, metodo) =>
      url === '/api/membresias/1/renovar' && metodo === 'POST' ? respuesta(201, { membresia: pagada(2, { estado: 'proxima' }), pago: pagada(2).pago }) : null,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Renovar' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Renovar membresía' });
    fireEvent.click(await within(dialogo).findByLabelText('Registrar el pago ahora'));
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Renovar' }));
    await waitFor(() => expect(llamadas.some((l) => l.url === '/api/membresias/1/renovar')).toBe(true));
    expect(llamadas.find((l) => l.url === '/api/membresias/1/renovar').cuerpo).toEqual({ pago: { metodo_pago: 'efectivo', monto: 450 } });
  });
});
