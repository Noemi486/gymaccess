import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

const cuenta = {
  id_usuario: 12,
  nombre: 'Cuenta de Ana',
  correo: 'ana@example.com',
  rol: 'cliente',
  estado: 'activo',
  id_cliente: 7,
  fecha_registro: '2026-10-01T10:00:00.000Z',
};

const propio = {
  id_cliente: 7,
  nombre: 'Ana',
  apellido: 'Propia',
  correo: 'ana@example.com',
  telefono: '555-100-2000',
  direccion: 'Calle Propia 10',
  fecha_registro: '2026-10-01T10:00:00.000Z',
  estado: 'activo',
};

// Inicia con la sesión de un cliente y una API simulada. Devuelve las URLs pedidas.
function abrir(ruta) {
  sessionStorage.setItem('gym_token', 'token-de-prueba');
  sessionStorage.setItem('gym_usuario', JSON.stringify(cuenta));
  const urls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      urls.push(url);
      if (url === '/api/auth/me') return respuesta(200, cuenta);
      if (url === '/api/clientes/me') return respuesta(200, propio);
      return respuesta(403, { error: { code: 'FORBIDDEN', message: 'No tienes permiso para realizar esta acción.' } });
    }),
  );
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
    </MemoryRouter>,
  );
  return urls;
}

describe('Mi información (rol cliente)', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('muestra solo los datos del cliente autenticado', async () => {
    const urls = abrir('/mi-perfil');

    expect(await screen.findByRole('heading', { name: /ana propia/i })).toBeInTheDocument();
    expect(screen.getByText('555 100 2000')).toBeInTheDocument(); // teléfono en grupos de 3 dígitos
    // El correo aparece en el perfil y como correo de acceso en la tarjeta "Mi cuenta".
    expect(screen.getAllByText('ana@example.com')).toHaveLength(2);
    expect(screen.getByText('Calle Propia 10')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    // Pide únicamente su propio recurso: nunca un id de otro cliente ni la lista.
    const pedidas = urls.filter((u) => u.startsWith('/api/clientes'));
    expect(pedidas).toEqual(['/api/clientes/me']);
  });

  it('no ofrece editar: el cliente solo consulta', async () => {
    abrir('/mi-perfil');
    await screen.findByRole('heading', { name: /ana propia/i });

    expect(screen.queryByRole('link', { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /guardar/i })).not.toBeInTheDocument();
  });

  it('el inicio solo ofrece "Mi información", sin listas de clientes ni usuarios', async () => {
    abrir('/');

    // "Mi información" aparece en el menú lateral y en el inicio; ambos llevan al mismo lugar.
    const enlaces = await screen.findAllByRole('link', { name: /mi información/i });
    expect(enlaces.length).toBeGreaterThan(0);
    for (const enlace of enlaces) expect(enlace).toHaveAttribute('href', '/mi-perfil');
    expect(screen.queryByRole('link', { name: /^clientes$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /consulta de clientes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /registrar cliente/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /usuarios/i })).not.toBeInTheDocument();
  });

  it('las pantallas del personal muestran "Sin permiso" y no consultan a otros clientes', async () => {
    for (const ruta of ['/clientes', '/clientes/5', '/clientes/nuevo', '/usuarios']) {
      sessionStorage.clear();
      const urls = abrir(ruta);
      expect((await screen.findAllByText(/sin permiso/i)).length).toBeGreaterThan(0);
      expect(urls.filter((u) => u.startsWith('/api/clientes') || u.startsWith('/api/usuarios'))).toEqual([]);
      document.body.innerHTML = '';
      vi.unstubAllGlobals();
    }
  });

  it('un cliente que abre la pantalla de otro rol no ve sus datos ni los de nadie más', async () => {
    abrir('/clientes/5');
    await screen.findAllByText(/sin permiso/i);
    expect(screen.queryByText('555-100-2000')).not.toBeInTheDocument();
  });
});
