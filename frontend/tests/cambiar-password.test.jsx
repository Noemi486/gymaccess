import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

const ROLES = ['administrador', 'recepcionista', 'entrenador', 'cliente'];

const cuentaDe = (rol) => ({
  id_usuario: 9,
  nombre: 'Persona de Prueba',
  correo: 'persona@example.com',
  rol,
  estado: 'activo',
  id_cliente: rol === 'cliente' ? 7 : null,
});

const cliente = {
  id_cliente: 7,
  nombre: 'Ana',
  apellido: 'Propia',
  correo: 'persona@example.com',
  telefono: '555-100-2000',
  direccion: 'Calle 1',
  fecha_registro: '2026-10-12T15:00:00.000Z',
  estado: 'activo',
};

// Prepara la sesión y una API simulada. `alCambiar` decide la respuesta de PATCH /auth/password.
function abrir(rol, { ruta = '/', alCambiar } = {}) {
  const cuenta = cuentaDe(rol);
  sessionStorage.setItem('gym_token', 'token-de-prueba');
  sessionStorage.setItem('gym_usuario', JSON.stringify(cuenta));
  const llamadas = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, opciones = {}) => {
      if (url === '/api/auth/me') return respuesta(200, cuenta);
      if (url === '/api/auth/password') {
        llamadas.push({ metodo: opciones.method, cuerpo: JSON.parse(opciones.body), cabeceras: opciones.headers });
        return alCambiar ? alCambiar() : respuesta(200, { message: 'Contraseña actualizada correctamente.' });
      }
      if (url === '/api/clientes/me') return respuesta(200, cliente);
      if (url === '/api/resumen') return respuesta(200, { clientes: { activos: 1 } });
      return respuesta(200, { data: [], page: 1, limit: 20, total: 0 });
    }),
  );
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
    </MemoryRouter>,
  );
  return llamadas;
}

async function abrirDesdeAvatar() {
  fireEvent.click(await screen.findByRole('button', { name: /menú de usuario/i }));
  fireEvent.click(screen.getByRole('menuitem', { name: /cambiar contraseña/i }));
  return screen.findByRole('dialog', { name: /cambiar contraseña/i });
}

function llenar({ actual = 'Secreta123', nueva = 'NuevaClave456', confirmacion = nueva } = {}) {
  fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: actual } });
  fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: nueva } });
  fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: confirmacion } });
}

const enviar = () => fireEvent.click(screen.getByRole('button', { name: /actualizar contraseña/i }));

describe('Cambiar contraseña', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  describe('acceso', () => {
    for (const rol of ROLES) {
      it(`el rol ${rol} la tiene en el menú del avatar`, async () => {
        abrir(rol);
        const dialogo = await abrirDesdeAvatar();
        expect(within(dialogo).getByLabelText('Contraseña actual')).toBeInTheDocument();
        expect(within(dialogo).getByLabelText('Nueva contraseña')).toBeInTheDocument();
        expect(within(dialogo).getByLabelText('Confirmar nueva contraseña')).toBeInTheDocument();
      });
    }

    it('el cliente también la tiene en la tarjeta "Mi cuenta", con su correo de acceso', async () => {
      abrir('cliente', { ruta: '/mi-perfil' });
      const cuenta = (await screen.findByRole('heading', { name: 'Mi cuenta' })).closest('.card');
      expect(within(cuenta).getByText('Correo de acceso')).toBeInTheDocument();
      expect(within(cuenta).getByText('persona@example.com')).toBeInTheDocument();

      fireEvent.click(within(cuenta).getByRole('button', { name: /cambiar contraseña/i }));
      expect(await screen.findByRole('dialog', { name: /cambiar contraseña/i })).toBeInTheDocument();
    });

    it('los campos son de tipo contraseña, con autocompletado adecuado y foco inicial', async () => {
      abrir('recepcionista');
      await abrirDesdeAvatar();
      const actual = screen.getByLabelText('Contraseña actual');
      expect(actual).toHaveAttribute('type', 'password');
      expect(actual).toHaveAttribute('autocomplete', 'current-password');
      expect(actual).toHaveFocus();
      expect(screen.getByLabelText('Nueva contraseña')).toHaveAttribute('autocomplete', 'new-password');
      expect(screen.getByLabelText('Nueva contraseña')).toHaveAccessibleDescription(/8 a 72 caracteres/i);
    });
  });

  describe('envío', () => {
    it('envía las tres contraseñas por PATCH, cierra el diálogo y avisa con un mensaje de éxito', async () => {
      const llamadas = abrir('entrenador');
      await abrirDesdeAvatar();
      llenar();
      enviar();

      expect(await screen.findByText('Contraseña actualizada correctamente.')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(llamadas).toHaveLength(1);
      expect(llamadas[0].metodo).toBe('PATCH');
      expect(llamadas[0].cuerpo).toEqual({
        password_actual: 'Secreta123',
        password_nueva: 'NuevaClave456',
        password_confirmacion: 'NuevaClave456',
      });
      expect(llamadas[0].cabeceras.Authorization).toBe('Bearer token-de-prueba');
    });

    it('no envía nada si faltan campos o la confirmación no coincide', async () => {
      const llamadas = abrir('recepcionista');
      await abrirDesdeAvatar();

      enviar();
      expect(screen.getByText('Escribe tu contraseña actual.')).toBeInTheDocument();
      expect(screen.getByText('Escribe la nueva contraseña.')).toBeInTheDocument();
      expect(screen.getByText('Confirma la nueva contraseña.')).toBeInTheDocument();

      llenar({ confirmacion: 'OtraClave789' });
      enviar();
      expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirmar nueva contraseña')).toHaveAttribute('aria-invalid', 'true');
      expect(llamadas).toHaveLength(0);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('muestra junto al campo el error de contraseña actual incorrecta y mantiene la sesión', async () => {
      abrir('recepcionista', {
        alCambiar: () =>
          respuesta(400, {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Revisa los datos enviados.',
              details: [{ field: 'password_actual', message: 'La contraseña actual no es correcta.' }],
            },
          }),
      });
      await abrirDesdeAvatar();
      llenar();
      enviar();

      expect(await screen.findByText('La contraseña actual no es correcta.')).toBeInTheDocument();
      expect(screen.getByLabelText('Contraseña actual')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(sessionStorage.getItem('gym_token')).toBe('token-de-prueba');
    });

    it('muestra el error de la política en el campo de la nueva contraseña', async () => {
      abrir('recepcionista', {
        alCambiar: () =>
          respuesta(400, {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Revisa los datos enviados.',
              details: [{ field: 'password_nueva', message: 'La nueva contraseña debe ser distinta de la actual.' }],
            },
          }),
      });
      await abrirDesdeAvatar();
      llenar({ actual: 'Secreta123', nueva: 'Secreta123' });
      enviar();

      expect(await screen.findByText('La nueva contraseña debe ser distinta de la actual.')).toBeInTheDocument();
      expect(screen.getByLabelText('Nueva contraseña')).toHaveAttribute('aria-invalid', 'true');
    });

    it('muestra un mensaje general si el servidor bloquea los intentos', async () => {
      abrir('recepcionista', {
        alCambiar: () =>
          respuesta(423, {
            error: { code: 'ACCOUNT_LOCKED', message: 'Demasiados intentos con la contraseña actual. Inténtalo de nuevo más tarde.' },
          }),
      });
      await abrirDesdeAvatar();
      llenar();
      enviar();

      expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos con la contraseña actual.');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('mientras se envía el botón queda en estado de carga y deshabilitado', async () => {
      let terminar;
      abrir('recepcionista', {
        alCambiar: () => new Promise((resolver) => (terminar = () => resolver(respuesta(200, { message: 'Contraseña actualizada correctamente.' })))),
      });
      await abrirDesdeAvatar();
      llenar();
      enviar();

      const boton = await screen.findByRole('button', { name: /procesando/i });
      expect(boton).toBeDisabled();
      expect(boton).toHaveAttribute('aria-busy', 'true');

      terminar();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });
  });

  describe('cerrar', () => {
    it('"Cancelar" y Escape cierran sin enviar nada, y al reabrir los campos están vacíos', async () => {
      const llamadas = abrir('administrador');
      await abrirDesdeAvatar();
      llenar();
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      await abrirDesdeAvatar();
      expect(screen.getByLabelText('Contraseña actual')).toHaveValue('');
      expect(screen.getByLabelText('Nueva contraseña')).toHaveValue('');
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(llamadas).toHaveLength(0);
    });
  });
});
