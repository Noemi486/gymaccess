import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

// Entrenador del cliente (spec 004, US2) y "Mis clientes" del entrenador (US7).

function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

const cliente = { id_cliente: 7, nombre: 'Ana', apellido: 'Ruiz', correo: 'ana@example.com', telefono: '5551002000', direccion: null, fecha_registro: '2026-10-12T15:00:00.000Z', estado: 'activo' };
const asignacion = (id, idEntrenador, nombre, estado, inicio, fin = null) => ({
  id_asignacion: id, entrenador: { id_usuario: idEntrenador, nombre, estado: 'activo' }, fecha_inicio: inicio, fecha_fin: fin, estado,
});
const SIN = { actual: null, historial: [] };
const CON_LUIS = { actual: asignacion(2, 11, 'Luis Ramos', 'activa', '2026-11-02T10:00:00.000Z'), historial: [asignacion(2, 11, 'Luis Ramos', 'activa', '2026-11-02T10:00:00.000Z'), asignacion(1, 12, 'Eva Paz', 'finalizada', '2026-10-01T10:00:00.000Z', '2026-11-02T10:00:00.000Z')] };
const ENTRENADORES = { data: [{ id_usuario: 11, nombre: 'Luis Ramos', especialidad: 'Fuerza', clientes_asignados: 3 }, { id_usuario: 12, nombre: 'Eva Paz', especialidad: null, clientes_asignados: 0 }], page: 1, limit: 100, total: 2 };

function abrir(ruta, rol, { entrenador = SIN, responder = () => null, clienteDatos = cliente } = {}) {
  const cuenta = { id_usuario: 1, nombre: 'Persona', correo: 'p@example.com', rol, estado: 'activo', id_cliente: null };
  sessionStorage.setItem('gym_token', 'token-de-prueba');
  sessionStorage.setItem('gym_usuario', JSON.stringify(cuenta));
  const llamadas = [];
  let actual = entrenador;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, opciones = {}) => {
      const metodo = opciones.method ?? 'GET';
      const cuerpo = opciones.body ? JSON.parse(opciones.body) : undefined;
      if (url === '/api/auth/me') return respuesta(200, cuenta);
      if (url === '/api/avisos') return respuesta(200, { total: 0, avisos: [] });
      llamadas.push({ url, metodo, cuerpo });
      const especial = responder(url, metodo, cuerpo, (nuevo) => (actual = nuevo));
      if (especial) return especial;
      if (url === '/api/clientes/7') return respuesta(200, clienteDatos);
      if (url === '/api/clientes/7/membresias') return respuesta(200, { actual: null, proxima: null, historial: [] });
      if (url === '/api/clientes/7/rostro') return respuesta(200, { registrado: false, activo: null, historial: [] });
      if (url === '/api/clientes/7/entrenador' && metodo === 'GET') return respuesta(200, actual);
      if (url === '/api/entrenadores?estado=activo&limit=100') return respuesta(200, ENTRENADORES);
      if (url.startsWith('/api/entrenamiento/mis-clientes')) {
        return respuesta(200, { data: [{ id_cliente: 7, nombre: 'Ana', apellido: 'Ruiz', estado: 'activo', desde: '2026-11-02T10:00:00.000Z' }], page: 1, limit: 20, total: 1 });
      }
      return respuesta(404, { error: { code: 'NOT_FOUND', message: 'No existe.' } });
    }),
  );
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
    </MemoryRouter>,
  );
  return llamadas;
}

const panel = async () => (await screen.findByRole('heading', { name: 'Entrenador' })).closest('section');

describe('Panel "Entrenador" del cliente', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('sin entrenador: asignar uno pide la lista de activos y envía el id', async () => {
    const llamadas = abrir('/clientes/7', 'recepcionista', {
      responder: (url, metodo, cuerpo, fijar) => {
        if (url === '/api/clientes/7/entrenador' && metodo === 'PUT') {
          fijar(CON_LUIS);
          return respuesta(200, CON_LUIS);
        }
        return null;
      },
    });
    const seccion = within(await panel());
    expect(await seccion.findByText('Sin entrenador asignado.')).toBeInTheDocument();
    fireEvent.click(seccion.getByRole('button', { name: 'Asignar entrenador' }));
    const selector = await seccion.findByLabelText('Entrenador');
    await waitFor(() => expect(within(selector).getAllByRole('option')).toHaveLength(3));
    expect(within(selector).getByRole('option', { name: 'Luis Ramos (Fuerza) · 3 clientes' })).toBeInTheDocument();
    fireEvent.change(selector, { target: { value: '11' } });
    fireEvent.click(seccion.getByRole('button', { name: 'Guardar' }));
    expect(await seccion.findByRole('link', { name: 'Luis Ramos' })).toHaveAttribute('href', '/entrenadores/11');
    expect(llamadas.find((l) => l.metodo === 'PUT').cuerpo).toEqual({ id_entrenador: 11 });
    expect(await screen.findByText('Entrenador asignado.')).toBeInTheDocument();
  });

  it('guardar sin elegir: aviso en el campo y no se envía nada', async () => {
    const llamadas = abrir('/clientes/7', 'administrador');
    const seccion = within(await panel());
    fireEvent.click(await seccion.findByRole('button', { name: 'Asignar entrenador' }));
    await seccion.findByLabelText('Entrenador');
    fireEvent.click(seccion.getByRole('button', { name: 'Guardar' }));
    expect(await seccion.findByText('Elige un entrenador.')).toBeInTheDocument();
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false);
  });

  it('con entrenador: muestra el actual y el historial; cambiar pide confirmación y no ofrece al actual', async () => {
    const llamadas = abrir('/clientes/7', 'administrador', {
      entrenador: CON_LUIS,
      responder: (url, metodo) => (metodo === 'PUT' ? respuesta(200, { ...CON_LUIS, actual: asignacion(3, 12, 'Eva Paz', 'activa', '2026-11-04T10:00:00.000Z') }) : null),
    });
    const seccion = within(await panel());
    expect(await seccion.findByRole('link', { name: 'Luis Ramos' })).toBeInTheDocument();
    const historial = seccion.getByRole('list', { name: 'Historial de entrenadores' });
    expect(within(historial).getAllByRole('listitem')).toHaveLength(2);
    expect(within(historial).getByText('Terminada')).toBeInTheDocument();

    fireEvent.click(seccion.getByRole('button', { name: 'Cambiar entrenador' }));
    const selector = await seccion.findByLabelText('Nuevo entrenador');
    await waitFor(() => expect(within(selector).getAllByRole('option')).toHaveLength(2));
    expect(within(selector).queryByRole('option', { name: /Luis Ramos/ })).not.toBeInTheDocument();
    fireEvent.change(selector, { target: { value: '12' } });
    fireEvent.click(seccion.getByRole('button', { name: 'Guardar' }));
    const dialogo = within(screen.getByRole('dialog'));
    expect(dialogo.getByText(/con Luis Ramos y empezará con Eva Paz/)).toBeInTheDocument();
    expect(llamadas.some((l) => l.metodo === 'PUT')).toBe(false);
    fireEvent.click(dialogo.getByRole('button', { name: 'Cambiar' }));
    await waitFor(() => expect(llamadas.find((l) => l.metodo === 'PUT')?.cuerpo).toEqual({ id_entrenador: 12 }));
  });

  it('quitar: confirmación y envía null', async () => {
    const llamadas = abrir('/clientes/7', 'recepcionista', {
      entrenador: CON_LUIS,
      responder: (url, metodo) => (metodo === 'PUT' ? respuesta(200, { actual: null, historial: CON_LUIS.historial }) : null),
    });
    const seccion = within(await panel());
    fireEvent.click(await seccion.findByRole('button', { name: 'Quitar entrenador' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Quitar' }));
    expect(await seccion.findByText('Sin entrenador asignado.')).toBeInTheDocument();
    expect(llamadas.find((l) => l.metodo === 'PUT').cuerpo).toEqual({ id_entrenador: null });
  });

  it('error del servidor al asignar: se muestra el motivo', async () => {
    abrir('/clientes/7', 'recepcionista', {
      responder: (url, metodo) =>
        metodo === 'PUT'
          ? respuesta(409, { error: { code: 'CONFLICT', message: 'El entrenador elegido está inactivo.', details: [{ field: 'id_entrenador', message: 'El entrenador elegido está inactivo.' }] } })
          : null,
    });
    const seccion = within(await panel());
    fireEvent.click(await seccion.findByRole('button', { name: 'Asignar entrenador' }));
    const selector = await seccion.findByLabelText('Entrenador');
    await waitFor(() => expect(within(selector).getAllByRole('option')).toHaveLength(3));
    fireEvent.change(selector, { target: { value: '12' } });
    fireEvent.click(seccion.getByRole('button', { name: 'Guardar' }));
    expect(await seccion.findByText('El entrenador elegido está inactivo.')).toBeInTheDocument();
  });

  it('cliente dado de baja: sin botones para asignar', async () => {
    abrir('/clientes/7', 'administrador', { clienteDatos: { ...cliente, estado: 'inactivo' } });
    const seccion = within(await panel());
    expect(await seccion.findByText('Sin entrenador asignado.')).toBeInTheDocument();
    expect(seccion.queryByRole('button', { name: 'Asignar entrenador' })).not.toBeInTheDocument();
  });

  it('el entrenador no ve el panel ni pide la asignación', async () => {
    const llamadas = abrir('/clientes/7', 'entrenador');
    await screen.findByText(/Ana Ruiz/);
    expect(screen.queryByRole('heading', { name: 'Entrenador' })).not.toBeInTheDocument();
    expect(llamadas.some((l) => l.url === '/api/clientes/7/entrenador')).toBe(false);
  });
});

describe('Mis clientes (entrenador)', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('lista sus clientes con el total y busca en el servidor', async () => {
    const llamadas = abrir('/mis-clientes', 'entrenador');
    const tabla = within(await screen.findByRole('table', { name: 'Mis clientes' }));
    expect(tabla.getByRole('link', { name: 'Ana Ruiz' })).toBeInTheDocument();
    expect(screen.getByText(/Clientes asignados a ti: 1/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(llamadas.at(-1).url).toBe('/api/entrenamiento/mis-clientes?page=1&limit=20&q=Ana'));
  });

  for (const rol of ['administrador', 'recepcionista', 'cliente']) {
    it(`${rol}: "Sin permiso"`, async () => {
      abrir('/mis-clientes', rol);
      expect(await screen.findByText('Sin permiso')).toBeInTheDocument();
    });
  }
});
