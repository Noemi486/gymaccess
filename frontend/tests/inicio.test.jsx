import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import App from '../src/App.jsx';
import { INDICADORES, indicadoresParaRol } from '../src/config/indicadores.js';
import { TARJETAS_CLIENTE, tarjetasClienteVisibles } from '../src/config/tarjetasCliente.js';
import { fechaDeHoy } from '../src/pages/Inicio.jsx';

function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

const cliente = (id, nombre, estado = 'activo') => ({
  id_cliente: id,
  nombre,
  apellido: 'Pérez',
  correo: `${nombre.toLowerCase()}@example.com`,
  telefono: `555-000-${id}`,
  direccion: null,
  fecha_registro: '2026-10-12T10:00:00.000Z',
  estado,
});

const RESUMENES = {
  administrador: {
    clientes: { activos: 40, inactivos: 7, registrados_mes: 12 },
    usuarios: { total: 9, por_rol: { administrador: 1, recepcionista: 3, entrenador: 2, cliente: 3 } },
    ultimos_clientes: [cliente(5, 'Elena'), cliente(4, 'Diego', 'inactivo'), cliente(3, 'Carla')],
  },
  recepcionista: {
    clientes: { activos: 40, registrados_hoy: 2 },
    ultimos_clientes: [cliente(5, 'Elena'), cliente(4, 'Diego')],
  },
  entrenador: { clientes: { activos: 40 } },
};

const propio = { ...cliente(7, 'Ana'), correo: 'ana@example.com' };

function cuentaDe(rol) {
  return {
    id_usuario: 9,
    nombre: rol === 'cliente' ? 'Cuenta de Ana' : 'Persona de Prueba',
    correo: 'p@example.com',
    rol,
    estado: 'activo',
    id_cliente: rol === 'cliente' ? 7 : null,
  };
}

// Muestra la ubicación actual para comprobar a dónde navega el buscador.
function Ubicacion() {
  const { pathname, search } = useLocation();
  return <p data-testid="ubicacion">{`${pathname}${search}`}</p>;
}

function abrir(rol, { resumen, falla = false } = {}) {
  const cuenta = cuentaDe(rol);
  sessionStorage.setItem('gym_token', 'token-de-prueba');
  sessionStorage.setItem('gym_usuario', JSON.stringify(cuenta));
  const urls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      urls.push(url);
      if (url === '/api/auth/me') return respuesta(200, cuenta);
      if (falla) return respuesta(500, { error: { code: 'INTERNAL', message: 'Algo salió mal. Intenta de nuevo.' } });
      if (url === '/api/resumen') return respuesta(200, resumen ?? RESUMENES[rol]);
      if (url === '/api/clientes/me') return respuesta(200, propio);
      return respuesta(200, { data: [], page: 1, limit: 20, total: 0 });
    }),
  );
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
      <Ubicacion />
    </MemoryRouter>,
  );
  return urls;
}

const principal = () => screen.getByRole('main');

describe('Inicio: panel de resumen', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('saluda con el nombre y la fecha de hoy', async () => {
    abrir('entrenador');
    expect(await screen.findByRole('heading', { name: /hola, persona de prueba/i })).toBeInTheDocument();
    expect(within(principal()).getByText(fechaDeHoy())).toBeInTheDocument();
  });

  it('no tiene tarjetas de acceso rápido: los enlaces del menú no se repiten en el contenido', async () => {
    abrir('administrador');
    await screen.findByText('Clientes activos');
    const contenido = within(principal());
    expect(contenido.queryByRole('link', { name: /^clientes$/i })).not.toBeInTheDocument();
    expect(contenido.queryByRole('link', { name: /usuarios y roles/i })).not.toBeInTheDocument();
  });

  describe('administrador', () => {
    it('ve el botón principal, 4 indicadores, los últimos clientes y los usuarios por rol', async () => {
      const urls = abrir('administrador');
      const contenido = within(principal());

      expect(await contenido.findByText('Clientes activos')).toBeInTheDocument();
      expect(contenido.getByRole('link', { name: /registrar cliente/i })).toHaveAttribute('href', '/clientes/nuevo');

      const valores = {
        'Clientes activos': '40',
        'Clientes inactivos': '7',
        'Registrados este mes': '12',
        'Usuarios del sistema': '9',
      };
      for (const [etiqueta, valor] of Object.entries(valores)) {
        expect(contenido.getByText(etiqueta).closest('.stat-card')).toHaveTextContent(valor);
      }
      expect(contenido.queryByText('Registrados hoy')).not.toBeInTheDocument();

      const ultimos = contenido.getByRole('table', { name: /últimos clientes registrados/i });
      expect(within(ultimos).getByRole('link', { name: 'Elena Pérez' })).toHaveAttribute('href', '/clientes/5');
      expect(within(ultimos).getByText('Inactivo')).toBeInTheDocument();
      expect(within(ultimos).getAllByRole('row')).toHaveLength(4); // encabezado + 3 clientes

      const porRol = contenido.getByRole('table', { name: /usuarios por rol/i });
      expect(within(porRol.querySelectorAll('tbody tr')[1]).getByText('Recepcionista')).toBeInTheDocument();
      expect(within(porRol).getByText('Cliente').closest('tr')).toHaveTextContent('3');

      expect(contenido.queryByRole('search')).not.toBeInTheDocument();
      expect(urls).toContain('/api/resumen');
    });

    it('sin clientes muestra un estado vacío que invita a registrar el primero', async () => {
      abrir('administrador', {
        resumen: {
          clientes: { activos: 0, inactivos: 0, registrados_mes: 0 },
          usuarios: { total: 1, por_rol: { administrador: 1, recepcionista: 0, entrenador: 0, cliente: 0 } },
          ultimos_clientes: [],
        },
      });
      expect(await screen.findByText('Aún no hay clientes registrados')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /registrar el primer cliente/i })).toHaveAttribute('href', '/clientes/nuevo');
    });
  });

  describe('recepcionista', () => {
    it('ve el botón, el buscador grande, activos, registrados hoy y los últimos clientes', async () => {
      abrir('recepcionista');
      const contenido = within(principal());

      expect(await contenido.findByText('Clientes activos')).toBeInTheDocument();
      expect(contenido.getByRole('link', { name: /registrar cliente/i })).toBeInTheDocument();
      expect(contenido.getByRole('search', { name: /buscar clientes/i })).toBeInTheDocument();
      expect(contenido.getByText('Registrados hoy').closest('.stat-card')).toHaveTextContent('2');
      expect(contenido.getByRole('table', { name: /últimos clientes registrados/i })).toBeInTheDocument();
      expect(contenido.queryByText('Usuarios del sistema')).not.toBeInTheDocument();
      expect(contenido.queryByRole('table', { name: /usuarios por rol/i })).not.toBeInTheDocument();
    });

    it('el buscador lleva a /clientes con el texto buscado', async () => {
      abrir('recepcionista');
      fireEvent.change(await screen.findByRole('searchbox', { name: /buscar clientes/i }), {
        target: { value: ' Ana María ' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
      expect(await screen.findByTestId('ubicacion')).toHaveTextContent('/clientes?q=Ana%20Mar%C3%ADa');
    });

    it('un buscador vacío lleva a la lista completa', async () => {
      abrir('recepcionista');
      await screen.findByRole('searchbox', { name: /buscar clientes/i });
      fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
      expect(await screen.findByTestId('ubicacion')).toHaveTextContent(/^\/clientes$/);
    });
  });

  describe('entrenador', () => {
    it('ve el buscador y los clientes activos, sin botón de registro ni listas', async () => {
      abrir('entrenador');
      const contenido = within(principal());

      expect(await contenido.findByText('Clientes activos')).toBeInTheDocument();
      expect(contenido.getByRole('search', { name: /buscar clientes/i })).toBeInTheDocument();
      expect(contenido.getByText('Clientes activos').closest('.stat-card')).toHaveTextContent('40');
      expect(contenido.queryByRole('link', { name: /registrar cliente/i })).not.toBeInTheDocument();
      expect(contenido.queryByRole('table')).not.toBeInTheDocument();
      expect(contenido.queryByText('Registrados hoy')).not.toBeInTheDocument();
    });
  });

  describe('cliente', () => {
    it('ve una tarjeta compacta: nombre completo, estado y correo, con el botón al detalle', async () => {
      const urls = abrir('cliente');
      const contenido = within(principal());

      expect(await contenido.findByRole('heading', { name: 'Mi información' })).toBeInTheDocument();
      const tarjeta = contenido.getByRole('heading', { name: 'Mi información' }).closest('.card');
      expect(within(tarjeta).getByText('Ana Pérez')).toBeInTheDocument();
      expect(within(tarjeta).getByText('Activo')).toBeInTheDocument();
      expect(within(tarjeta).getByText('ana@example.com')).toBeInTheDocument();
      expect(within(tarjeta).getByRole('link', { name: /ver mi información/i })).toHaveAttribute('href', '/mi-perfil');
      // Compacta: el teléfono, la dirección y la fecha de registro quedan para el detalle.
      expect(within(tarjeta).queryByText('555-000-7')).not.toBeInTheDocument();
      expect(within(tarjeta).queryByText(/teléfono|dirección|registrado/i)).not.toBeInTheDocument();

      expect(contenido.queryByRole('link', { name: /registrar cliente/i })).not.toBeInTheDocument();
      expect(contenido.queryByRole('search')).not.toBeInTheDocument();
      expect(contenido.queryByRole('table')).not.toBeInTheDocument();
      // Solo pide su propio recurso: nunca el resumen del personal ni la lista de clientes.
      expect(urls.filter((u) => u.startsWith('/api/resumen') || u === '/api/clientes')).toEqual([]);
    });

    it('un cliente sin correo ve un texto en su lugar', async () => {
      Object.assign(propio, { correo: null });
      abrir('cliente');
      expect(await screen.findByText('Sin correo registrado')).toBeInTheDocument();
      Object.assign(propio, { correo: 'ana@example.com' });
    });

    it('no muestra todavía las tarjetas de Sprint 2', async () => {
      abrir('cliente');
      await screen.findByRole('heading', { name: 'Mi información' });
      for (const titulo of ['Mi membresía', 'Acceso facial', 'Mis últimas visitas', 'Mis pagos']) {
        expect(screen.queryByText(titulo)).not.toBeInTheDocument();
      }
    });
  });

  it('si falla la carga muestra un aviso y conserva el saludo y el botón de registro', async () => {
    abrir('recepcionista', { falla: true });
    expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal. Intenta de nuevo.');
    expect(screen.getByRole('heading', { name: /hola, persona de prueba/i })).toBeInTheDocument();
    expect(within(principal()).getByRole('link', { name: /registrar cliente/i })).toBeInTheDocument();
  });
});

describe('Configuración de indicadores', () => {
  it('cada rol recibe solo sus indicadores disponibles', () => {
    expect(indicadoresParaRol('administrador').map((i) => i.id)).toEqual([
      'clientes-activos',
      'clientes-inactivos',
      'clientes-mes',
      'usuarios-sistema',
    ]);
    expect(indicadoresParaRol('recepcionista').map((i) => i.id)).toEqual(['clientes-activos', 'clientes-hoy']);
    expect(indicadoresParaRol('entrenador').map((i) => i.id)).toEqual(['clientes-activos']);
    expect(indicadoresParaRol('cliente')).toEqual([]);
  });

  it('deja reservados, sin mostrar, los indicadores de Sprint 2', () => {
    const reservados = INDICADORES.filter((i) => i.disponible === false).map((i) => i.id);
    expect(reservados).toEqual(['accesos-hoy', 'membresias-por-vencer']);
    for (const rol of ['administrador', 'recepcionista', 'entrenador', 'cliente']) {
      const visibles = indicadoresParaRol(rol).map((i) => i.id);
      expect(visibles).not.toContain('accesos-hoy');
      expect(visibles).not.toContain('membresias-por-vencer');
    }
  });

  it('activar un indicador reservado lo muestra sin más cambios', () => {
    const activados = INDICADORES.map((i) => (i.id === 'accesos-hoy' ? { ...i, disponible: true } : i));
    expect(indicadoresParaRol('recepcionista', activados).map((i) => i.id)).toContain('accesos-hoy');
  });
});

describe('Tarjetas del cliente reservadas para Sprint 2', () => {
  it('están declaradas pero ninguna se muestra todavía', () => {
    expect(TARJETAS_CLIENTE.map((t) => t.titulo)).toEqual([
      'Mi membresía',
      'Acceso facial',
      'Mis últimas visitas',
      'Mis pagos',
    ]);
    expect(TARJETAS_CLIENTE.every((t) => t.disponible === false && t.componente === null)).toBe(true);
    expect(tarjetasClienteVisibles()).toEqual([]);
  });

  it('una tarjeta se muestra solo si está disponible y tiene componente', () => {
    const Componente = () => null;
    const tarjetas = [
      { id: 'a', titulo: 'A', componente: Componente, disponible: true },
      { id: 'b', titulo: 'B', componente: Componente, disponible: false },
      { id: 'c', titulo: 'C', componente: null, disponible: true },
    ];
    expect(tarjetasClienteVisibles(tarjetas).map((t) => t.id)).toEqual(['a']);
  });
});
