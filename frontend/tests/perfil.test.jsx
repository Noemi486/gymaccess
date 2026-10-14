import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

const completo = {
  id_cliente: 7,
  nombre: 'Ana',
  apellido: 'Propia',
  correo: 'ana@example.com',
  telefono: '555-100-2000',
  direccion: null,
  fecha_registro: '2026-10-12T15:00:00.000Z',
  estado: 'activo',
};
const basico = {
  id_cliente: 7,
  nombre: 'Ana',
  apellido: 'Propia',
  fecha_registro: completo.fecha_registro,
  estado: 'inactivo',
};

function abrir(rol, ruta, cliente) {
  const cuenta = {
    id_usuario: 9,
    nombre: 'Persona de Prueba',
    correo: 'p@example.com',
    rol,
    estado: 'activo',
    id_cliente: rol === 'cliente' ? 7 : null,
  };
  sessionStorage.setItem('gym_token', 'token-de-prueba');
  sessionStorage.setItem('gym_usuario', JSON.stringify(cuenta));
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      if (url === '/api/auth/me') return respuesta(200, cuenta);
      if (url === '/api/clientes/me' || url === '/api/clientes/7') return respuesta(200, cliente);
      return respuesta(404, { error: { code: 'NOT_FOUND', message: 'No se encontró el recurso.' } });
    }),
  );
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
    </MemoryRouter>,
  );
}

const principal = () => screen.getByRole('main');

describe('Perfil de cliente', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  describe('Mi información', () => {
    it('muestra el encabezado: avatar de iniciales, nombre, estado y "Cliente desde"', async () => {
      abrir('cliente', '/mi-perfil', completo);
      const contenido = within(principal());

      expect(await contenido.findByRole('heading', { name: 'Ana Propia' })).toBeInTheDocument();
      expect(contenido.getByText('AP')).toHaveClass('avatar-grande');
      expect(contenido.getByText('Activo')).toBeInTheDocument();
      expect(contenido.getByText(/^Cliente desde 12 de octubre de 2026$/)).toBeInTheDocument();
    });

    it('muestra los datos con su etiqueta e ícono, y "—" si no hay valor', async () => {
      abrir('cliente', '/mi-perfil', completo);
      const contenido = within(principal());
      await contenido.findByRole('heading', { name: 'Ana Propia' });

      const etiquetas = contenido.getAllByRole('term').map((dt) => dt.textContent);
      expect(etiquetas).toEqual(['Teléfono', 'Correo', 'Dirección']);
      expect(contenido.getByText('555-100-2000')).toBeInTheDocument();
      expect(contenido.getByText('ana@example.com')).toBeInTheDocument();
      expect(contenido.getByText('Dirección').closest('.perfil-dato')).toHaveTextContent('—');
      // Cada dato lleva un ícono decorativo.
      expect(document.querySelectorAll('.perfil-dato .perfil-dato-icono svg')).toHaveLength(3);
    });

    it('incluye el aviso de ayuda en una caja informativa con ícono', async () => {
      abrir('cliente', '/mi-perfil', completo);
      const nota = await screen.findByRole('note');
      expect(nota).toHaveTextContent('Si algún dato es incorrecto, pide a recepción que lo actualice.');
      expect(nota.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Detalle de cliente', () => {
    it('usa el mismo estilo de perfil y ofrece volver y editar según el rol', async () => {
      abrir('recepcionista', '/clientes/7', completo);
      const contenido = within(principal());

      expect(await contenido.findByRole('heading', { name: 'Ana Propia' })).toBeInTheDocument();
      expect(contenido.getByText('AP')).toHaveClass('avatar-grande');
      expect(contenido.getByText(/^Cliente desde 12 de octubre de 2026$/)).toBeInTheDocument();
      expect(contenido.getAllByRole('term')).toHaveLength(3);
      expect(contenido.getByRole('link', { name: /volver a la lista/i })).toHaveAttribute('href', '/clientes');
      expect(contenido.getByRole('link', { name: /editar/i })).toHaveAttribute('href', '/clientes/7/editar');
      expect(contenido.queryByRole('note')).not.toBeInTheDocument();
    });

    it('el entrenador ve el perfil sin datos de contacto y sin botón de editar', async () => {
      abrir('entrenador', '/clientes/7', basico);
      const contenido = within(principal());

      expect(await contenido.findByRole('heading', { name: 'Ana Propia' })).toBeInTheDocument();
      expect(contenido.getByText('Inactivo')).toBeInTheDocument();
      expect(contenido.queryAllByRole('term')).toHaveLength(0);
      expect(contenido.queryByRole('link', { name: /editar/i })).not.toBeInTheDocument();
      expect(contenido.getByRole('link', { name: /volver a la lista/i })).toBeInTheDocument();
    });

    it('si el cliente no existe muestra el error y permite volver', async () => {
      abrir('recepcionista', '/clientes/99', completo);
      expect(await screen.findByRole('alert')).toHaveTextContent('No se encontró el recurso.');
      expect(screen.getByRole('link', { name: /volver a la lista/i })).toBeInTheDocument();
    });
  });
});
