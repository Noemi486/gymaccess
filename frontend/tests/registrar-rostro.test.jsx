import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor, configure } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// El módulo de reconocimiento se sustituye por un doble: no se carga la biblioteca ni los modelos.
vi.mock('../src/lib/reconocimientoFacial.js', () => ({
  cargarModelos: vi.fn(async () => {}),
  analizarFotograma: vi.fn(),
  capturarMuestras: vi.fn(),
  INDICACIONES: {
    sin_rostro: 'No se ve ningún rostro. Colócate frente a la cámara.',
    varios: 'Hay más de un rostro. Debe aparecer una sola persona.',
    lejos: 'Acércate un poco más a la cámara.',
    baja_confianza: 'No se ve con claridad. Mejora la iluminación y mira de frente.',
    inconsistente: 'Se movió el rostro durante la captura. Mantente quieto, mira de frente e inténtalo de nuevo.',
  },
}));

import App from '../src/App.jsx';
import { capturarMuestras, cargarModelos } from '../src/lib/reconocimientoFacial.js';

configure({ asyncUtilTimeout: 4000 });

function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

const cliente = {
  id_cliente: 7,
  nombre: 'Luis',
  apellido: 'Soto',
  correo: 'luis@example.com',
  telefono: '555-100-2000',
  direccion: null,
  fecha_registro: '2026-10-12T15:00:00.000Z',
  estado: 'activo',
};
const sinMembresias = { actual: null, proxima: null, historial: [] };
const sinRostro = { registrado: false, activo: null, historial: [] };
const conRostro = {
  registrado: true,
  activo: { id_rostro: 3, fecha_registro: '2026-10-14T09:00:00.000Z' },
  historial: [{ id_rostro: 3, fecha_registro: '2026-10-14T09:00:00.000Z', estado: 'activo' }],
};
const desactivado = {
  registrado: false,
  activo: null,
  historial: [{ id_rostro: 3, fecha_registro: '2026-10-14T09:00:00.000Z', estado: 'inactivo' }],
};
const descriptor128 = Array.from({ length: 128 }, (_, i) => (i % 7) / 10);

let pistas;
function simularCamara(resultado = 'ok') {
  pistas = [{ stop: vi.fn() }, { stop: vi.fn() }];
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

function abrir(rol, rostro, alEscribir) {
  const cuenta = { id_usuario: 9, nombre: 'Persona', correo: 'p@example.com', rol, estado: 'activo', id_cliente: null };
  sessionStorage.setItem('gym_token', 'token-de-prueba');
  sessionStorage.setItem('gym_usuario', JSON.stringify(cuenta));
  const llamadas = [];
  let actual = rostro;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, opciones = {}) => {
      const metodo = opciones.method ?? 'GET';
      const cuerpo = opciones.body ? JSON.parse(opciones.body) : undefined;
      llamadas.push({ url, metodo, cuerpo, crudo: opciones.body });
      if (url === '/api/auth/me') return respuesta(200, cuenta);
      if (url === '/api/clientes/7') return respuesta(200, cliente);
      if (url === '/api/clientes/7/membresias') return respuesta(200, sinMembresias);
      if (url === '/api/clientes/7/rostro' && metodo === 'GET') return respuesta(200, actual);
      const resultado = alEscribir?.(url, metodo, cuerpo, (nuevo) => (actual = nuevo));
      if (resultado) return resultado;
      return respuesta(404, { error: { code: 'NOT_FOUND', message: 'No existe.' } });
    }),
  );
  render(
    <MemoryRouter initialEntries={['/clientes/7']}>
      <App />
    </MemoryRouter>,
  );
  return llamadas;
}

const panel = async () => (await screen.findByRole('heading', { name: 'Rostro' })).closest('section');

describe('Rostro del cliente', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(capturarMuestras).mockReset();
    vi.mocked(cargarModelos).mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('panel', () => {
    it('muestra "Sin rostro registrado" o la fecha del registro, sin datos biométricos', async () => {
      abrir('recepcionista', sinRostro);
      expect(await within(await panel()).findByText('Sin rostro registrado.')).toBeInTheDocument();
    });

    it('con rostro muestra "Rostro registrado el …" y ofrece reemplazar', async () => {
      abrir('recepcionista', conRostro);
      const seccion = await panel();
      expect(await within(seccion).findByText('Rostro registrado el 14 oct 2026.')).toBeInTheDocument();
      expect(within(seccion).getByRole('button', { name: 'Reemplazar rostro' })).toBeInTheDocument();
    });

    it('el recepcionista no ve desactivar ni reactivar', async () => {
      abrir('recepcionista', conRostro);
      await within(await panel()).findByText(/Rostro registrado el/);
      expect(screen.queryByRole('button', { name: 'Desactivar rostro' })).not.toBeInTheDocument();
    });

    it('el entrenador no ve el panel', async () => {
      abrir('entrenador', sinRostro);
      await screen.findByText(/Soto/);
      expect(screen.queryByRole('heading', { name: 'Rostro' })).not.toBeInTheDocument();
    });

    it('el administrador desactiva con confirmación y envía el estado', async () => {
      const llamadas = abrir('administrador', conRostro, (url, metodo, cuerpo, fijar) => {
        if (url === '/api/rostros/3/estado' && metodo === 'PATCH') {
          fijar(desactivado);
          return respuesta(200, { id_rostro: 3, id_cliente: 7, fecha_registro: '2026-10-14T09:00:00.000Z', estado: 'inactivo' });
        }
        return null;
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Desactivar rostro' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Desactivar rostro' });
      expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(false);
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Desactivar' }));
      await waitFor(() => expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(true));
      expect(llamadas.find((l) => l.metodo === 'PATCH').cuerpo).toEqual({ estado: 'inactivo' });
      expect(await screen.findByText('Rostro desactivado.')).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: 'Reactivar rostro' })).toBeInTheDocument();
    });

    it('el administrador reactiva el rostro desactivado', async () => {
      const llamadas = abrir('administrador', desactivado, (url, metodo) =>
        url === '/api/rostros/3/estado' && metodo === 'PATCH' ? respuesta(200, { id_rostro: 3, id_cliente: 7, estado: 'activo' }) : null,
      );
      fireEvent.click(await screen.findByRole('button', { name: 'Reactivar rostro' }));
      await waitFor(() => expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(true));
      expect(llamadas.find((l) => l.metodo === 'PATCH').cuerpo).toEqual({ estado: 'activo' });
    });
  });

  describe('diálogo de registro', () => {
    const abrirDialogo = async (rol = 'recepcionista', rostro = sinRostro, alEscribir) => {
      const llamadas = abrir(rol, rostro, alEscribir);
      fireEvent.click(await screen.findByRole('button', { name: 'Registrar rostro' }));
      return { llamadas, dialogo: await screen.findByRole('dialog', { name: 'Registrar rostro' }) };
    };

    it('exige marcar el consentimiento antes de activar la cámara', async () => {
      const getUserMedia = simularCamara();
      const { dialogo } = await abrirDialogo();
      const activar = within(dialogo).getByRole('button', { name: 'Activar cámara' });
      expect(activar).toBeDisabled();
      expect(getUserMedia).not.toHaveBeenCalled();
      fireEvent.click(within(dialogo).getByRole('checkbox'));
      expect(activar).toBeEnabled();
    });

    it('con consentimiento activa la cámara y ofrece capturar; al capturar envía 128 números y ninguna imagen', async () => {
      const getUserMedia = simularCamara();
      vi.mocked(capturarMuestras).mockResolvedValue({ estado: 'ok', descriptor: descriptor128 });
      const { llamadas, dialogo } = await abrirDialogo('recepcionista', sinRostro, (url, metodo) =>
        url === '/api/clientes/7/rostro' && metodo === 'POST' ? respuesta(201, { id_rostro: 5, fecha_registro: '2026-10-15T09:00:00', estado: 'activo' }) : null,
      );
      fireEvent.click(within(dialogo).getByRole('checkbox'));
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Activar cámara' }));
      fireEvent.click(await within(dialogo).findByRole('button', { name: 'Capturar rostro' }));

      await waitFor(() => expect(llamadas.some((l) => l.metodo === 'POST')).toBe(true));
      expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false });
      const envio = llamadas.find((l) => l.metodo === 'POST');
      expect(Object.keys(envio.cuerpo).sort()).toEqual(['consentimiento', 'descriptor']);
      expect(envio.cuerpo.consentimiento).toBe(true);
      expect(envio.cuerpo.descriptor).toHaveLength(128);
      expect(envio.cuerpo.descriptor.every((n) => typeof n === 'number')).toBe(true);
      expect(envio.crudo).not.toMatch(/data:image|blob:/i);
      expect(await screen.findByText('Rostro registrado.')).toBeInTheDocument();
      // Al terminar se apaga la cámara.
      pistas.forEach((p) => expect(p.stop).toHaveBeenCalled());
    });

    it('muestra la indicación cuando no hay un solo rostro claro y no envía nada', async () => {
      simularCamara();
      vi.mocked(capturarMuestras).mockResolvedValue({ estado: 'varios' });
      const { llamadas, dialogo } = await abrirDialogo();
      fireEvent.click(within(dialogo).getByRole('checkbox'));
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Activar cámara' }));
      fireEvent.click(await within(dialogo).findByRole('button', { name: 'Capturar rostro' }));
      expect(await within(dialogo).findByText('Hay más de un rostro. Debe aparecer una sola persona.')).toBeInTheDocument();
      expect(llamadas.some((l) => l.metodo === 'POST')).toBe(false);
    });

    it.each([
      ['NotAllowedError', /No se permitió el acceso a la cámara/],
      ['NotFoundError', /No se encontró una cámara/],
      ['NotReadableError', /usada por otra aplicación/],
    ])('cámara con error %s muestra el mensaje y permite reintentar', async (nombre, mensaje) => {
      const getUserMedia = simularCamara(nombre);
      const { dialogo } = await abrirDialogo();
      fireEvent.click(within(dialogo).getByRole('checkbox'));
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Activar cámara' }));
      expect(await within(dialogo).findByText(mensaje)).toBeInTheDocument();
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Reintentar' }));
      await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    });

    it('si el servidor rechaza el registro lo muestra como aviso y deja reintentar', async () => {
      simularCamara();
      vi.mocked(capturarMuestras).mockResolvedValue({ estado: 'ok', descriptor: descriptor128 });
      const { dialogo } = await abrirDialogo('recepcionista', sinRostro, (url, metodo) =>
        metodo === 'POST' ? respuesta(409, { error: { code: 'CONFLICT', message: 'El cliente está dado de baja.' } }) : null,
      );
      fireEvent.click(within(dialogo).getByRole('checkbox'));
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Activar cámara' }));
      fireEvent.click(await within(dialogo).findByRole('button', { name: 'Capturar rostro' }));
      expect(await within(dialogo).findByRole('alert')).toHaveTextContent('El cliente está dado de baja.');
      expect(within(dialogo).getByRole('button', { name: 'Capturar rostro' })).toBeEnabled();
    });

    it('al cancelar se detienen todas las pistas de la cámara', async () => {
      simularCamara();
      const { dialogo } = await abrirDialogo();
      fireEvent.click(within(dialogo).getByRole('checkbox'));
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Activar cámara' }));
      await within(dialogo).findByRole('button', { name: 'Capturar rostro' });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
      pistas.forEach((p) => expect(p.stop).toHaveBeenCalled());
      expect(screen.queryByRole('dialog', { name: 'Registrar rostro' })).not.toBeInTheDocument();
    });
  });
});
