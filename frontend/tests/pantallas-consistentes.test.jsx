import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { ToastProvider } from '../src/components/ui/Toast.jsx';
import Clientes from '../src/pages/Clientes.jsx';
import ClienteForm from '../src/pages/ClienteForm.jsx';
import UsuarioForm from '../src/pages/UsuarioForm.jsx';
import Usuarios from '../src/pages/Usuarios.jsx';

// Fase 6: Usuarios y Clientes con los componentes comunes (tabla, insignias, estado vacío,
// paginación, formularios con errores por campo, avisos y confirmaciones).

function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

const usuario = (id, nombre, estado = 'activo') => ({
  id_usuario: id,
  nombre,
  correo: `${nombre.toLowerCase()}@example.com`,
  rol: 'recepcionista',
  estado,
  id_cliente: null,
  fecha_registro: '2026-10-01T10:00:00.000Z',
});

const cliente = (estado = 'activo') => ({
  id_cliente: 7,
  nombre: 'Clara',
  apellido: 'Prueba',
  correo: null,
  telefono: '555 123 4567',
  direccion: null,
  fecha_registro: '2026-10-07T10:00:00.000Z',
  estado,
});

function sesionDe(rol) {
  const cuenta = { id_usuario: 9, nombre: 'Persona de Prueba', correo: 'p@example.com', rol, estado: 'activo', id_cliente: null };
  sessionStorage.setItem('gym_token', 'token-de-prueba');
  sessionStorage.setItem('gym_usuario', JSON.stringify(cuenta));
  return cuenta;
}

describe('Pantallas con componentes comunes', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  describe('Usuarios (lista)', () => {
    function abrir(lista, entrada = '/usuarios') {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url) => (String(url).startsWith('/api/usuarios') ? lista() : respuesta(404, {}))),
      );
      render(
        <MemoryRouter initialEntries={[entrada]}>
          <ToastProvider>
            <Routes>
              <Route path="/usuarios" element={<Usuarios />} />
            </Routes>
          </ToastProvider>
        </MemoryRouter>,
      );
    }

    it('usa la tabla común con encabezado, insignias de estado con texto y paginación', async () => {
      abrir(() =>
        respuesta(200, { data: [usuario(1, 'Rita'), usuario(2, 'Beto', 'inactivo')], page: 1, limit: 20, total: 45 }),
      );
      const tabla = await screen.findByRole('table', { name: /usuarios/i });
      for (const columna of ['Nombre', 'Correo', 'Rol', 'Estado', 'Acciones']) {
        expect(within(tabla).getByRole('columnheader', { name: columna })).toBeInTheDocument();
      }
      expect(within(screen.getByText('Rita').closest('tr')).getByText('Activo')).toHaveClass('badge-exito');
      expect(within(screen.getByText('Beto').closest('tr')).getByText('Inactivo')).toHaveClass('badge-neutral');
      expect(screen.getByText(/página 1 de 3/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /nuevo usuario/i })).toHaveAttribute('href', '/usuarios/nuevo');
    });

    it('sin resultados muestra un estado vacío', async () => {
      abrir(() => respuesta(200, { data: [], page: 1, limit: 20, total: 0 }));
      expect(await screen.findByText('No hay usuarios con esos filtros.')).toBeInTheDocument();
    });

    it('si falla la carga muestra un aviso de error', async () => {
      abrir(() => respuesta(500, { error: { code: 'INTERNAL_ERROR', message: 'Algo salió mal.' } }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal.');
    });

    it('muestra como aviso el éxito que deja el formulario al guardar', async () => {
      abrir(() => respuesta(200, { data: [usuario(1, 'Rita')], page: 1, limit: 20, total: 1 }), {
        pathname: '/usuarios',
        state: { mensaje: 'Usuario creado.' },
      });
      const aviso = await screen.findByRole('status');
      expect(aviso).toHaveTextContent('Usuario creado.');
      await screen.findByText('Rita');
    });
  });

  describe('Clientes (lista)', () => {
    function abrir(rol, lista) {
      sesionDe(rol);
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url) => {
          if (url === '/api/auth/me') return respuesta(200, JSON.parse(sessionStorage.getItem('gym_usuario')));
          return lista();
        }),
      );
      render(
        <MemoryRouter initialEntries={['/clientes']}>
          <AuthProvider>
            <Routes>
              <Route path="/clientes" element={<Clientes />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>,
      );
    }

    it('sin resultados muestra un estado vacío claro', async () => {
      abrir('recepcionista', () => respuesta(200, { data: [], page: 1, limit: 20, total: 0 }));
      expect(await screen.findByText('No hay clientes con esos criterios.')).toBeInTheDocument();
      expect(screen.getByText(/página 1 de 1/i)).toBeInTheDocument();
    });

    it('si falla la carga muestra un aviso de error', async () => {
      abrir('recepcionista', () => respuesta(500, { error: { code: 'INTERNAL_ERROR', message: 'Algo salió mal.' } }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal.');
    });

    it('usa la tabla común y la acción principal en el encabezado de la página', async () => {
      abrir('administrador', () => respuesta(200, { data: [cliente()], page: 1, limit: 20, total: 1 }));
      expect(await screen.findByRole('table', { name: /clientes/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Clientes' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /nuevo cliente/i })).toHaveAttribute('href', '/clientes/nuevo');
      expect(within(screen.getByRole('table', { name: /clientes/i })).getByText('Activo')).toHaveClass('badge');
    });
  });

  describe('ClienteForm', () => {
    function abrir(rol, ruta, responder) {
      sesionDe(rol);
      const llamadas = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url, opciones = {}) => {
          llamadas.push({ url, metodo: opciones.method ?? 'GET', cuerpo: opciones.body });
          if (url === '/api/auth/me') return respuesta(200, JSON.parse(sessionStorage.getItem('gym_usuario')));
          return responder(url, opciones);
        }),
      );
      render(
        <MemoryRouter initialEntries={[ruta]}>
          <ToastProvider>
            <AuthProvider>
              <Routes>
                <Route path="/clientes/nuevo" element={<ClienteForm />} />
                <Route path="/clientes/:id/editar" element={<ClienteForm />} />
              </Routes>
            </AuthProvider>
          </ToastProvider>
        </MemoryRouter>,
      );
      return llamadas;
    }

    it('al guardar muestra el botón en estado de carga y después un aviso de éxito', async () => {
      let terminar;
      abrir('recepcionista', '/clientes/nuevo', (url, opciones) => {
        if (opciones.method === 'POST') return new Promise((resolver) => (terminar = () => resolver(respuesta(201, cliente()))));
        return respuesta(404, {});
      });
      fireEvent.change(screen.getByLabelText(/^nombre/i), { target: { value: 'Clara' } });
      fireEvent.change(screen.getByLabelText(/^apellido/i), { target: { value: 'Prueba' } });
      fireEvent.change(screen.getByLabelText(/^teléfono/i), { target: { value: '555 123 4567' } });
      fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

      const boton = await screen.findByRole('button', { name: /procesando/i });
      expect(boton).toBeDisabled();
      expect(boton).toHaveAttribute('aria-busy', 'true');

      terminar();
      expect(await screen.findByText('Cliente registrado.')).toBeInTheDocument();
      expect(screen.getByLabelText(/^nombre/i)).toHaveValue('');
    });

    it('los errores del servidor aparecen junto a cada campo, asociados al campo', async () => {
      abrir('recepcionista', '/clientes/nuevo', (_url, opciones) =>
        opciones.method === 'POST'
          ? respuesta(400, {
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Revisa los datos enviados.',
                details: [{ field: 'telefono', message: 'Escribe un teléfono válido.' }],
              },
            })
          : respuesta(404, {}),
      );
      fireEvent.change(screen.getByLabelText(/^nombre/i), { target: { value: 'Clara' } });
      fireEvent.change(screen.getByLabelText(/^apellido/i), { target: { value: 'Prueba' } });
      fireEvent.change(screen.getByLabelText(/^teléfono/i), { target: { value: 'x' } });
      fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

      expect(await screen.findByText('Escribe un teléfono válido.')).toBeInTheDocument();
      expect(screen.getByLabelText(/^teléfono/i)).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText(/^teléfono/i)).toHaveAccessibleDescription(/teléfono válido/i);
    });

    it('la baja pide confirmación: cancelar no cambia nada y confirmar la aplica con un aviso', async () => {
      const llamadas = abrir('administrador', '/clientes/7/editar', (url, opciones) => {
        if (url === '/api/clientes/7/estado') return respuesta(200, cliente('inactivo'));
        if (url === '/api/clientes/7' && (opciones.method ?? 'GET') === 'GET') return respuesta(200, cliente());
        return respuesta(404, {});
      });
      fireEvent.click(await screen.findByRole('button', { name: /dar de baja/i }));

      const dialogo = await screen.findByRole('dialog', { name: /dar de baja al cliente/i });
      expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(false);
      fireEvent.click(within(dialogo).getByRole('button', { name: /cancelar/i }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(false);

      fireEvent.click(screen.getByRole('button', { name: /dar de baja/i }));
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /^dar de baja$/i }));

      expect(await screen.findByText('Cliente dado de baja.')).toBeInTheDocument();
      expect(JSON.parse(llamadas.find((l) => l.metodo === 'PATCH').cuerpo)).toEqual({ estado: 'inactivo' });
      expect(await screen.findByRole('button', { name: /reactivar/i })).toBeInTheDocument();
    });

    it('el recepcionista no ve el control de baja', async () => {
      abrir('recepcionista', '/clientes/7/editar', (url, opciones) =>
        url === '/api/clientes/7' && (opciones.method ?? 'GET') === 'GET' ? respuesta(200, cliente()) : respuesta(404, {}),
      );
      await screen.findByLabelText(/^nombre/i);
      expect(screen.queryByRole('button', { name: /dar de baja|reactivar/i })).not.toBeInTheDocument();
    });
  });

  describe('UsuarioForm', () => {
    it('muestra el error de un campo junto al campo y el botón guarda con estado de carga', async () => {
      let terminar;
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Promise((resolver) => {
              terminar = () =>
                resolver(
                  respuesta(409, {
                    error: {
                      code: 'CONFLICT',
                      message: 'Ya existe un usuario con ese correo.',
                      details: [{ field: 'correo', message: 'Ese correo ya está registrado.' }],
                    },
                  }),
                );
            }),
        ),
      );
      render(
        <MemoryRouter initialEntries={['/usuarios/nuevo']}>
          <Routes>
            <Route path="/usuarios/nuevo" element={<UsuarioForm />} />
          </Routes>
        </MemoryRouter>,
      );
      fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Rita' } });
      fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'rita@example.com' } });
      fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Secreta123' } });
      fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

      expect(await screen.findByRole('button', { name: /procesando/i })).toBeDisabled();
      terminar();
      expect(await screen.findByText('Ese correo ya está registrado.')).toBeInTheDocument();
      expect(screen.getByLabelText('Correo')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('button', { name: /guardar/i })).toBeEnabled();
    });
  });
});
