import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Users } from 'lucide-react';
import { SECCIONES, menuParaRol, seccionDeRuta } from '../src/config/menu.js';
import Sidebar from '../src/components/ui/Sidebar.jsx';

// Secciones esperadas por rol (Anexo del spec), agrupadas por bloque.
const ESPERADO = {
  administrador: {
    General: ['Inicio'],
    Operación: ['Clientes', 'Accesos', 'Estación de acceso'],
    'Membresías y pagos': ['Tipos de membresía'],
    Administración: ['Usuarios y roles'],
  },
  recepcionista: {
    General: ['Inicio'],
    Operación: ['Clientes', 'Accesos', 'Estación de acceso'],
    'Membresías y pagos': ['Tipos de membresía'],
  },
  entrenador: { General: ['Inicio'], Operación: ['Clientes', 'Accesos'] },
  cliente: { General: ['Inicio', 'Mi información'] },
};

function comoObjeto(grupos) {
  return Object.fromEntries(grupos.map((g) => [g.bloque.etiqueta, g.secciones.map((s) => s.etiqueta)]));
}

describe('menuParaRol', () => {
  for (const [rol, esperado] of Object.entries(ESPERADO)) {
    it(`muestra exactamente las secciones del rol ${rol}, sin bloques vacíos`, () => {
      expect(comoObjeto(menuParaRol(rol))).toEqual(esperado);
    });
  }

  it('un rol desconocido no ve ninguna sección', () => {
    expect(menuParaRol('invitado')).toEqual([]);
  });

  it('agregar una entrada la muestra solo a sus roles', () => {
    const nueva = { id: 'pagos', etiqueta: 'Pagos', ruta: '/pagos', icono: Users, bloque: 'operacion', roles: ['recepcionista'] };
    const secciones = [...SECCIONES, nueva];
    expect(comoObjeto(menuParaRol('recepcionista', secciones)).Operación).toEqual(['Clientes', 'Accesos', 'Estación de acceso', 'Pagos']);
    expect(comoObjeto(menuParaRol('entrenador', secciones)).Operación).toEqual(['Clientes', 'Accesos']);
  });

  it('el bloque "Membresías y pagos" va entre Operación y Administración', () => {
    const orden = menuParaRol('administrador').map((g) => g.bloque.etiqueta);
    expect(orden).toEqual(['General', 'Operación', 'Membresías y pagos', 'Administración']);
  });
});

describe('Sidebar', () => {
  function abrir(rol, ruta) {
    render(
      <MemoryRouter initialEntries={[ruta]}>
        <Sidebar grupos={menuParaRol(rol)} />
      </MemoryRouter>,
    );
    return screen.getByRole('navigation', { name: /menú principal/i });
  }

  it('muestra el logotipo, los encabezados de bloque y solo las opciones del rol', () => {
    const menu = abrir('recepcionista', '/');
    expect(screen.getByText('GymAccess')).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Operación')).toBeInTheDocument();
    expect(screen.getByText('Membresías y pagos')).toBeInTheDocument();
    expect(screen.queryByText('Administración')).not.toBeInTheDocument();
    expect(within(menu).getAllByRole('link').map((a) => a.textContent)).toEqual(['Inicio', 'Clientes', 'Accesos', 'Estación de acceso', 'Tipos de membresía']);
  });

  it('marca como activa solo la sección actual', () => {
    const menu = abrir('administrador', '/clientes/nuevo');
    const activos = within(menu).getAllByRole('link', { current: 'page' });
    expect(activos).toHaveLength(1);
    expect(activos[0]).toHaveTextContent('Clientes');
  });

  it('en el inicio solo "Inicio" está activa', () => {
    const menu = abrir('administrador', '/');
    const activos = within(menu).getAllByRole('link', { current: 'page' });
    expect(activos.map((a) => a.textContent)).toEqual(['Inicio']);
  });
});

// ---------------------------------------------------------------------------------------------
// Menú ocultable en pantallas pequeñas (< 1024 px). El ocultamiento visual lo hace el CSS; aquí se
// prueba el estado, la accesibilidad (aria) y el comportamiento al abrir y cerrar.
// ---------------------------------------------------------------------------------------------
import { afterEach, beforeEach, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import App from '../src/App.jsx';

function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

describe('Menú lateral ocultable', () => {
  const cuenta = { id_usuario: 3, nombre: 'Rita Recepción', correo: 'rita@example.com', rol: 'recepcionista', estado: 'activo', id_cliente: null };

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('gym_token', 'token-de-prueba');
    sessionStorage.setItem('gym_usuario', JSON.stringify(cuenta));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url === '/api/auth/me') return respuesta(200, cuenta);
        if (url === '/api/resumen') return respuesta(200, { clientes: { activos: 1, registrados_hoy: 0 }, ultimos_clientes: [] });
        return respuesta(200, { data: [], page: 1, limit: 20, total: 0 });
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  function abrirApp(ruta = '/') {
    render(
      <MemoryRouter initialEntries={[ruta]}>
        <App />
      </MemoryRouter>,
    );
  }

  const botonMenu = () => screen.getByRole('button', { name: /menú de navegación|abrir menú|cerrar menú/i });
  const sidebar = () => document.getElementById('menu-lateral');

  it('el botón de menú empieza cerrado y apunta al menú con aria-controls', async () => {
    abrirApp();
    await screen.findByRole('banner');
    expect(botonMenu()).toHaveAttribute('aria-expanded', 'false');
    expect(botonMenu()).toHaveAttribute('aria-controls', 'menu-lateral');
    expect(botonMenu()).toHaveAccessibleName('Abrir menú');
    expect(sidebar()).not.toHaveClass('sidebar-abierto');
    expect(document.querySelector('.sidebar-fondo')).not.toBeInTheDocument();
  });

  it('el botón abre el panel (aria-expanded, clase y fondo) y vuelve a cerrarlo', async () => {
    abrirApp();
    await screen.findByRole('banner');

    fireEvent.click(botonMenu());
    expect(botonMenu()).toHaveAttribute('aria-expanded', 'true');
    expect(botonMenu()).toHaveAccessibleName('Cerrar menú');
    expect(sidebar()).toHaveClass('sidebar-abierto');
    expect(document.querySelector('.sidebar-fondo')).toBeInTheDocument();

    fireEvent.click(botonMenu());
    expect(sidebar()).not.toHaveClass('sidebar-abierto');
    expect(botonMenu()).toHaveAttribute('aria-expanded', 'false');
  });

  it('al abrir, el foco pasa a la primera opción del menú', async () => {
    abrirApp();
    await screen.findByRole('banner');
    fireEvent.click(botonMenu());
    expect(within(sidebar()).getByRole('link', { name: 'Inicio' })).toHaveFocus();
  });

  it('elegir una sección cierra el menú y navega', async () => {
    abrirApp();
    await screen.findByRole('banner');
    fireEvent.click(botonMenu());

    fireEvent.click(within(sidebar()).getByRole('link', { name: 'Clientes' }));

    expect(sidebar()).not.toHaveClass('sidebar-abierto');
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toHaveTextContent('Clientes');
  });

  it('Escape cierra el menú y devuelve el foco al botón', async () => {
    abrirApp();
    await screen.findByRole('banner');
    fireEvent.click(botonMenu());

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(sidebar()).not.toHaveClass('sidebar-abierto');
    expect(botonMenu()).toHaveFocus();
  });

  it('pulsar el fondo oscuro cierra el menú y devuelve el foco al botón', async () => {
    abrirApp();
    await screen.findByRole('banner');
    fireEvent.click(botonMenu());

    fireEvent.click(document.querySelector('.sidebar-fondo'));

    expect(sidebar()).not.toHaveClass('sidebar-abierto');
    expect(document.querySelector('.sidebar-fondo')).not.toBeInTheDocument();
    expect(botonMenu()).toHaveFocus();
  });

  it('Escape con el menú cerrado no hace nada', async () => {
    abrirApp();
    await screen.findByRole('banner');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(sidebar()).not.toHaveClass('sidebar-abierto');
    expect(botonMenu()).not.toHaveFocus();
  });
});
