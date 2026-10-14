import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Topbar, { iniciales } from '../src/components/ui/Topbar.jsx';
import App from '../src/App.jsx';

function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

describe('iniciales', () => {
  it('toma la primera letra de las dos primeras palabras', () => {
    expect(iniciales('Rita Recepción')).toBe('RR');
    expect(iniciales('  ana   maría  pérez ')).toBe('AM');
    expect(iniciales('Beto')).toBe('B');
    expect(iniciales('')).toBe('?');
  });
});

describe('Topbar', () => {
  const usuario = { nombre: 'Rita Recepción', rol: 'recepcionista' };

  function abrir(props = {}) {
    const alCerrar = vi.fn();
    render(<Topbar titulo="Clientes" usuario={usuario} onCerrarSesion={alCerrar} {...props} />);
    return alCerrar;
  }

  it('muestra el título, el avatar con iniciales, el nombre y el rol en español', () => {
    abrir();
    expect(screen.getByText('Clientes')).toBeInTheDocument();
    expect(screen.getByText('RR')).toBeInTheDocument();
    const boton = screen.getByRole('button', { name: /menú de usuario/i });
    expect(boton).toHaveAccessibleName(/Rita Recepción, Recepcionista/);
    expect(boton).toHaveAttribute('aria-expanded', 'false');
  });

  it('el menú de usuario empieza cerrado y se abre con el avatar', () => {
    abrir();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /menú de usuario/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /menú de usuario/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: /cerrar sesión/i })).toBeInTheDocument();
  });

  it('Escape y pulsar fuera cierran el menú', () => {
    abrir();
    const abrirMenu = () => fireEvent.click(screen.getByRole('button', { name: /menú de usuario/i }));
    abrirMenu();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    abrirMenu();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('"Cerrar sesión" llama a la acción y cierra el menú', () => {
    const alCerrar = abrir();
    fireEvent.click(screen.getByRole('button', { name: /menú de usuario/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /cerrar sesión/i }));
    expect(alCerrar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('un nombre largo usa la clase que lo recorta sin romper el diseño', () => {
    abrir({ usuario: { nombre: 'Maximiliano de la Santísima Trinidad Fernández', rol: 'administrador' } });
    expect(document.querySelector('.menu-usuario-nombre')).toBeInTheDocument();
    expect(screen.getByText('MD')).toBeInTheDocument();
  });
});

describe('Encabezado dentro de la aplicación', () => {
  const cuenta = { id_usuario: 2, nombre: 'Rita Recepción', correo: 'rita@example.com', rol: 'recepcionista', estado: 'activo', id_cliente: null };

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('gym_token', 'token-de-prueba');
    sessionStorage.setItem('gym_usuario', JSON.stringify(cuenta));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url === '/api/auth/me') return respuesta(200, cuenta);
        return respuesta(200, { data: [], page: 1, limit: 20, total: 0 });
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  function abrirApp(ruta) {
    render(
      <MemoryRouter initialEntries={[ruta]}>
        <App />
      </MemoryRouter>,
    );
  }

  it('el título cambia según la sección, también en subpantallas', async () => {
    abrirApp('/clientes/nuevo');
    expect(await screen.findByRole('banner')).toHaveTextContent('Clientes');
  });

  it('en el inicio el título es "Inicio"', async () => {
    abrirApp('/');
    expect(await screen.findByRole('banner')).toHaveTextContent('Inicio');
  });

  it('cerrar sesión desde el menú de usuario regresa al inicio de sesión', async () => {
    abrirApp('/');
    fireEvent.click(await screen.findByRole('button', { name: /menú de usuario/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /cerrar sesión/i }));
    expect(await screen.findByRole('button', { name: /iniciar sesión|entrar/i })).toBeInTheDocument();
    expect(sessionStorage.getItem('gym_token')).toBeNull();
  });
});
