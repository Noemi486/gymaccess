import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: correo } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } });
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

  it('se divide en un panel con la marca y una frase, y otro con el formulario', () => {
    vi.stubGlobal('fetch', vi.fn());
    renderizar('/login', <Route path="/login" element={<Login />} />);

    const marca = document.querySelector('.login-marca');
    expect(marca).toHaveTextContent('GymAccess');
    expect(marca.querySelector('.login-marca-logo svg')).toBeInTheDocument();

    const formulario = screen.getByRole('region', { name: /iniciar sesión/i });
    expect(formulario).toContainElement(screen.getByLabelText('Correo electrónico'));
    expect(formulario).toContainElement(screen.getByLabelText('Contraseña'));
    expect(marca).not.toContainElement(screen.getByLabelText('Correo electrónico'));
    expect(screen.getByRole('heading', { level: 1, name: 'Iniciar sesión en GymAccess' })).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
  });

  it('el panel de marca contiene el carrusel de tres diapositivas (el detalle está en carrusel-login.test.jsx)', () => {
    vi.stubGlobal('fetch', vi.fn());
    renderizar('/login', <Route path="/login" element={<Login />} />);
    const carrusel = document.querySelector('.login-marca .carrusel');
    expect(carrusel).toBeInTheDocument();
    expect(carrusel.querySelectorAll('.carrusel-diapositiva')).toHaveLength(3);
  });


  describe('formulario', () => {
    it('muestra el título, los placeholders y el botón principal de ancho completo', () => {
      vi.stubGlobal('fetch', vi.fn());
      renderizar('/login', <Route path="/login" element={<Login />} />);

      expect(screen.getByRole('heading', { level: 1, name: 'Iniciar sesión en GymAccess' })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Correo electrónico')).toBe(screen.getByLabelText('Correo electrónico'));
      expect(screen.getByPlaceholderText('Contraseña')).toBe(screen.getByLabelText('Contraseña'));
      expect(screen.getByLabelText('Correo electrónico')).toHaveClass('entrada-grande');
      expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toHaveClass('login-boton');
    });

    it('las etiquetas están ocultas a la vista pero disponibles para lectores de pantalla', () => {
      vi.stubGlobal('fetch', vi.fn());
      renderizar('/login', <Route path="/login" element={<Login />} />);
      const etiqueta = document.querySelector('label[for="correo"]');
      expect(etiqueta).toHaveClass('solo-lectores');
      expect(etiqueta).toHaveTextContent('Correo electrónico');
    });

    it('indica que quien olvidó su contraseña debe pedir a recepción que la restablezca', () => {
      vi.stubGlobal('fetch', vi.fn());
      renderizar('/login', <Route path="/login" element={<Login />} />);
      expect(
        screen.getByText('¿Olvidaste tu contraseña? Pide a recepción que la restablezca.'),
      ).toBeInTheDocument();
    });

    it('no ofrece registro de cuenta nueva ni enlaces de recuperación por correo', () => {
      vi.stubGlobal('fetch', vi.fn());
      renderizar('/login', <Route path="/login" element={<Login />} />);
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(screen.queryByText(/regístrate|crear cuenta|registrarse|nueva cuenta/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /registr|crear cuenta/i })).not.toBeInTheDocument();
    });
  });

  describe('botón para mostrar u ocultar la contraseña', () => {
    it('empieza oculta y alterna entre ocultar y mostrar, anunciando su estado', () => {
      vi.stubGlobal('fetch', vi.fn());
      renderizar('/login', <Route path="/login" element={<Login />} />);
      const campo = screen.getByLabelText('Contraseña');
      fireEvent.change(campo, { target: { value: 'Secreta123' } });

      const mostrar = screen.getByRole('button', { name: 'Mostrar contraseña' });
      expect(campo).toHaveAttribute('type', 'password');
      expect(mostrar).toHaveAttribute('aria-pressed', 'false');

      fireEvent.click(mostrar);
      expect(campo).toHaveAttribute('type', 'text');
      expect(campo).toHaveValue('Secreta123'); // lo escrito se conserva
      const ocultar = screen.getByRole('button', { name: 'Ocultar contraseña' });
      expect(ocultar).toHaveAttribute('aria-pressed', 'true');

      fireEvent.click(ocultar);
      expect(campo).toHaveAttribute('type', 'password');
    });

    it('es un botón real que no envía el formulario y se alcanza con el teclado', () => {
      const alEnviar = vi.fn(async () => respuesta(401, { error: { code: 'UNAUTHORIZED', message: 'Correo o contraseña incorrectos.' } }));
      vi.stubGlobal('fetch', vi.fn(alEnviar));
      renderizar('/login', <Route path="/login" element={<Login />} />);

      const boton = screen.getByRole('button', { name: 'Mostrar contraseña' });
      expect(boton.tagName).toBe('BUTTON');
      expect(boton).toHaveAttribute('type', 'button');
      expect(boton).not.toHaveAttribute('tabindex', '-1');
      // Va justo después del campo en el orden del documento (Tab llega al campo y luego al botón).
      const campo = screen.getByLabelText('Contraseña');
      expect(campo.compareDocumentPosition(boton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

      fireEvent.click(boton);
      expect(alEnviar).not.toHaveBeenCalled();
    });

    it('no estorba al mensaje de error del campo', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          respuesta(400, {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Revisa los datos enviados.',
              details: [{ field: 'password', message: 'Este campo es obligatorio.' }],
            },
          }),
        ),
      );
      renderizar('/login', <Route path="/login" element={<Login />} />);
      llenarYEnviar('rita@example.com', 'x');
      await screen.findByText('Este campo es obligatorio.');
      expect(screen.getByLabelText('Contraseña')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('button', { name: 'Mostrar contraseña' })).toBeInTheDocument();
    });
  });

  it('mientras entra, el botón queda en estado de carga y deshabilitado', async () => {
    let terminar;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise((resolver) => (terminar = () => resolver(respuesta(401, { error: { code: 'UNAUTHORIZED', message: 'Correo o contraseña incorrectos.' } }))))),
    );
    renderizar('/login', <Route path="/login" element={<Login />} />);

    llenarYEnviar('rita@example.com', 'Secreta123');

    const boton = await screen.findByRole('button', { name: /procesando/i });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute('aria-busy', 'true');
    terminar();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeEnabled();
  });

  it('marca como inválido el campo con error y lo asocia a su mensaje', async () => {
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

    await screen.findByText('El correo no tiene un formato válido.');
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Correo electrónico')).toHaveAccessibleDescription('El correo no tiene un formato válido.');
    expect(screen.getByLabelText('Contraseña')).not.toHaveAttribute('aria-invalid');
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
