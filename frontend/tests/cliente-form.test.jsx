import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import ClienteForm from '../src/pages/ClienteForm.jsx';

function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

const clienteGuardado = {
  id_cliente: 7,
  nombre: 'Clara',
  apellido: 'Prueba',
  correo: null,
  telefono: '555 123 4567',
  direccion: null,
  fecha_registro: '2026-10-07T10:00:00.000Z',
  estado: 'activo',
};

function renderizar(fetchSimulado, ruta = '/clientes/nuevo') {
  vi.stubGlobal('fetch', fetchSimulado);
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <AuthProvider>
        <Routes>
          <Route path="/clientes/nuevo" element={<ClienteForm />} />
          <Route path="/clientes/:id/editar" element={<ClienteForm />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function llenar(valores) {
  const etiquetas = {
    nombre: /^nombre/i,
    apellido: /^apellido/i,
    telefono: /^teléfono/i,
    correo: /^correo/i,
    direccion: /^dirección/i,
  };
  for (const [campo, valor] of Object.entries(valores)) {
    fireEvent.change(screen.getByLabelText(etiquetas[campo]), { target: { value: valor } });
  }
}

describe('ClienteForm', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('marca nombre, apellido y teléfono como obligatorios y deja correo y dirección opcionales', () => {
    renderizar(vi.fn());

    expect(screen.getByLabelText(/^nombre/i)).toBeRequired();
    expect(screen.getByLabelText(/^apellido/i)).toBeRequired();
    expect(screen.getByLabelText(/^teléfono/i)).toBeRequired();
    expect(screen.getByLabelText(/^correo/i)).not.toBeRequired();
    expect(screen.getByLabelText(/^dirección/i)).not.toBeRequired();
    expect(screen.getByLabelText(/^correo/i)).toHaveAccessibleName(/opcional/i);
  });

  it('muestra el error de correo duplicado que devuelve la API junto al campo', async () => {
    const fetchSimulado = vi.fn(async () =>
      respuesta(409, {
        error: {
          code: 'CONFLICT',
          message: 'Ya existe un cliente con ese correo.',
          details: [{ field: 'correo', message: 'Ese correo ya está registrado en otro cliente.' }],
        },
      }),
    );
    renderizar(fetchSimulado);

    llenar({ nombre: 'Clara', apellido: 'Prueba', telefono: '555 123 4567', correo: 'repetido@example.com' });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText('Ese correo ya está registrado en otro cliente.')).toBeInTheDocument();
    expect(screen.queryByText(/cliente registrado/i)).not.toBeInTheDocument();
  });

  it('muestra el campo que falta cuando la API responde 400', async () => {
    const fetchSimulado = vi.fn(async () =>
      respuesta(400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Revisa los datos enviados.',
          details: [{ field: 'telefono', message: 'Este campo es obligatorio.' }],
        },
      }),
    );
    renderizar(fetchSimulado);

    llenar({ nombre: 'Clara', apellido: 'Prueba' });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText('Este campo es obligatorio.')).toBeInTheDocument();
  });

  it('al registrar envía solo los datos capturados, avisa el éxito y limpia el formulario', async () => {
    const fetchSimulado = vi.fn(async () => respuesta(201, clienteGuardado));
    renderizar(fetchSimulado);

    llenar({ nombre: 'Clara', apellido: 'Prueba', telefono: '555 123 4567' });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText(/cliente registrado/i)).toBeInTheDocument();
    const [url, opciones] = fetchSimulado.mock.calls[0];
    expect(url).toBe('/api/clientes');
    expect(opciones.method).toBe('POST');
    expect(JSON.parse(opciones.body)).toEqual({ nombre: 'Clara', apellido: 'Prueba', telefono: '555 123 4567' });
    expect(screen.getByLabelText(/^nombre/i)).toHaveValue('');
  });

  it('al editar carga el cliente y envía solo los campos modificados', async () => {
    const fetchSimulado = vi.fn(async (url, opciones = {}) => {
      if (opciones.method === 'PATCH') return respuesta(200, { ...clienteGuardado, telefono: '555 000 1111' });
      return respuesta(200, clienteGuardado);
    });
    renderizar(fetchSimulado, '/clientes/7/editar');

    const telefono = await screen.findByLabelText(/^teléfono/i);
    expect(screen.getByLabelText(/^nombre/i)).toHaveValue('Clara');
    fireEvent.change(telefono, { target: { value: '555 000 1111' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText(/cliente actualizado/i)).toBeInTheDocument();
    const patch = fetchSimulado.mock.calls.find(([, o]) => o?.method === 'PATCH');
    expect(patch[0]).toBe('/api/clientes/7');
    expect(JSON.parse(patch[1].body)).toEqual({ telefono: '555 000 1111' });
  });
});
