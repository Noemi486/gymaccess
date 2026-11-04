import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor, configure } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { textoAviso } from '../src/utils/formato.js';

configure({ asyncUtilTimeout: 4000 });

function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

const AVISOS = [
  { id_membresia: 31, tipo: 'vencida', dias: -2, fecha_fin: '2026-11-02', plan: 'Mensual', cliente: { id_cliente: 7, nombre: 'Luis', apellido: 'Soto' } },
  { id_membresia: 32, tipo: 'por_vencer', dias: 0, fecha_fin: '2026-11-04', plan: 'Mensual', cliente: { id_cliente: 8, nombre: 'Ana', apellido: 'Ruiz' } },
  { id_membresia: 33, tipo: 'por_vencer', dias: 3, fecha_fin: '2026-11-07', plan: 'Trimestral', cliente: { id_cliente: 9, nombre: 'Eva', apellido: 'Paz' } },
];

// Abre una dirección sin datos propios (página "No encontrado") con la cuenta del rol, para revisar solo el encabezado.
function abrir(rol, responder = () => respuesta(200, { total: AVISOS.length, avisos: AVISOS })) {
  const cuenta = { id_usuario: 1, nombre: 'Noemi', correo: 'n@example.com', rol, estado: 'activo', id_cliente: rol === 'cliente' ? 9 : null };
  sessionStorage.setItem('gym_token', 'token-de-prueba');
  sessionStorage.setItem('gym_usuario', JSON.stringify(cuenta));
  const pedidas = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      if (url === '/api/auth/me') return respuesta(200, cuenta);
      if (url.startsWith('/api/avisos')) {
        pedidas.push(url);
        return responder(url);
      }
      return respuesta(404, { error: { code: 'NOT_FOUND', message: 'No existe.' } });
    }),
  );
  render(
    <MemoryRouter initialEntries={['/no-existe']}>
      <App />
    </MemoryRouter>,
  );
  return pedidas;
}

describe('textoAviso', () => {
  it('días que faltan, hoy y días desde que venció', () => {
    expect(textoAviso(3)).toBe('Vence en 3 días');
    expect(textoAviso(1)).toBe('Vence en 1 día');
    expect(textoAviso(0)).toBe('Vence hoy');
    expect(textoAviso(-1)).toBe('Venció hace 1 día');
    expect(textoAviso(-7)).toBe('Venció hace 7 días');
    expect(textoAviso('x')).toBe('');
  });
});

describe('Campana de avisos', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  for (const rol of ['administrador', 'recepcionista']) {
    it(`${rol}: campana con el número, lista con texto, insignia y enlace al detalle`, async () => {
      const pedidas = abrir(rol);
      const boton = await screen.findByRole('button', { name: 'Avisos: 3 avisos' });
      expect(within(boton).getByText('3')).toBeInTheDocument();
      expect(pedidas[0]).toBe('/api/avisos');

      fireEvent.click(boton);
      const panel = within(screen.getByRole('region', { name: 'Avisos de membresías' }));
      const enlaces = panel.getAllByRole('link');
      expect(enlaces).toHaveLength(3);
      expect(enlaces[0]).toHaveAttribute('href', '/clientes/7');
      expect(enlaces[0]).toHaveTextContent('Luis Soto');
      expect(panel.getByText('Venció hace 2 días')).toHaveClass('badge', 'badge-error');
      expect(panel.getByText('Vence hoy')).toHaveClass('badge-advertencia');
      expect(panel.getByText('Vence en 3 días')).toBeInTheDocument();
      expect(enlaces[2]).toHaveTextContent('Trimestral · fin: 7 nov 2026');
    });
  }

  it('cliente: ve su aviso sin enlace al detalle de clientes', async () => {
    abrir('cliente', () => respuesta(200, { total: 1, avisos: [AVISOS[2]] }));
    fireEvent.click(await screen.findByRole('button', { name: 'Avisos: 1 aviso' }));
    const panel = within(screen.getByRole('region', { name: 'Avisos de membresías' }));
    expect(panel.getByText('Vence en 3 días')).toBeInTheDocument();
    expect(panel.queryAllByRole('link')).toHaveLength(0);
    expect(panel.getByText(/Renueva en recepción/)).toBeInTheDocument();
  });

  it('entrenador: no ve la campana ni pide avisos', async () => {
    const pedidas = abrir('entrenador');
    expect(await screen.findByRole('button', { name: /Menú de usuario/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Avisos/ })).not.toBeInTheDocument();
    expect(pedidas).toHaveLength(0);
  });

  it('sin avisos: no muestra número y dice "No hay avisos"', async () => {
    abrir('administrador', () => respuesta(200, { total: 0, avisos: [] }));
    const boton = await screen.findByRole('button', { name: 'Avisos: sin avisos' });
    expect(boton.querySelector('.campana-numero')).toBeNull();
    fireEvent.click(boton);
    expect(screen.getByText('No hay avisos')).toBeInTheDocument();
  });

  it('error al cargar: el encabezado sigue funcionando y el panel lo explica', async () => {
    abrir('recepcionista', () => respuesta(500, { error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } }));
    const boton = await screen.findByRole('button', { name: 'Avisos: sin avisos' });
    fireEvent.click(boton);
    expect(await screen.findByText('No se pudieron cargar los avisos.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Menú de usuario/ })).toBeInTheDocument();
  });

  it('Escape cierra el panel y devuelve el foco a la campana', async () => {
    abrir('administrador');
    const boton = await screen.findByRole('button', { name: 'Avisos: 3 avisos' });
    fireEvent.click(boton);
    expect(screen.getByRole('region', { name: 'Avisos de membresías' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Avisos de membresías' })).not.toBeInTheDocument());
    expect(boton).toHaveFocus();
  });
});
