import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Usuarios from '../src/pages/Usuarios.jsx';
import UsuarioForm from '../src/pages/UsuarioForm.jsx';

const lista = {
  data: [
    {
      id_usuario: 5,
      nombre: 'Rita Recepción',
      correo: 'rita@example.com',
      rol: 'recepcionista',
      estado: 'activo',
      id_cliente: null,
      fecha_registro: '2026-10-01T10:00:00.000Z',
    },
  ],
  page: 1,
  limit: 20,
  total: 1,
};

function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

describe('Usuarios (lista)', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  function renderizarLista(fetchSimulado) {
    vi.stubGlobal('fetch', fetchSimulado);
    return render(
      <MemoryRouter initialEntries={['/usuarios']}>
        <Routes>
          <Route path="/usuarios" element={<Usuarios />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('pide confirmación antes de desactivar y solo entonces llama a la API', async () => {
    const llamadas = [];
    const fetchSimulado = vi.fn(async (url, opciones = {}) => {
      llamadas.push({ url, metodo: opciones.method ?? 'GET', cuerpo: opciones.body });
      if (opciones.method === 'PATCH') return respuesta(200, { ...lista.data[0], estado: 'inactivo' });
      return respuesta(200, lista);
    });
    renderizarLista(fetchSimulado);

    fireEvent.click(await screen.findByRole('button', { name: /desactivar/i }));

    // Aparece el diálogo y todavía no se envió ningún PATCH.
    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveTextContent(/rita recepción/i);
    expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(false);

    // Cancelar no cambia nada.
    fireEvent.click(within(dialogo).getByRole('button', { name: /cancelar/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(false);

    // Confirmar sí envía la baja lógica.
    fireEvent.click(screen.getByRole('button', { name: /desactivar/i }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /^desactivar$/i }));

    expect(await screen.findByText(/usuario desactivado/i)).toBeInTheDocument();
    const patch = llamadas.find((l) => l.metodo === 'PATCH');
    expect(patch.url).toBe('/api/usuarios/5');
    expect(JSON.parse(patch.cuerpo)).toEqual({ estado: 'inactivo' });
  });

  it('muestra el error del servidor si no se puede desactivar (último administrador)', async () => {
    const fetchSimulado = vi.fn(async (url, opciones = {}) => {
      if (opciones.method === 'PATCH') {
        return respuesta(409, {
          error: { code: 'CONFLICT', message: 'No puedes dejar al sistema sin administradores activos.' },
        });
      }
      return respuesta(200, lista);
    });
    renderizarLista(fetchSimulado);

    fireEvent.click(await screen.findByRole('button', { name: /desactivar/i }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /^desactivar$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/sin administradores activos/i);
  });
});

describe('UsuarioForm', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  function renderizarFormulario(fetchSimulado) {
    vi.stubGlobal('fetch', fetchSimulado);
    return render(
      <MemoryRouter initialEntries={['/usuarios/nuevo']}>
        <Routes>
          <Route path="/usuarios/nuevo" element={<UsuarioForm />} />
          <Route path="/usuarios" element={<p>Lista de usuarios</p>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('muestra los errores por campo que devuelve la API', async () => {
    const fetchSimulado = vi.fn(async () =>
      respuesta(400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Revisa los datos enviados.',
          details: [
            { field: 'correo', message: 'El correo no tiene un formato válido.' },
            { field: 'password', message: 'La contraseña debe tener entre 8 y 72 caracteres, con al menos una letra y un número.' },
          ],
        },
      }),
    );
    renderizarFormulario(fetchSimulado);

    fireEvent.change(screen.getByLabelText(/^nombre/i), { target: { value: 'Persona Nueva' } });
    fireEvent.change(screen.getByLabelText(/^correo/i), { target: { value: 'no-es-correo' } });
    fireEvent.change(screen.getByLabelText(/^contraseña/i), { target: { value: 'corta' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar|crear/i }));

    expect(await screen.findByText('El correo no tiene un formato válido.')).toBeInTheDocument();
    expect(screen.getByText(/entre 8 y 72 caracteres/i)).toBeInTheDocument();
    // Sigue en el formulario, no navegó a la lista.
    expect(screen.queryByText('Lista de usuarios')).not.toBeInTheDocument();
  });

  const clientesDisponibles = {
    data: [
      { id_cliente: 7, nombre: 'Ana', apellido: 'Prueba', correo: 'ana@example.com', telefono: '555', direccion: null, estado: 'activo', fecha_registro: '2026-10-01T10:00:00.000Z' },
      { id_cliente: 8, nombre: 'Beto', apellido: 'Prueba', correo: 'beto@example.com', telefono: '556', direccion: null, estado: 'activo', fecha_registro: '2026-10-01T10:00:00.000Z' },
    ],
    page: 1,
    limit: 10,
    total: 2,
  };

  it('ofrece elegir un cliente solo cuando el rol es cliente, y solo clientes disponibles', async () => {
    const fetchSimulado = vi.fn(async () => respuesta(200, clientesDisponibles));
    renderizarFormulario(fetchSimulado);

    expect(screen.queryByLabelText(/^cliente$/i)).not.toBeInTheDocument();
    expect(fetchSimulado).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/^rol/i), { target: { value: 'cliente' } });

    expect(await screen.findByLabelText(/^cliente$/i)).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: /ana prueba \(ana@example.com\)/i })).toBeInTheDocument();
    // Pide solo los clientes disponibles para crear una cuenta (activos, con correo y sin cuenta).
    const [url] = fetchSimulado.mock.calls[0];
    expect(url).toContain('/api/clientes?');
    expect(url).toContain('para_cuenta=true');
  });

  it('al elegir un cliente usa su correo (bloqueado), sugiere el nombre y envía su id_cliente', async () => {
    const fetchSimulado = vi.fn(async (url, opciones = {}) => {
      if (opciones.method === 'POST') return respuesta(201, { ...lista.data[0], id_usuario: 9, rol: 'cliente' });
      return respuesta(200, clientesDisponibles);
    });
    renderizarFormulario(fetchSimulado);

    fireEvent.change(screen.getByLabelText(/^rol/i), { target: { value: 'cliente' } });
    await screen.findByRole('option', { name: /beto prueba/i });
    fireEvent.change(screen.getByLabelText(/^cliente$/i), { target: { value: '8' } });

    expect(screen.getByLabelText(/^correo/i)).toHaveValue('beto@example.com');
    expect(screen.getByLabelText(/^correo/i)).toBeDisabled();
    expect(screen.getByLabelText(/^nombre/i)).toHaveValue('Beto Prueba');

    fireEvent.change(screen.getByLabelText(/^contraseña/i), { target: { value: 'Secreta123' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar|crear/i }));

    expect(await screen.findByText('Lista de usuarios')).toBeInTheDocument();
    const post = fetchSimulado.mock.calls.find(([, o]) => o?.method === 'POST');
    expect(JSON.parse(post[1].body)).toEqual({
      nombre: 'Beto Prueba',
      correo: 'beto@example.com',
      password: 'Secreta123',
      rol: 'cliente',
      id_cliente: 8,
    });
  });

  it('no deja guardar una cuenta de cliente sin elegir cliente', async () => {
    const fetchSimulado = vi.fn(async () => respuesta(200, clientesDisponibles));
    renderizarFormulario(fetchSimulado);

    fireEvent.change(screen.getByLabelText(/^rol/i), { target: { value: 'cliente' } });
    await screen.findByRole('option', { name: /ana prueba/i });
    fireEvent.change(screen.getByLabelText(/^nombre/i), { target: { value: 'Alguien' } });
    fireEvent.change(screen.getByLabelText(/^contraseña/i), { target: { value: 'Secreta123' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar|crear/i }));

    expect(await screen.findByText('Elige el cliente al que pertenece la cuenta.')).toBeInTheDocument();
    expect(fetchSimulado.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false);
  });

  it('al volver a un rol del personal se quita el correo que venía del cliente', async () => {
    const fetchSimulado = vi.fn(async () => respuesta(200, clientesDisponibles));
    renderizarFormulario(fetchSimulado);

    fireEvent.change(screen.getByLabelText(/^rol/i), { target: { value: 'cliente' } });
    await screen.findByRole('option', { name: /ana prueba/i });
    fireEvent.change(screen.getByLabelText(/^cliente$/i), { target: { value: '7' } });
    expect(screen.getByLabelText(/^correo/i)).toHaveValue('ana@example.com');

    fireEvent.change(screen.getByLabelText(/^rol/i), { target: { value: 'entrenador' } });

    expect(screen.getByLabelText(/^correo/i)).toHaveValue('');
    expect(screen.getByLabelText(/^correo/i)).not.toBeDisabled();
    expect(screen.queryByLabelText(/^cliente$/i)).not.toBeInTheDocument();
  });

  it('al guardar correctamente vuelve a la lista', async () => {
    const fetchSimulado = vi.fn(async () =>
      respuesta(201, { ...lista.data[0], id_usuario: 9, nombre: 'Persona Nueva' }),
    );
    renderizarFormulario(fetchSimulado);

    fireEvent.change(screen.getByLabelText(/^nombre/i), { target: { value: 'Persona Nueva' } });
    fireEvent.change(screen.getByLabelText(/^correo/i), { target: { value: 'nueva@example.com' } });
    fireEvent.change(screen.getByLabelText(/^contraseña/i), { target: { value: 'Secreta123' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar|crear/i }));

    expect(await screen.findByText('Lista de usuarios')).toBeInTheDocument();
    const [url, opciones] = fetchSimulado.mock.calls[0];
    expect(url).toBe('/api/usuarios');
    expect(opciones.method).toBe('POST');
    expect(JSON.parse(opciones.body)).toMatchObject({
      nombre: 'Persona Nueva',
      correo: 'nueva@example.com',
      password: 'Secreta123',
      rol: 'recepcionista',
    });
  });
});
