import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { conDiferencia } from '../src/components/HistorialProgreso.jsx';

// Objetivos y progreso del cliente (spec 004, US4).

function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

const OBJETIVOS = [
  { id_objetivo: 5, descripcion: 'Bajar 5 kg', meta: '75 kg', fecha_limite: '2027-01-31', estado: 'en_curso', fecha_creacion: '2026-11-01T10:00:00.000Z', fecha_cierre: null, entrenador: 'Luis Ramos' },
  { id_objetivo: 4, descripcion: 'Correr 5 km', meta: null, fecha_limite: null, estado: 'cumplido', fecha_creacion: '2026-10-01T10:00:00.000Z', fecha_cierre: '2026-10-30T10:00:00.000Z', entrenador: 'Luis Ramos' },
];
const PROGRESOS = [
  { id_progreso: 3, fecha: '2026-11-04', peso_kg: 78.4, grasa_pct: null, cintura_cm: 88, comentario: null, entrenador: 'Luis Ramos', corregido: false, puede_corregir: true, diferencias: { peso_kg: -1.6, grasa_pct: null, cintura_cm: -2.5 } },
  { id_progreso: 1, fecha: '2026-10-05', peso_kg: 80, grasa_pct: 24, cintura_cm: 90.5, comentario: 'Inicio', entrenador: 'Luis Ramos', corregido: false, puede_corregir: false, diferencias: { peso_kg: null, grasa_pct: null, cintura_cm: null } },
];
const datos = (extra = {}) => ({
  cliente: { id_cliente: 7, nombre: 'Ana', apellido: 'Ruiz', estado: 'activo' },
  entrenador: { id_usuario: 11, nombre: 'Luis Ramos', desde: '2026-10-01T10:00:00.000Z' },
  puede_editar: true,
  rutina_activa: null,
  rutinas: [],
  objetivos: OBJETIVOS,
  progresos: PROGRESOS,
  ...extra,
});

function abrir(ruta, rol, { contenido = datos(), responder = () => null } = {}) {
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
      if (url === '/api/clientes/7/entrenamiento') return respuesta(200, contenido);
      if (metodo !== 'GET') return respuesta(200, {});
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

describe('conDiferencia', () => {
  it('formatea el valor con su diferencia y signo', () => {
    expect(conDiferencia(78.4, -1.6, 'kg')).toBe('78.4 kg (−1.6)');
    expect(conDiferencia(25, 1, '%')).toBe('25 % (+1)');
    expect(conDiferencia(80, null, 'kg')).toBe('80 kg');
    expect(conDiferencia(null, null, 'kg')).toBe('—');
  });
});

describe('Objetivos', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('lista con estado, meta y fecha límite; solo los en curso tienen acciones', async () => {
    abrir('/mis-clientes/7', 'entrenador');
    const t = await tarjeta('Objetivos');
    const items = within(t.getByRole('list', { name: 'Objetivos' })).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Bajar 5 kg');
    expect(items[0]).toHaveTextContent('Meta: 75 kg · Fecha límite: 31 ene 2027');
    expect(within(items[0]).getByText('En curso')).toHaveClass('badge');
    expect(within(items[1]).getByText('Cumplido')).toBeInTheDocument();
    expect(within(items[1]).queryByRole('button')).not.toBeInTheDocument();
    expect(within(items[0]).getByRole('button', { name: 'Marcar cumplido' })).toBeInTheDocument();
  });

  it('nuevo objetivo: envía descripción, meta y fecha', async () => {
    const llamadas = abrir('/mis-clientes/7', 'entrenador');
    const t = await tarjeta('Objetivos');
    fireEvent.click(t.getByRole('button', { name: 'Nuevo objetivo' }));
    fireEvent.change(t.getByLabelText('Objetivo'), { target: { value: 'Ganar fuerza' } });
    fireEvent.change(t.getByLabelText('Meta (opcional)'), { target: { value: 'Sentadilla 80 kg' } });
    fireEvent.click(t.getByRole('button', { name: 'Guardar objetivo' }));
    expect(await screen.findByText('Objetivo registrado.')).toBeInTheDocument();
    expect(llamadas.find((l) => l.metodo === 'POST').cuerpo).toEqual({ descripcion: 'Ganar fuerza', meta: 'Sentadilla 80 kg', fecha_limite: null });
    expect(llamadas.find((l) => l.metodo === 'POST').url).toBe('/api/clientes/7/objetivos');
  });

  it('marcar cumplido pide confirmación y envía solo el estado', async () => {
    const llamadas = abrir('/mis-clientes/7', 'entrenador');
    const t = await tarjeta('Objetivos');
    fireEvent.click(t.getByRole('button', { name: 'Marcar cumplido' }));
    expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(false);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Marcar cumplido' }));
    await waitFor(() => expect(llamadas.find((l) => l.metodo === 'PATCH')).toEqual({ url: '/api/objetivos/5', metodo: 'PATCH', cuerpo: { estado: 'cumplido' } }));
  });

  it('error del servidor junto al campo (fecha límite pasada)', async () => {
    abrir('/mis-clientes/7', 'entrenador', {
      responder: (url, metodo) =>
        metodo === 'POST'
          ? respuesta(400, { error: { code: 'VALIDATION_ERROR', message: 'Revisa los datos enviados.', details: [{ field: 'fecha_limite', message: 'La fecha límite no puede ser anterior a hoy.' }] } })
          : null,
    });
    const t = await tarjeta('Objetivos');
    fireEvent.click(t.getByRole('button', { name: 'Nuevo objetivo' }));
    fireEvent.change(t.getByLabelText('Objetivo'), { target: { value: 'X' } });
    fireEvent.click(t.getByRole('button', { name: 'Guardar objetivo' }));
    expect(await t.findByText('La fecha límite no puede ser anterior a hoy.')).toBeInTheDocument();
  });
});

describe('Progreso', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('tabla del más reciente al más antiguo con diferencias; "Corregir" solo donde se puede', async () => {
    abrir('/mis-clientes/7', 'entrenador');
    const t = await tarjeta('Progreso');
    const filas = within(t.getByRole('table', { name: 'Historial de avances' })).getAllByRole('row').slice(1);
    expect(filas[0]).toHaveTextContent('4 nov 2026');
    expect(filas[0]).toHaveTextContent('78.4 kg (−1.6)');
    expect(filas[0]).toHaveTextContent('88 cm (−2.5)');
    expect(filas[1]).toHaveTextContent('80 kg');
    expect(filas[1]).toHaveTextContent('Inicio');
    expect(within(filas[0]).getByRole('button', { name: 'Corregir' })).toBeInTheDocument();
    expect(within(filas[1]).queryByRole('button', { name: 'Corregir' })).not.toBeInTheDocument();
  });

  it('registrar avance: exige un dato y envía números', async () => {
    const llamadas = abrir('/mis-clientes/7', 'entrenador');
    const t = await tarjeta('Progreso');
    fireEvent.click(t.getByRole('button', { name: 'Registrar avance' }));
    fireEvent.click(t.getByRole('button', { name: 'Guardar avance' }));
    expect(await t.findByText('Registra al menos el peso, el porcentaje de grasa, la cintura o un comentario.')).toBeInTheDocument();
    expect(llamadas.some((l) => l.metodo === 'POST')).toBe(false);

    fireEvent.change(t.getByLabelText('Fecha'), { target: { value: '2026-11-03' } });
    fireEvent.change(t.getByLabelText('Peso (kg)'), { target: { value: '77.9' } });
    fireEvent.change(t.getByLabelText('Comentario'), { target: { value: 'Buen ritmo' } });
    fireEvent.click(t.getByRole('button', { name: 'Guardar avance' }));
    expect(await screen.findByText('Avance registrado.')).toBeInTheDocument();
    expect(llamadas.find((l) => l.metodo === 'POST').cuerpo).toEqual({ fecha: '2026-11-03', peso_kg: 77.9, grasa_pct: null, cintura_cm: null, comentario: 'Buen ritmo' });
  });

  it('corregir abre el formulario con los datos y envía PATCH', async () => {
    const llamadas = abrir('/mis-clientes/7', 'entrenador');
    const t = await tarjeta('Progreso');
    fireEvent.click(t.getByRole('button', { name: 'Corregir' }));
    expect(t.getByLabelText('Peso (kg)')).toHaveValue(78.4);
    fireEvent.change(t.getByLabelText('Peso (kg)'), { target: { value: '78.2' } });
    fireEvent.click(t.getByRole('button', { name: 'Guardar corrección' }));
    await waitFor(() => expect(llamadas.find((l) => l.metodo === 'PATCH')?.url).toBe('/api/progresos/3'));
    expect(llamadas.find((l) => l.metodo === 'PATCH').cuerpo.peso_kg).toBe(78.2);
  });

  it('administrador: consulta sin botones', async () => {
    abrir('/clientes/7/entrenamiento', 'administrador', { contenido: datos({ puede_editar: false, progresos: PROGRESOS.map((p) => ({ ...p, puede_corregir: false })) }) });
    const p = await tarjeta('Progreso');
    expect(p.queryByRole('button')).not.toBeInTheDocument();
    const o = await tarjeta('Objetivos');
    expect(o.queryByRole('button')).not.toBeInTheDocument();
  });
});
