import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, configure } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

configure({ asyncUtilTimeout: 4000 });

function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

// Matriz del Anexo del spec 004: qué roles pueden abrir cada pantalla nueva del Sprint 3.
const PANTALLAS = {
  '/entrenadores': ['administrador', 'recepcionista'],
  '/entrenadores/nuevo': ['administrador'],
  '/entrenadores/7': ['administrador', 'recepcionista'],
  '/entrenadores/7/editar': ['administrador'],
  '/mis-clientes': ['entrenador'],
  '/mis-clientes/7': ['entrenador'],
  '/clientes/7/entrenamiento': ['administrador'],
  '/mi-entrenamiento': ['cliente'],
};
const ROLES = ['administrador', 'recepcionista', 'entrenador', 'cliente'];

// Abre `ruta` con la cuenta del rol (o sin sesión). Devuelve las URL de datos pedidas (todo menos /auth/me y /avisos).
function abrir(ruta, rol) {
  const pedidas = [];
  if (rol) {
    const cuenta = { id_usuario: 4, nombre: 'Persona', correo: 'p@example.com', rol, estado: 'activo', id_cliente: rol === 'cliente' ? 7 : null };
    sessionStorage.setItem('gym_token', 'token-de-prueba');
    sessionStorage.setItem('gym_usuario', JSON.stringify(cuenta));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url === '/api/auth/me') return respuesta(200, cuenta);
        // La campana del encabezado (US12) pide sus avisos en cualquier pantalla: no son datos de la pantalla.
        if (url === '/api/avisos') return respuesta(200, { total: 0, avisos: [] });
        pedidas.push(url);
        return respuesta(200, { data: [], page: 1, limit: 20, total: 0 });
      }),
    );
  } else {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        pedidas.push(url);
        return respuesta(401, { error: { code: 'UNAUTHORIZED', message: 'Inicia sesión.' } });
      }),
    );
  }
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
    </MemoryRouter>,
  );
  return pedidas;
}

describe('Permisos de las pantallas del Sprint 3 (spec 004, FR-020, SC-004)', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  for (const [ruta, permitidos] of Object.entries(PANTALLAS)) {
    for (const rol of ROLES.filter((r) => !permitidos.includes(r))) {
      it(`${rol} en ${ruta}: "Sin permiso" y ninguna petición de datos`, async () => {
        const pedidas = abrir(ruta, rol);
        expect(await screen.findByText('Sin permiso')).toBeInTheDocument();
        expect(pedidas).toEqual([]);
      });
    }

    it(`sin sesión, ${ruta} lleva a /login`, async () => {
      abrir(ruta, null);
      expect(await screen.findByRole('heading', { name: 'Iniciar sesión en GymAccess' })).toBeInTheDocument();
    });
  }
});
