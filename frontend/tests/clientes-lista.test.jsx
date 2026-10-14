import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import Clientes from '../src/pages/Clientes.jsx';

function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

const completo = (id, nombre) => ({
  id_cliente: id,
  nombre,
  apellido: 'Pérez',
  correo: `${nombre.toLowerCase()}@example.com`,
  telefono: `555-000-${id}`,
  direccion: `Calle ${id}`,
  fecha_registro: '2026-10-01T10:00:00.000Z',
  estado: id === 2 ? 'inactivo' : 'activo',
});
const basico = ({ id_cliente, nombre, apellido, fecha_registro, estado }) => ({
  id_cliente,
  nombre,
  apellido,
  fecha_registro,
  estado,
});

function usuarioConRol(rol) {
  return {
    id_usuario: 9,
    nombre: 'Persona de Prueba',
    correo: 'p@example.com',
    rol,
    estado: 'activo',
    id_cliente: null,
    fecha_registro: '2026-10-01T10:00:00.000Z',
  };
}

// Prepara una sesión del rol indicado y una API simulada. Devuelve las URLs pedidas.
function renderizar(rol, { total = 2, ruta = '/clientes' } = {}) {
  const usuario = usuarioConRol(rol);
  sessionStorage.setItem('gym_token', 'token-de-prueba');
  sessionStorage.setItem('gym_usuario', JSON.stringify(usuario));

  const completos = [completo(1, 'Ana'), completo(2, 'Beto')];
  const urls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      urls.push(url);
      if (url === '/api/auth/me') return respuesta(200, usuario);
      const data = rol === 'entrenador' ? completos.map(basico) : completos;
      return respuesta(200, { data, page: Number(new URL(url, 'http://x').searchParams.get('page') ?? 1), limit: 20, total });
    }),
  );

  render(
    <MemoryRouter initialEntries={[ruta]}>
      <AuthProvider>
        <Routes>
          <Route path="/clientes" element={<Clientes />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
  return urls;
}

describe('Clientes (lista)', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('para el entrenador oculta las columnas de contacto y no ofrece registrar ni editar', async () => {
    renderizar('entrenador');

    expect(await screen.findByText('Ana')).toBeInTheDocument();
    for (const columna of [/nombre/i, /apellido/i, /estado/i, /fecha de registro/i]) {
      expect(screen.getByRole('columnheader', { name: columna })).toBeInTheDocument();
    }
    for (const columna of [/teléfono/i, /correo/i, /dirección/i]) {
      expect(screen.queryByRole('columnheader', { name: columna })).not.toBeInTheDocument();
    }
    expect(screen.queryByText('555-000-1')).not.toBeInTheDocument();
    expect(screen.queryByText('ana@example.com')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /nuevo cliente/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /ver/i })).toHaveLength(2);
  });

  it('para el recepcionista muestra teléfono y correo, y permite registrar y editar', async () => {
    renderizar('recepcionista');

    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /teléfono/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /correo/i })).toBeInTheDocument();
    expect(screen.getByText('555-000-1')).toBeInTheDocument();
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nuevo cliente/i })).toHaveAttribute('href', '/clientes/nuevo');
    expect(screen.getAllByRole('link', { name: /editar/i })).toHaveLength(2);
  });

  it('muestra el estado de cada cliente con una insignia legible', async () => {
    renderizar('administrador');

    const filaBeto = (await screen.findByText('Beto')).closest('tr');
    expect(within(filaBeto).getByText('Inactivo')).toBeInTheDocument();
    const filaAna = screen.getByText('Ana').closest('tr');
    expect(within(filaAna).getByText('Activo')).toBeInTheDocument();
  });

  it('pagina: muestra "Página 1 de 3" y al pulsar Siguiente pide la página 2', async () => {
    const urls = renderizar('recepcionista', { total: 45 });

    expect(await screen.findByText(/página 1 de 3/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    expect(await screen.findByText(/página 2 de 3/i)).toBeInTheDocument();
    expect(urls.some((u) => u.startsWith('/api/clientes') && u.includes('page=2'))).toBe(true);
  });

  it('busca: envía el texto como q, vuelve a la página 1 y permite limpiar', async () => {
    const urls = renderizar('recepcionista', { total: 45 });
    await screen.findByText('Ana');

    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    await screen.findByText(/página 2 de 3/i);

    fireEvent.change(screen.getByLabelText(/buscar/i), { target: { value: ' Pérez ' } });
    fireEvent.click(screen.getByRole('button', { name: /^buscar$/i }));

    expect(await screen.findByText(/página 1 de 3/i)).toBeInTheDocument();
    const ultima = urls.filter((u) => u.startsWith('/api/clientes')).at(-1);
    expect(ultima).toContain('q=P%C3%A9rez');
    expect(ultima).toContain('page=1');
  });

  it('filtra por estado', async () => {
    const urls = renderizar('administrador');
    await screen.findByText('Ana');

    fireEvent.change(screen.getByLabelText(/^estado/i), { target: { value: 'inactivo' } });

    await screen.findByText('Ana');
    expect(urls.some((u) => u.includes('estado=inactivo'))).toBe(true);
  });
  it('aplica como búsqueda el texto de la URL (viene del buscador del inicio)', async () => {
    const urls = renderizar('recepcionista', { ruta: '/clientes?q=Ana%20Mar%C3%ADa' });

    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.getByLabelText(/buscar/i)).toHaveValue('Ana María');
    expect(urls.some((u) => u.startsWith('/api/clientes?') && u.includes('q=Ana+Mar%C3%ADa'))).toBe(true);
  });
});
