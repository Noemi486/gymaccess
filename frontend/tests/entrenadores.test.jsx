import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor, configure } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

configure({ asyncUtilTimeout: 4000 });

// Entrenadores (spec 004, US1 y US7).

function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

const LUIS = { id_usuario: 7, nombre: 'Luis Ramos', correo: 'luis@gym.com', estado: 'activo', telefono: '5551234567', especialidad: 'Fuerza', tiene_ficha: true, clientes_asignados: 2, fecha_registro: '2026-11-01T10:00:00.000Z' };
const EVA = { id_usuario: 8, nombre: 'Eva Paz', correo: 'eva@gym.com', estado: 'inactivo', telefono: null, especialidad: null, tiene_ficha: false, clientes_asignados: 0, fecha_registro: '2026-10-01T10:00:00.000Z' };
const LISTA = { data: [LUIS, EVA], page: 1, limit: 20, total: 2 };
const DETALLE = {
  ...LUIS,
  clientes: [
    { id_cliente: 21, nombre: 'Ana', apellido: 'Ruiz', estado: 'activo', desde: '2026-11-02T09:00:00.000Z' },
    { id_cliente: 22, nombre: 'Beto', apellido: 'Soto', estado: 'inactivo', desde: '2026-11-03T09:00:00.000Z' },
  ],
};

// `responder(url, opciones)` puede devolver una respuesta para casos especiales; si no, se usan los datos de arriba.
function abrir(ruta, rol, responder = () => null) {
  const cuenta = { id_usuario: 1, nombre: 'Noemi', correo: 'n@example.com', rol, estado: 'activo', id_cliente: rol === 'cliente' ? 5 : null };
  sessionStorage.setItem('gym_token', 'token-de-prueba');
  sessionStorage.setItem('gym_usuario', JSON.stringify(cuenta));
  const llamadas = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, opciones = {}) => {
      if (url === '/api/auth/me') return respuesta(200, cuenta);
      if (url === '/api/avisos') return respuesta(200, { total: 0, avisos: [] });
      const metodo = opciones.method ?? 'GET';
      llamadas.push({ url, metodo, cuerpo: opciones.body ? JSON.parse(opciones.body) : undefined });
      const especial = responder(url, metodo);
      if (especial) return especial;
      if (url.startsWith('/api/entrenadores?')) return respuesta(200, LISTA);
      if (url === '/api/entrenadores/7' && metodo === 'GET') return respuesta(200, DETALLE);
      if (url === '/api/entrenadores' && metodo === 'POST') return respuesta(201, { ...LUIS, id_usuario: 9, clientes: [] });
      if (url === '/api/entrenadores/7' && metodo === 'PATCH') return respuesta(200, DETALLE);
      if (url === '/api/entrenadores/8/estado') return respuesta(200, { ...EVA, estado: 'activo', clientes: [] });
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

describe('Entrenadores', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('administrador: lista con especialidad, clientes, estado, enlace al detalle y acciones', async () => {
    const llamadas = abrir('/entrenadores', 'administrador');
    const tabla = within(await screen.findByRole('table', { name: 'Entrenadores' }));
    const filas = tabla.getAllByRole('row').slice(1);
    expect(filas[0]).toHaveTextContent('Luis Ramos');
    expect(filas[0]).toHaveTextContent('Fuerza');
    expect(filas[0]).toHaveTextContent('2');
    expect(within(filas[0]).getByRole('link', { name: 'Luis Ramos' })).toHaveAttribute('href', '/entrenadores/7');
    expect(within(filas[1]).getByText('Sin capturar')).toBeInTheDocument();
    expect(within(filas[1]).getByText('Inactivo')).toHaveClass('badge');
    expect(within(filas[0]).getByRole('button', { name: 'Desactivar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Nuevo entrenador/ })).toHaveAttribute('href', '/entrenadores/nuevo');
    expect(llamadas[0].url).toBe('/api/entrenadores?page=1&limit=20');
  });

  it('búsqueda y filtro de estado se envían al servidor', async () => {
    const llamadas = abrir('/entrenadores', 'administrador');
    await screen.findByRole('table', { name: 'Entrenadores' });
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'fuerza' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(llamadas.at(-1).url).toContain('q=fuerza'));
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'activo' } });
    await waitFor(() => expect(llamadas.at(-1).url).toContain('estado=activo'));
  });

  it('recepcionista: consulta sin crear, editar ni desactivar', async () => {
    abrir('/entrenadores', 'recepcionista');
    const tabla = within(await screen.findByRole('table', { name: 'Entrenadores' }));
    expect(tabla.queryByRole('button', { name: 'Desactivar' })).not.toBeInTheDocument();
    expect(tabla.queryByRole('columnheader', { name: 'Acciones' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Nuevo entrenador/ })).not.toBeInTheDocument();
  });

  it('desactivar con clientes: muestra el motivo del servidor', async () => {
    abrir('/entrenadores', 'administrador', (url) =>
      url === '/api/entrenadores/7/estado'
        ? respuesta(409, { error: { code: 'CONFLICT', message: 'Reasigna primero a sus 2 clientes: un entrenador con clientes asignados no puede desactivarse.' } })
        : null,
    );
    const tabla = within(await screen.findByRole('table', { name: 'Entrenadores' }));
    fireEvent.click(tabla.getAllByRole('button', { name: 'Desactivar' })[0]);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desactivar' }));
    expect(await screen.findByText(/Reasigna primero a sus 2 clientes/)).toBeInTheDocument();
  });

  it('activar un entrenador inactivo actualiza su fila', async () => {
    const llamadas = abrir('/entrenadores', 'administrador');
    const tabla = within(await screen.findByRole('table', { name: 'Entrenadores' }));
    fireEvent.click(tabla.getByRole('button', { name: 'Activar' }));
    await waitFor(() => expect(llamadas.some((l) => l.url === '/api/entrenadores/8/estado' && l.cuerpo.estado === 'activo')).toBe(true));
    expect(await screen.findByText('Entrenador activado.')).toBeInTheDocument();
  });

  it('alta: un solo formulario envía cuenta y ficha y vuelve a la lista con aviso', async () => {
    const llamadas = abrir('/entrenadores/nuevo', 'administrador');
    fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: 'Luis Ramos' } });
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'luis@gym.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Secreta123' } });
    fireEvent.change(screen.getByLabelText('Teléfono (opcional)'), { target: { value: '5551234567' } });
    fireEvent.change(screen.getByLabelText('Especialidad (opcional)'), { target: { value: 'Fuerza' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Entrenador registrado. Ya puede iniciar sesión.')).toBeInTheDocument();
    expect(llamadas.find((l) => l.metodo === 'POST').cuerpo).toEqual({ nombre: 'Luis Ramos', correo: 'luis@gym.com', password: 'Secreta123', telefono: '5551234567', especialidad: 'Fuerza' });
  });

  it('alta con correo repetido: error junto al campo', async () => {
    abrir('/entrenadores/nuevo', 'administrador', (url, metodo) =>
      metodo === 'POST'
        ? respuesta(409, { error: { code: 'CONFLICT', message: 'Ya existe un usuario con ese correo.', details: [{ field: 'correo', message: 'Ese correo ya está en uso.' }] } })
        : null,
    );
    fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: 'Luis' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Ese correo ya está en uso.')).toBeInTheDocument();
  });

  it('edición: correo bloqueado, sin contraseña y solo envía lo que cambió', async () => {
    const llamadas = abrir('/entrenadores/7/editar', 'administrador');
    const especialidad = await screen.findByLabelText('Especialidad (opcional)');
    expect(especialidad).toHaveValue('Fuerza');
    expect(screen.getByLabelText('Correo')).toBeDisabled();
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument();
    fireEvent.change(especialidad, { target: { value: 'Funcional' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Entrenador actualizado.')).toBeInTheDocument();
    expect(llamadas.find((l) => l.metodo === 'PATCH').cuerpo).toEqual({ especialidad: 'Funcional' });
  });

  it('detalle: datos del entrenador y sus clientes asignados con enlace', async () => {
    abrir('/entrenadores/7', 'recepcionista');
    expect(await screen.findByRole('heading', { name: 'Luis Ramos' })).toBeInTheDocument();
    const tabla = within(screen.getByRole('table', { name: 'Clientes asignados' }));
    expect(tabla.getByRole('link', { name: 'Ana Ruiz' })).toHaveAttribute('href', '/clientes/21');
    expect(tabla.getByText('Inactivo')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Editar/ })).not.toBeInTheDocument();
  });

  for (const rol of ['entrenador', 'cliente']) {
    it(`${rol}: "Sin permiso" y ninguna petición de entrenadores`, async () => {
      const llamadas = abrir('/entrenadores', rol);
      expect(await screen.findByText('Sin permiso')).toBeInTheDocument();
      expect(llamadas.filter((l) => l.url.startsWith('/api/entrenadores'))).toEqual([]);
    });
  }

  it('recepcionista: no puede abrir el alta', async () => {
    abrir('/entrenadores/nuevo', 'recepcionista');
    expect(await screen.findByText('Sin permiso')).toBeInTheDocument();
  });
});
