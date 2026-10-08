import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import Login from '../src/pages/Login.jsx';
import RutaProtegida from '../src/components/RutaProtegida.jsx';

const usuarioRecepcion = {
  id_usuario: 2,
  nombre: 'Rita Recepción',
  correo: 'rita@example.com',
  rol: 'recepcionista',
  estado: 'activo',
  id_cliente: null,
  fecha_registro: '2026-10-01T10:00:00.000Z',
};

// Respuesta falsa de fetch con la forma que usa el cliente de la API.
function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

function renderizar(ruta, rutas) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <AuthProvider>
        <Routes>{rutas}</Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function llenarYEnviar(correo, password) {
  fireEvent.change(screen.getByLabelText(/correo/i), { target: { value: correo } });
  fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));
}

describe('Login', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('muestra el error de credenciales incorrectas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respuesta(401, { error: { code: 'UNAUTHORIZED', message: 'Correo o contraseña incorrectos.' } }),
      ),
    );
    renderizar('/login', <Route path="/login" element={<Login />} />);

    llenarYEnviar('rita@example.com', 'Incorrecta999');

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.');
    expect(sessionStorage.getItem('gym_token')).toBeNull();
  });

  it('muestra el aviso de bloqueo temporal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respuesta(423, { error: { code: 'ACCOUNT_LOCKED', message: 'Cuenta bloqueada temporalmente.' } }),
      ),
    );
    renderizar('/login', <Route path="/login" element={<Login />} />);

    llenarYEnviar('rita@example.com', 'Secreta123');

    expect(await screen.findByRole('alert')).toHaveTextContent(/bloqueada temporalmente/i);
  });

  it('muestra el error por campo que devuelve la API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respuesta(400, {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Revisa los datos enviados.',
            details: [{ field: 'correo', message: 'El correo no tiene un formato válido.' }],
          },
        }),
      ),
    );
    renderizar('/login', <Route path="/login" element={<Login />} />);

    llenarYEnviar('no-es-correo', 'Secreta123');

    expect(await screen.findByText('El correo no tiene un formato válido.')).toBeInTheDocument();
  });

  it('con credenciales válidas guarda la sesión y entra al sistema', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respuesta(200, { token: 'token-de-prueba', usuario: usuarioRecepcion })),
    );
    renderizar(
      '/login',
      <>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<p>Pantalla de inicio</p>} />
      </>,
    );

    llenarYEnviar('rita@example.com', 'Secreta123');

    expect(await screen.findByText('Pantalla de inicio')).toBeInTheDocument();
    expect(sessionStorage.getItem('gym_token')).toBe('token-de-prueba');
  });
});

describe('RutaProtegida', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  function conSesion() {
    sessionStorage.setItem('gym_token', 'token-de-prueba');
    sessionStorage.setItem('gym_usuario', JSON.stringify(usuarioRecepcion));
    // AuthProvider refresca la sesión con /auth/me al cargar.
    vi.stubGlobal('fetch', vi.fn(async () => respuesta(200, usuarioRecepcion)));
  }

  const rutas = (roles) => (
    <>
      <Route path="/login" element={<p>Pantalla de login</p>} />
      <Route
        path="/usuarios"
        element={
          <RutaProtegida roles={roles}>
            <p>Contenido protegido</p>
          </RutaProtegida>
        }
      />
    </>
  );

  it('sin sesión redirige a /login', async () => {
    vi.stubGlobal('fetch', vi.fn());
    renderizar('/usuarios', rutas(['administrador']));

    expect(await screen.findByText('Pantalla de login')).toBeInTheDocument();
    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument();
  });

  it('con un rol no permitido muestra "Sin permiso" y no el contenido', async () => {
    conSesion();
    renderizar('/usuarios', rutas(['administrador']));

    expect(await screen.findByText(/sin permiso/i)).toBeInTheDocument();
    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument();
  });

  it('con un rol permitido muestra el contenido', async () => {
    conSesion();
    renderizar('/usuarios', rutas(['administrador', 'recepcionista']));

    await waitFor(() => expect(screen.getByText('Contenido protegido')).toBeInTheDocument());
  });
});
