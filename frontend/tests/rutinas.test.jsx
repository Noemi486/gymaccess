import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

// Rutinas del cliente (spec 004, US3).

function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

const RUTINA = {
  id_rutina: 30, nombre: 'Fuerza A', indicaciones: 'Calentar 10 minutos.', estado: 'activa', fecha_creacion: '2026-11-03T10:00:00.000Z', fecha_archivo: null,
  entrenador: { id_usuario: 11, nombre: 'Luis Ramos' },
  dias: [
    { dia: 1, ejercicios: [{ nombre: 'Sentadilla', series: 4, repeticiones: '10-12', peso_kg: 40, descanso_seg: 90, instrucciones: null }, { nombre: 'Plancha', series: null, repeticiones: null, peso_kg: null, descanso_seg: null, instrucciones: '3 x 30 s' }] },
    { dia: 3, ejercicios: [{ nombre: 'Press de banca', series: 3, repeticiones: '8', peso_kg: null, descanso_seg: null, instrucciones: null }] },
  ],
};
const ARCHIVADA = { ...RUTINA, id_rutina: 29, nombre: 'Inicio', estado: 'archivada', fecha_creacion: '2026-10-01T10:00:00.000Z', fecha_archivo: '2026-11-03T10:00:00.000Z', dias: [{ dia: 2, ejercicios: [{ nombre: 'Caminata', series: null, repeticiones: null, peso_kg: null, descanso_seg: null, instrucciones: '20 minutos' }] }] };
const base = (extra = {}) => ({
  cliente: { id_cliente: 7, nombre: 'Ana', apellido: 'Ruiz', estado: 'activo' },
  entrenador: { id_usuario: 11, nombre: 'Luis Ramos', desde: '2026-11-02T10:00:00.000Z' },
  puede_editar: true,
  rutina_activa: null,
  rutinas: [],
  ...extra,
});

function abrir(ruta, rol, { datos = base(), responder = () => null } = {}) {
  const cuenta = { id_usuario: 11, nombre: 'Luis Ramos', correo: 'l@example.com', rol, estado: 'activo', id_cliente: null };
  sessionStorage.setItem('gym_token', 'token-de-prueba');
  sessionStorage.setItem('gym_usuario', JSON.stringify(cuenta));
  const llamadas = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, opciones = {}) => {
      const metodo = opciones.method ?? 'GET';
      if (url === '/api/auth/me') return respuesta(200, cuenta);
      if (url === '/api/avisos') return respuesta(200, { total: 0, avisos: [] });
      const cuerpo = opciones.body ? JSON.parse(opciones.body) : undefined;
      llamadas.push({ url, metodo, cuerpo });
      const especial = responder(url, metodo, cuerpo);
      if (especial) return especial;
      if (url === '/api/clientes/7/entrenamiento') return respuesta(200, datos);
      if (url === '/api/rutinas/29') return respuesta(200, ARCHIVADA);
      return respuesta(404, { error: { code: 'NOT_FOUND', message: 'No existe.' } });
    }),
  );
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
    </MemoryRouter>,
  );
  return llamadas;
}

const tarjeta = async (titulo) => within((await screen.findByRole('heading', { name: titulo })).closest('section'));

describe('Rutinas', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('entrenador sin rutina: crea una con dos días y envía los datos con números', async () => {
    const llamadas = abrir('/mis-clientes/7', 'entrenador', {
      responder: (url, metodo) => (metodo === 'POST' ? respuesta(201, RUTINA) : null),
    });
    expect(await screen.findByRole('heading', { name: 'Ana Ruiz' })).toBeInTheDocument();
    const actual = await tarjeta('Rutina actual');
    expect(actual.getByText('Sin rutina')).toBeInTheDocument();
    fireEvent.click(actual.getByRole('button', { name: 'Crear rutina' }));

    fireEvent.change(screen.getByLabelText('Nombre de la rutina'), { target: { value: 'Fuerza A' } });
    const e1 = within(screen.getByRole('group', { name: 'Día 1, ejercicio 1' }));
    fireEvent.change(e1.getByLabelText('Ejercicio 1'), { target: { value: 'Sentadilla' } });
    fireEvent.change(e1.getByLabelText('Series'), { target: { value: '4' } });
    fireEvent.change(e1.getByLabelText('Repeticiones'), { target: { value: '10-12' } });
    fireEvent.change(e1.getByLabelText('Peso (kg)'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar día' }));
    const e2 = within(screen.getByRole('group', { name: 'Día 2, ejercicio 1' }));
    fireEvent.change(e2.getByLabelText('Ejercicio 1'), { target: { value: 'Caminata' } });
    fireEvent.change(e2.getByLabelText('Instrucciones'), { target: { value: '20 minutos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar rutina' }));

    expect(await screen.findByText('Rutina creada.')).toBeInTheDocument();
    expect(llamadas.find((l) => l.metodo === 'POST').cuerpo).toEqual({
      nombre: 'Fuerza A',
      indicaciones: null,
      dias: [
        { dia: 1, ejercicios: [{ nombre: 'Sentadilla', series: 4, repeticiones: '10-12', peso_kg: 40, descanso_seg: null, instrucciones: null }] },
        { dia: 2, ejercicios: [{ nombre: 'Caminata', series: null, repeticiones: null, peso_kg: null, descanso_seg: null, instrucciones: '20 minutos' }] },
      ],
    });
  });

  it('valida en la pantalla: nombre y ejercicio sin detalle, sin enviar nada', async () => {
    const llamadas = abrir('/mis-clientes/7', 'entrenador');
    fireEvent.click((await tarjeta('Rutina actual')).getByRole('button', { name: 'Crear rutina' }));
    fireEvent.change(within(screen.getByRole('group', { name: 'Día 1, ejercicio 1' })).getByLabelText('Ejercicio 1'), { target: { value: 'Trote' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar rutina' }));
    expect(await screen.findByText('El nombre de la rutina es obligatorio.')).toBeInTheDocument();
    expect(screen.getByText('Indica series, repeticiones o instrucciones.')).toBeInTheDocument();
    expect(llamadas.some((l) => l.metodo === 'POST')).toBe(false);
  });

  it('con rutina: la muestra por día y "Modificar" abre el editor con sus datos', async () => {
    abrir('/mis-clientes/7', 'entrenador', { datos: base({ rutina_activa: RUTINA, rutinas: [{ id_rutina: 30, nombre: 'Fuerza A', estado: 'activa' }] }) });
    const actual = await tarjeta('Rutina actual');
    const dia1 = within(actual.getByRole('region', { name: 'Día 1' }));
    expect(dia1.getByText('Sentadilla')).toBeInTheDocument();
    expect(dia1.getByText(/4 × 10-12 · 40 kg · descanso 90 s/)).toBeInTheDocument();
    expect(dia1.getByText('3 x 30 s')).toBeInTheDocument();
    expect(actual.getByText('Calentar 10 minutos.')).toBeInTheDocument();
    fireEvent.click(actual.getByRole('button', { name: 'Modificar rutina' }));
    expect(screen.getByLabelText('Nombre de la rutina')).toHaveValue('Fuerza A');
    expect(within(screen.getByRole('group', { name: 'Día 3, ejercicio 1' })).getByLabelText('Ejercicio 1')).toHaveValue('Press de banca');
  });

  it('historial: "Ver" abre la versión archivada', async () => {
    abrir('/mis-clientes/7', 'entrenador', {
      datos: base({ rutina_activa: RUTINA, rutinas: [{ id_rutina: 30, nombre: 'Fuerza A', estado: 'activa' }, { id_rutina: 29, nombre: 'Inicio', estado: 'archivada', fecha_creacion: ARCHIVADA.fecha_creacion, fecha_archivo: ARCHIVADA.fecha_archivo, entrenador: 'Luis Ramos', dias: 1, ejercicios: 1 }] }),
    });
    const historial = await tarjeta('Historial de rutinas');
    expect(historial.getByText(/1 días, 1 ejercicios/)).toBeInTheDocument();
    fireEvent.click(historial.getByRole('button', { name: 'Ver' }));
    expect(await historial.findByText('Caminata')).toBeInTheDocument();
    expect(historial.getByRole('button', { name: 'Ocultar' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('error del servidor al guardar: muestra el motivo y el campo', async () => {
    abrir('/mis-clientes/7', 'entrenador', {
      responder: (url, metodo) =>
        metodo === 'POST'
          ? respuesta(400, { error: { code: 'VALIDATION_ERROR', message: 'Revisa los datos enviados.', details: [{ field: 'dias.0.ejercicios.0.series', message: 'Las series deben estar entre 1 y 20.' }] } })
          : null,
    });
    fireEvent.click((await tarjeta('Rutina actual')).getByRole('button', { name: 'Crear rutina' }));
    fireEvent.change(screen.getByLabelText('Nombre de la rutina'), { target: { value: 'X' } });
    const e1 = within(screen.getByRole('group', { name: 'Día 1, ejercicio 1' }));
    fireEvent.change(e1.getByLabelText('Ejercicio 1'), { target: { value: 'Remo' } });
    fireEvent.change(e1.getByLabelText('Series'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar rutina' }));
    expect(await screen.findByText('Las series deben estar entre 1 y 20.')).toBeInTheDocument();
  });

  it('administrador: consulta en /clientes/:id/entrenamiento sin botones de edición', async () => {
    abrir('/clientes/7/entrenamiento', 'administrador', { datos: base({ puede_editar: false, rutina_activa: RUTINA }) });
    const actual = await tarjeta('Rutina actual');
    expect(actual.getByText('Sentadilla')).toBeInTheDocument();
    expect(actual.queryByRole('button', { name: /rutina/i })).not.toBeInTheDocument();
  });

  it('cliente que no es suyo: muestra el motivo del servidor', async () => {
    abrir('/mis-clientes/7', 'entrenador', {
      responder: (url) => (url === '/api/clientes/7/entrenamiento' ? respuesta(403, { error: { code: 'FORBIDDEN', message: 'Este cliente no está asignado a ti.' } }) : null),
    });
    expect(await screen.findByText('Este cliente no está asignado a ti.')).toBeInTheDocument();
  });

  it('recepcionista y cliente: "Sin permiso" en ambas rutas', async () => {
    abrir('/clientes/7/entrenamiento', 'recepcionista');
    expect(await screen.findByText('Sin permiso')).toBeInTheDocument();
  });

  it('el editor deja agregar y quitar ejercicios', async () => {
    abrir('/mis-clientes/7', 'entrenador');
    fireEvent.click((await tarjeta('Rutina actual')).getByRole('button', { name: 'Crear rutina' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar ejercicio al día 1' }));
    expect(screen.getByRole('group', { name: 'Día 1, ejercicio 2' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar ejercicio 2 del día 1' }));
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Día 1, ejercicio 2' })).not.toBeInTheDocument());
  });
});
