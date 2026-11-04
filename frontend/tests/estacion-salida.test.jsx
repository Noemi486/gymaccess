import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor, configure } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// El reconocimiento facial se sustituye por un doble: sin biblioteca, sin modelos y sin cámara real.
vi.mock('../src/lib/reconocimientoFacial.js', () => ({
  cargarModelos: vi.fn(async () => {}),
  analizarFotograma: vi.fn(),
  capturarMuestras: vi.fn(),
  INDICACIONES: {
    sin_rostro: 'No se ve ningún rostro. Colócate frente a la cámara.',
    varios: 'Hay más de un rostro. Debe aparecer una sola persona.',
    lejos: 'Acércate un poco más a la cámara.',
    baja_confianza: 'No se ve con claridad. Mejora la iluminación y mira de frente.',
    inconsistente: 'Se movió el rostro durante la captura.',
  },
}));

import App from '../src/App.jsx';
import { analizarFotograma, cargarModelos } from '../src/lib/reconocimientoFacial.js';

configure({ asyncUtilTimeout: 4000 });

function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

const autorizado = {
  resultado: 'autorizado',
  id_acceso: 410,
  cliente: { id_cliente: 7, nombre: 'Min', apellido: 'Cabrera' },
  membresia: { plan: 'Plan Mensual', fecha_fin: '2026-11-12', dias_restantes: 29 },
};
const pagoPendiente = {
  resultado: 'rechazado',
  id_acceso: 411,
  motivo: 'Pago pendiente',
  cliente: { id_cliente: 9, nombre: 'Luis', apellido: 'Soto' },
};
const noReconocido = { resultado: 'rechazado', id_acceso: 412, motivo: 'Rostro no reconocido' };

const descriptor = new Float32Array(Array.from({ length: 128 }, (_, i) => (i % 9) / 10));

let pistas;
function simularCamara(resultado = 'ok') {
  pistas = [{ stop: vi.fn() }];
  const getUserMedia =
    resultado === 'ok'
      ? vi.fn(async () => ({ getTracks: () => pistas }))
      : vi.fn(async () => {
          const e = new Error('x');
          e.name = resultado;
          throw e;
        });
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  return getUserMedia;
}

// Abre /estacion con la cuenta indicada. `respuestas` es la lista de respuestas de /accesos/identificar, en orden.
function abrir(rol = 'recepcionista', respuestas = [autorizado]) {
  const cuenta = { id_usuario: 9, nombre: 'Persona', correo: 'p@example.com', rol, estado: 'activo', id_cliente: null };
  sessionStorage.setItem('gym_token', 'token-de-prueba');
  sessionStorage.setItem('gym_usuario', JSON.stringify(cuenta));
  const llamadas = [];
  const pendientes = [...respuestas];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, opciones = {}) => {
      const metodo = opciones.method ?? 'GET';
      llamadas.push({ url, metodo, crudo: opciones.body });
      if (url === '/api/auth/me') return respuesta(200, cuenta);
      if (url === '/api/accesos/identificar' && metodo === 'POST') {
        const siguiente = pendientes.length > 1 ? pendientes.shift() : pendientes[0];
        if (siguiente?.status) return respuesta(siguiente.status, siguiente.cuerpo);
        return respuesta(200, siguiente);
      }
      return respuesta(404, { error: { code: 'NOT_FOUND', message: 'No existe.' } });
    }),
  );
  render(
    <MemoryRouter initialEntries={['/estacion']}>
      <App />
    </MemoryRouter>,
  );
  return llamadas;
}

const identificaciones = (llamadas) => llamadas.filter((l) => l.url === '/api/accesos/identificar');
const avanzar = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

// Modo Entrada / Salida de la estación (spec 004, US8, FR-026 y FR-027).
const salida = { resultado: 'autorizado', tipo: 'salida', id_acceso: 500, cliente: { id_cliente: 7, nombre: 'Min', apellido: 'Cabrera' } };

describe('Estación: modo Salida', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    sessionStorage.clear();
    vi.mocked(analizarFotograma).mockReset();
    vi.mocked(analizarFotograma).mockResolvedValue({ estado: 'ok', descriptor, tamano: 0.4, confianza: 0.9 });
    vi.mocked(cargarModelos).mockClear();
    simularCamara();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('empieza en Entrada, con el modo siempre a la vista', async () => {
    abrir('recepcionista', [salida]);
    const grupo = await screen.findByRole('group', { name: 'Modo de la estación' });
    expect(screen.getByRole('button', { name: 'Entrada' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Salida' })).toHaveAttribute('aria-pressed', 'false');
    expect(grupo).toBeInTheDocument();
    expect(screen.getByText('Modo: ENTRADA')).toBeInTheDocument();
  });

  it('en Salida envía tipo "salida" y muestra "Hasta luego" sin datos de la membresía', async () => {
    const llamadas = abrir('recepcionista', [salida]);
    fireEvent.click(await screen.findByRole('button', { name: 'Salida' }));
    expect(screen.getByText('Modo: SALIDA')).toHaveClass('es-salida');
    await screen.findByText('Colócate frente a la cámara');
    await avanzar(1000);
    expect(await screen.findByText('Salida registrada')).toBeInTheDocument();
    expect(screen.getByText('Hasta luego, Min Cabrera')).toBeInTheDocument();
    expect(screen.queryByText(/Te quedan/)).not.toBeInTheDocument();
    const cuerpo = JSON.parse(identificaciones(llamadas)[0].crudo);
    expect(Object.keys(cuerpo).sort()).toEqual(['descriptor', 'tipo']);
    expect(cuerpo.tipo).toBe('salida');
    expect(cuerpo.descriptor).toHaveLength(128);
  });

  it('al volver a Entrada el cuerpo vuelve a ser solo el descriptor', async () => {
    const llamadas = abrir('recepcionista', [autorizado]);
    fireEvent.click(await screen.findByRole('button', { name: 'Salida' }));
    fireEvent.click(screen.getByRole('button', { name: 'Entrada' }));
    await screen.findByText('Colócate frente a la cámara');
    await avanzar(1000);
    await screen.findByText('Acceso autorizado');
    expect(Object.keys(JSON.parse(identificaciones(llamadas)[0].crudo))).toEqual(['descriptor']);
  });

  it('salida no reconocida: se muestra como rechazo con el motivo', async () => {
    abrir('recepcionista', [{ ...noReconocido, tipo: 'salida' }]);
    fireEvent.click(await screen.findByRole('button', { name: 'Salida' }));
    await screen.findByText('Colócate frente a la cámara');
    await avanzar(1000);
    expect(await screen.findByText('Rostro no reconocido')).toBeInTheDocument();
  });
});
