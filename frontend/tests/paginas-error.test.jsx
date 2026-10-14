import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

function cuentaDe(rol) {
  return { id_usuario: 9, nombre: 'Persona de Prueba', correo: 'p@example.com', rol, estado: 'activo', id_cliente: rol === 'cliente' ? 7 : null };
}

// Abre la aplicación en `ruta`. Con `rol` hay sesión; sin él, no. Devuelve las URLs de la API pedidas.
function abrir(ruta, rol) {
  const urls = [];
  if (rol) {
    const cuenta = cuentaDe(rol);
    sessionStorage.setItem('gym_token', 'token-de-prueba');
    sessionStorage.setItem('gym_usuario', JSON.stringify(cuenta));
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      urls.push(url);
      if (url === '/api/auth/me') return respuesta(200, cuentaDe(rol));
      if (url === '/api/resumen') return respuesta(200, { clientes: { activos: 1 }, ultimos_clientes: [] });
      if (url === '/api/clientes/me') return respuesta(200, { id_cliente: 7, nombre: 'Ana', apellido: 'Propia', estado: 'activo', fecha_registro: '2026-10-01T10:00:00.000Z' });
      return respuesta(200, { data: [], page: 1, limit: 20, total: 0 });
    }),
  );
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
    </MemoryRouter>,
  );
  return urls;
}

describe('Páginas "No encontrado" y "Sin permiso"', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  describe('No encontrado', () => {
    it('una dirección inexistente con sesión muestra la página dentro del marco común', async () => {
      abrir('/esto-no-existe', 'recepcionista');

      const pagina = await screen.findByRole('heading', { name: 'No encontrado' });
      expect(pagina).toBeInTheDocument();
      expect(screen.getByText('La página que buscas no existe o fue movida.')).toBeInTheDocument();
      // Dentro del Layout: menú lateral y encabezado visibles.
      expect(screen.getByRole('navigation', { name: /menú principal/i })).toBeInTheDocument();
      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('ofrece "Volver al inicio" que lleva a /', async () => {
      abrir('/otra/ruta/rara', 'cliente');
      await screen.findByRole('heading', { name: 'No encontrado' });
      expect(within(screen.getByRole('main')).getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
    });

    it('sin sesión una dirección inexistente lleva a /login', async () => {
      abrir('/esto-no-existe');
      expect(await screen.findByRole('heading', { name: 'Iniciar sesión en GymAccess' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'No encontrado' })).not.toBeInTheDocument();
    });

    it('funciona para los cuatro roles', async () => {
      for (const rol of ['administrador', 'recepcionista', 'entrenador', 'cliente']) {
        sessionStorage.clear();
        abrir('/nada-por-aqui', rol);
        expect(await screen.findByRole('heading', { name: 'No encontrado' }), rol).toBeInTheDocument();
        document.body.innerHTML = '';
        vi.unstubAllGlobals();
      }
    });
  });

  describe('Sin permiso', () => {
    it('un rol no permitido ve la página, no el contenido, ni consulta datos', async () => {
      const urls = abrir('/usuarios', 'recepcionista');

      expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeInTheDocument();
      expect(screen.getByText(/tu rol no puede ver esta página/i)).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Usuarios y roles' })).not.toBeInTheDocument();
      expect(urls.filter((u) => u.startsWith('/api/usuarios'))).toEqual([]);
      // También dentro del marco común.
      expect(screen.getByRole('navigation', { name: /menú principal/i })).toBeInTheDocument();
    });

    it('ofrece "Volver al inicio" que lleva a /', async () => {
      abrir('/clientes', 'cliente');
      await screen.findByRole('heading', { name: 'Sin permiso' });
      expect(within(screen.getByRole('main')).getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
    });

    it('se anuncia como alerta para los lectores de pantalla', async () => {
      abrir('/usuarios/nuevo', 'entrenador');
      expect(await screen.findByRole('alert')).toHaveTextContent('Sin permiso');
    });

    it('cada rol ve "Sin permiso" en las pantallas que no le corresponden', async () => {
      const casos = [
        ['recepcionista', '/usuarios'],
        ['entrenador', '/clientes/nuevo'],
        ['entrenador', '/usuarios/nuevo'],
        ['cliente', '/clientes'],
        ['cliente', '/clientes/5/editar'],
        ['administrador', '/mi-perfil'],
      ];
      for (const [rol, ruta] of casos) {
        sessionStorage.clear();
        abrir(ruta, rol);
        expect(await screen.findByRole('heading', { name: 'Sin permiso' }), `${rol} en ${ruta}`).toBeInTheDocument();
        document.body.innerHTML = '';
        vi.unstubAllGlobals();
      }
    });

    it('la ruta /sin-permiso muestra la misma página', async () => {
      abrir('/sin-permiso', 'administrador');
      expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeInTheDocument();
    });

    it('sin sesión lleva a /login (no a "Sin permiso")', async () => {
      abrir('/usuarios');
      expect(await screen.findByRole('heading', { name: 'Iniciar sesión en GymAccess' })).toBeInTheDocument();
    });
  });
});
