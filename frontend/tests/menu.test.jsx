import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Users } from 'lucide-react';
import { SECCIONES, menuParaRol, seccionDeRuta } from '../src/config/menu.js';
import Sidebar from '../src/components/ui/Sidebar.jsx';

// Secciones esperadas por rol (Anexo del spec), agrupadas por bloque.
const ESPERADO = {
  administrador: { General: ['Inicio'], Operación: ['Clientes'], Administración: ['Usuarios y roles'] },
  recepcionista: { General: ['Inicio'], Operación: ['Clientes'] },
  entrenador: { General: ['Inicio'], Operación: ['Clientes'] },
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
    expect(comoObjeto(menuParaRol('recepcionista', secciones)).Operación).toEqual(['Clientes', 'Pagos']);
    expect(comoObjeto(menuParaRol('entrenador', secciones)).Operación).toEqual(['Clientes']);
  });

  it('no incluye todavía las secciones de Sprint 2', () => {
    const etiquetas = SECCIONES.map((s) => s.etiqueta);
    for (const futura of ['Membresías', 'Pagos', 'Control de acceso']) {
      expect(etiquetas).not.toContain(futura);
    }
  });
});

describe('seccionDeRuta', () => {
  it('encuentra la sección por prefijo y "/" solo coincide exacto', () => {
    expect(seccionDeRuta('/')?.id).toBe('inicio');
    expect(seccionDeRuta('/clientes/nuevo')?.id).toBe('clientes');
    expect(seccionDeRuta('/clientes/7/editar')?.id).toBe('clientes');
    expect(seccionDeRuta('/usuarios')?.id).toBe('usuarios');
    expect(seccionDeRuta('/no-existe')).toBeNull();
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
    expect(screen.queryByText('Administración')).not.toBeInTheDocument();
    expect(within(menu).getAllByRole('link').map((a) => a.textContent)).toEqual(['Inicio', 'Clientes']);
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
