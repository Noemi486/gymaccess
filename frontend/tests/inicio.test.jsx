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

// Proyección del entrenador: solo id, nombre, apellido, estado y fecha de registro.
const basico = (id, nombre, estado) => ({
  id_cliente: id,
  nombre,
  apellido: 'Pérez',
  estado,
  fecha_registro: '2026-10-12T10:00:00.000Z',
});

const RESUMENES = {
  administrador: {
    clientes: { activos: 40, inactivos: 7, registrados_mes: 12 },
    accesos: { hoy: 25 },
    membresias: { por_vencer: 4 },
    usuarios: { total: 9, por_rol: { administrador: 1, recepcionista: 3, entrenador: 2, cliente: 3 } },
    ultimos_clientes: [cliente(5, 'Elena'), cliente(4, 'Diego', 'inactivo'), cliente(3, 'Carla')],
  },
  recepcionista: {
    clientes: { activos: 40, registrados_hoy: 2 },
    accesos: { hoy: 25 },
    membresias: { por_vencer: 4 },
    ultimos_clientes: [cliente(5, 'Elena'), cliente(4, 'Diego')],
  },
  entrenador: {
    clientes: { activos: 40, nuevos_7_dias: 6 },
    accesos: {
      clientes_hoy: 2,
      ultimos: [
        { id_cliente: 3, nombre: 'Carla', apellido: 'Pérez', hora: '18:05:00' },
        { id_cliente: 5, nombre: 'Elena', apellido: 'Pérez', hora: '07:40:00' },
      ],
    },
    ultimos_clientes: [
      basico(5, 'Elena', 'activo'),
      basico(4, 'Diego', 'inactivo'),
      basico(3, 'Carla', 'activo'),
    ],
  },
};

const propio = { ...cliente(7, 'Ana'), correo: 'ana@example.com' };

// Resumen propio del cliente (GET /api/clientes/me/resumen) para sus tarjetas del Sprint 2.
const RESUMEN_CLIENTE = {
  membresia: {
    id_membresia: 12,
    id_cliente: 7,
    tipo: { id_tipo_membresia: 2, nombre: 'Plan Mensual', duracion: 30 },
    fecha_inicio: '2026-10-08',
    fecha_fin: '2026-11-06',
    estado: 'vigente',
    dias_restantes: 3,
    por_vencer: true,
    precio: 450,
    adeudo: 0,
    pago: { id_pago: 31, fecha_pago: '2026-10-08T16:02:11.000Z', metodo_pago: 'efectivo', monto: 450 },
  },
  rostro: { registrado: true, fecha_registro: '2026-10-08T15:00:00.000Z' },
  visitas: [
    { fecha: '2026-11-03', hora: '07:15:02', resultado: 'autorizado', motivo_rechazo: null },
    { fecha: '2026-11-02', hora: '18:40:00', resultado: 'rechazado', motivo_rechazo: 'Rostro no reconocido' },
  ],
  pagos: [{ fecha_pago: '2026-10-08T16:02:11.000Z', monto: 450, metodo_pago: 'efectivo', plan: 'Plan Mensual' }],
  adeudo: null,
};
const RESUMEN_CLIENTE_VACIO = { membresia: null, rostro: { registrado: false, fecha_registro: null }, visitas: [], pagos: [], adeudo: null };

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

function abrir(rol, { resumen, falla = false, resumenCliente = RESUMEN_CLIENTE, fallaTarjetas = false } = {}) {
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
      if (url === '/api/clientes/me/resumen') {
        return fallaTarjetas ? respuesta(500, { error: { code: 'INTERNAL', message: 'Error.' } }) : respuesta(200, resumenCliente);
      }
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
    it('ve el botón principal, 6 indicadores (con los de Sprint 2), los últimos clientes y los usuarios por rol', async () => {
      const urls = abrir('administrador');
      const contenido = within(principal());

      expect(await contenido.findByText('Clientes activos')).toBeInTheDocument();
      expect(contenido.getByRole('link', { name: /registrar cliente/i })).toHaveAttribute('href', '/clientes/nuevo');

      const valores = {
        'Clientes activos': '40',
        'Clientes inactivos': '7',
        'Registrados este mes': '12',
        'Usuarios del sistema': '9',
        'Accesos de hoy': '25',
        'Membresías por vencer': '4',
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
      expect(contenido.getByText('Accesos de hoy').closest('.stat-card')).toHaveTextContent('25');
      expect(contenido.getByText('Membresías por vencer').closest('.stat-card')).toHaveTextContent('4');
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
    it('ve el saludo con fecha, el buscador, tres indicadores y la lista de clientes nuevos', async () => {
      const urls = abrir('entrenador');
      const contenido = within(principal());

      expect(await contenido.findByText('Clientes activos')).toBeInTheDocument();
      expect(contenido.getByRole('search', { name: /buscar clientes/i })).toBeInTheDocument();
      expect(contenido.getByPlaceholderText('Nombre o apellido')).toBeInTheDocument();
      expect(contenido.getByText('Clientes activos').closest('.stat-card')).toHaveTextContent('40');
      expect(contenido.getByText('Clientes nuevos (7 días)').closest('.stat-card')).toHaveTextContent('6');
      expect(contenido.getByText('Clientes que entraron hoy', { selector: '.stat-etiqueta' }).closest('.stat-card')).toHaveTextContent('2');
      expect(principal().querySelectorAll('.stat-card')).toHaveLength(3);
      expect(contenido.getByText(fechaDeHoy())).toBeInTheDocument();

      expect(contenido.queryByRole('link', { name: /registrar cliente/i })).not.toBeInTheDocument();
      expect(contenido.queryByRole('table')).not.toBeInTheDocument();
      expect(contenido.queryByText('Registrados hoy')).not.toBeInTheDocument();
      expect(contenido.queryByText('Usuarios del sistema')).not.toBeInTheDocument();
      expect(urls).toContain('/api/resumen');
    });

    it('la lista "Clientes nuevos" muestra avatar, nombre completo, estado y fecha de registro', async () => {
      abrir('entrenador');
      const lista = (await screen.findByRole('heading', { name: 'Clientes nuevos' })).closest('.card');
      const filas = within(lista).getAllByRole('listitem');
      expect(filas).toHaveLength(3);

      const primera = within(filas[0]);
      expect(primera.getByText('EP')).toHaveClass('avatar');
      expect(primera.getByRole('link', { name: 'Elena Pérez' })).toHaveAttribute('href', '/clientes/5');
      expect(primera.getByText('Activo')).toBeInTheDocument();
      expect(primera.getByText('12 oct 2026')).toBeInTheDocument();
      expect(within(filas[1]).getByText('Inactivo')).toBeInTheDocument();
    });

    it('nunca muestra teléfono, correo, dirección ni información financiera', async () => {
      abrir('entrenador');
      await screen.findByRole('heading', { name: 'Clientes nuevos' });
      const texto = principal().textContent.toLowerCase();

      for (const dato of ['555-000', '@example.com', 'calle', 'teléfono', 'correo', 'dirección']) {
        expect(texto).not.toContain(dato);
      }
      for (const financiero of ['pagos', 'adeudo', 'ingresos', 'monto', '$']) {
        expect(texto).not.toContain(financiero);
      }
    });

    it('el buscador lleva a /clientes con el texto buscado', async () => {
      abrir('entrenador');
      fireEvent.change(await screen.findByRole('searchbox', { name: /buscar clientes/i }), { target: { value: 'Pérez' } });
      fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
      expect(await screen.findByTestId('ubicacion')).toHaveTextContent('/clientes?q=P%C3%A9rez');
    });

    it('lista "Clientes que entraron hoy": avatar, nombre completo y hora, sin datos de contacto', async () => {
      abrir('entrenador');
      const lista = await screen.findByRole('list', { name: 'Clientes que entraron hoy' });
      const filas = within(lista).getAllByRole('listitem');
      expect(filas).toHaveLength(2);
      expect(within(filas[0]).getByText('CP')).toHaveClass('avatar');
      expect(within(filas[0]).getByRole('link', { name: 'Carla Pérez' })).toHaveAttribute('href', '/clientes/3');
      expect(filas[0]).toHaveTextContent('18:05');
    });

    it('sin clientes nuevos muestra un estado vacío', async () => {
      abrir('entrenador', { resumen: { clientes: { activos: 0, nuevos_7_dias: 0 }, ultimos_clientes: [] } });
      expect(await screen.findByText('Aún no hay clientes nuevos')).toBeInTheDocument();
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

    it('ve sus 4 tarjetas del Sprint 2 en orden, con datos propios', async () => {
      const urls = abrir('cliente');
      expect(await screen.findByRole('heading', { name: 'Mi membresía' })).toBeInTheDocument();
      const titulos = [...principal().querySelectorAll('.inicio-cliente-panel .card-titulo')].map((h) => h.textContent);
      expect(titulos).toEqual(['Mi membresía', 'Acceso facial', 'Mis últimas visitas', 'Mis pagos']);
      expect(urls).toContain('/api/clientes/me/resumen');

      const membresia = screen.getByRole('heading', { name: 'Mi membresía' }).closest('.card');
      expect(membresia).toHaveTextContent('Plan Mensual');
      expect(within(membresia).getByText('Por vencer')).toHaveClass('badge');
      expect(membresia).toHaveTextContent('Vence en 3 días');
      expect(within(membresia).getByRole('progressbar')).toHaveClass('barra-advertencia');

      const facial = screen.getByRole('heading', { name: 'Acceso facial' }).closest('.card');
      expect(within(facial).getByText('Registrado')).toHaveClass('badge');
      expect(facial.textContent).not.toMatch(/descriptor/i);

      const visitas = within(screen.getByRole('list', { name: 'Mis últimas visitas' })).getAllByRole('listitem');
      expect(visitas).toHaveLength(2);
      expect(visitas[1]).toHaveTextContent('Rostro no reconocido');

      const pagos = screen.getByRole('heading', { name: 'Mis pagos' }).closest('.card');
      expect(within(pagos).getByText('Sin adeudo')).toHaveClass('badge');
      expect(pagos).toHaveTextContent('$450.00');
    });

    it('barra verde con más de 5 días y roja cuando ya venció', async () => {
      abrir('cliente', {
        resumenCliente: { ...RESUMEN_CLIENTE, membresia: { ...RESUMEN_CLIENTE.membresia, dias_restantes: 20, por_vencer: false } },
      });
      expect(await screen.findByRole('progressbar')).toHaveClass('barra-exito');
      expect(screen.getByText('Vence en 20 días')).toBeInTheDocument();
    });

    it('membresía vencida: barra roja y "Vencida hace N días"', async () => {
      abrir('cliente', {
        resumenCliente: { ...RESUMEN_CLIENTE, membresia: { ...RESUMEN_CLIENTE.membresia, estado: 'vencida', dias_restantes: -2, por_vencer: false } },
      });
      expect(await screen.findByRole('progressbar')).toHaveClass('barra-error');
      expect(screen.getByText('Vencida hace 2 días')).toBeInTheDocument();
    });

    it('pendiente de pago: aviso amarillo con el monto y sin barra', async () => {
      abrir('cliente', {
        resumenCliente: {
          ...RESUMEN_CLIENTE,
          membresia: { ...RESUMEN_CLIENTE.membresia, estado: 'pendiente_de_pago', por_vencer: false, adeudo: 450, pago: null },
          adeudo: { monto: 450, plan: 'Plan Mensual' },
        },
      });
      const membresia = (await screen.findByRole('heading', { name: 'Mi membresía' })).closest('.card');
      expect(within(membresia).getByText('Pendiente de pago')).toHaveClass('badge');
      expect(membresia).toHaveTextContent('debes $450.00');
      expect(within(membresia).queryByRole('progressbar')).not.toBeInTheDocument();
      const pagos = screen.getByRole('heading', { name: 'Mis pagos' }).closest('.card');
      expect(pagos).toHaveTextContent('Debes $450.00');
    });

    it('sin membresía, rostro, visitas ni pagos: estados vacíos claros', async () => {
      abrir('cliente', { resumenCliente: RESUMEN_CLIENTE_VACIO });
      expect(await screen.findByText('Aún no tienes una membresía')).toBeInTheDocument();
      expect(screen.getByText('No registrado')).toBeInTheDocument();
      expect(screen.getByText('Pide a recepción que registre tu rostro.')).toBeInTheDocument();
      expect(screen.getByText('Aún no tienes visitas registradas')).toBeInTheDocument();
      expect(screen.getByText('Aún no tienes pagos registrados')).toBeInTheDocument();
    });

    it('si falla el resumen de las tarjetas, avisa y conserva "Mi información"', async () => {
      abrir('cliente', { fallaTarjetas: true });
      expect(await screen.findByText(/No se pudo cargar tu membresía/)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Mi información' })).toBeInTheDocument();
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
      'accesos-hoy',
      'membresias-por-vencer',
    ]);
    expect(indicadoresParaRol('recepcionista').map((i) => i.id)).toEqual([
      'clientes-activos',
      'clientes-hoy',
      'accesos-hoy',
      'membresias-por-vencer',
    ]);
    expect(indicadoresParaRol('entrenador').map((i) => i.id)).toEqual(['clientes-activos', 'clientes-7-dias', 'clientes-entraron-hoy']);
    expect(indicadoresParaRol('cliente')).toEqual([]);
  });

  it('los indicadores del Sprint 2 ya están disponibles (ninguno queda reservado)', () => {
    expect(INDICADORES.filter((i) => i.disponible === false)).toEqual([]);
    expect(indicadoresParaRol('cliente')).toEqual([]);
  });

  it('un indicador con disponible: false no se muestra', () => {
    const ocultos = INDICADORES.map((i) => (i.id === 'accesos-hoy' ? { ...i, disponible: false } : i));
    expect(indicadoresParaRol('recepcionista', ocultos).map((i) => i.id)).not.toContain('accesos-hoy');
  });
});

describe('Tarjetas del cliente del Sprint 2', () => {
  it('las 4 están disponibles, con componente y en orden', () => {
    expect(TARJETAS_CLIENTE.map((t) => t.titulo)).toEqual([
      'Mi membresía',
      'Acceso facial',
      'Mis últimas visitas',
      'Mis pagos',
    ]);
    expect(TARJETAS_CLIENTE.every((t) => t.disponible === true && typeof t.componente === 'function')).toBe(true);
    expect(tarjetasClienteVisibles().map((t) => t.id)).toEqual(['mi-membresia', 'acceso-facial', 'mis-visitas', 'mis-pagos']);
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
