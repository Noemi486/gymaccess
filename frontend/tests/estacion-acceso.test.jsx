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

describe('Estación de acceso', () => {
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

  describe('pantalla y permisos', () => {
    it('se muestra a pantalla completa, SIN menú lateral ni encabezado del sistema', async () => {
      abrir();
      expect(await screen.findByRole('main', { name: 'Estación de acceso' })).toBeInTheDocument();
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
      expect(screen.queryByText('Operación')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Salir' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Pantalla completa' })).toBeInTheDocument();
    });

    it('el administrador y el recepcionista pueden usarla', async () => {
      abrir('administrador');
      expect(await screen.findByRole('main', { name: 'Estación de acceso' })).toBeInTheDocument();
    });

    for (const rol of ['entrenador', 'cliente']) {
      it(`el rol ${rol} ve "Sin permiso", no la estación, y no se enciende la cámara`, async () => {
        const getUserMedia = simularCamara();
        abrir(rol);
        expect(await screen.findByText('Sin permiso')).toBeInTheDocument();
        expect(screen.queryByRole('main', { name: 'Estación de acceso' })).not.toBeInTheDocument();
        expect(getUserMedia).not.toHaveBeenCalled();
      });
    }

    it('carga los modelos y enciende la cámara; luego espera a una persona', async () => {
      const getUserMedia = simularCamara();
      abrir();
      expect(await screen.findByText('Colócate frente a la cámara')).toBeInTheDocument();
      expect(cargarModelos).toHaveBeenCalled();
      expect(getUserMedia).toHaveBeenCalledTimes(1);
    });
  });

  describe('resultado de la identificación', () => {
    it('autorizado: verde, con nombre, plan y días restantes', async () => {
      const llamadas = abrir('recepcionista', [autorizado]);
      await screen.findByText('Colócate frente a la cámara');
      await avanzar(1000);

      const resultado = await screen.findByText('Acceso autorizado');
      const panel = resultado.closest('.estacion-resultado');
      expect(panel).toHaveClass('estacion-autorizado');
      expect(panel).toHaveTextContent('Min Cabrera');
      expect(panel).toHaveTextContent('Plan Mensual');
      expect(panel).toHaveTextContent('Te quedan 29 días');
      expect(identificaciones(llamadas)).toHaveLength(1);
    });

    it('rechazado: rojo, con el nombre y el motivo exacto (Pago pendiente)', async () => {
      abrir('recepcionista', [pagoPendiente]);
      await screen.findByText('Colócate frente a la cámara');
      await avanzar(1000);

      const titulo = await screen.findByText('Acceso rechazado');
      const panel = titulo.closest('.estacion-resultado');
      expect(panel).toHaveClass('estacion-rechazado');
      expect(panel).toHaveTextContent('Luis Soto');
      expect(panel).toHaveTextContent('Pago pendiente');
      expect(panel).toHaveTextContent('Pasa por recepción');
    });

    for (const motivo of ['Membresía vencida', 'Membresía suspendida', 'Membresía cancelada', 'Sin membresía', 'Cliente dado de baja']) {
      it(`muestra el motivo exacto "${motivo}" con el nombre del cliente`, async () => {
        abrir('recepcionista', [{ ...pagoPendiente, motivo }]);
        await screen.findByText('Colócate frente a la cámara');
        await avanzar(1000);
        const panel = (await screen.findByText('Acceso rechazado')).closest('.estacion-resultado');
        expect(panel).toHaveTextContent('Luis Soto');
        expect(panel).toHaveTextContent(motivo);
      });
    }

    it('"Rostro no reconocido" no muestra ningún nombre e invita a pedir ayuda en recepción', async () => {
      abrir('recepcionista', [noReconocido]);
      await screen.findByText('Colócate frente a la cámara');
      await avanzar(1000);

      const panel = (await screen.findByText('Acceso rechazado')).closest('.estacion-resultado');
      expect(panel).toHaveTextContent('Rostro no reconocido');
      expect(panel).toHaveTextContent('Pide ayuda en recepción');
      expect(panel.querySelector('.estacion-nombre')).toBeNull();
    });

    it('a los 5 segundos vuelve sola a la espera', async () => {
      abrir('recepcionista', [autorizado]);
      await screen.findByText('Colócate frente a la cámara');
      await avanzar(1000);
      await screen.findByText('Acceso autorizado');

      await avanzar(5500);
      await waitFor(() => expect(screen.queryByText('Acceso autorizado')).not.toBeInTheDocument());
      expect(screen.getByText('Colócate frente a la cámara')).toBeInTheDocument();
    });
  });

  describe('qué se envía', () => {
    it('solo POST /accesos/identificar con exactamente 128 números, sin imágenes', async () => {
      const llamadas = abrir('recepcionista', [autorizado]);
      await screen.findByText('Colócate frente a la cámara');
      await avanzar(1000);
      await screen.findByText('Acceso autorizado');

      const enviadas = llamadas.filter((l) => l.metodo !== 'GET');
      expect(enviadas).toHaveLength(1);
      const cuerpo = JSON.parse(enviadas[0].crudo);
      expect(Object.keys(cuerpo)).toEqual(['descriptor']);
      expect(cuerpo.descriptor).toHaveLength(128);
      expect(cuerpo.descriptor.every((n) => typeof n === 'number' && Number.isFinite(n))).toBe(true);
      expect(enviadas[0].crudo).not.toMatch(/data:image|blob:|base64/i);
    });

    it('no envía nada si no hay nadie frente a la cámara', async () => {
      vi.mocked(analizarFotograma).mockResolvedValue({ estado: 'sin_rostro' });
      const llamadas = abrir();
      await screen.findByText('Colócate frente a la cámara');
      await avanzar(5000);
      expect(identificaciones(llamadas)).toHaveLength(0);
    });

    it('no envía nada si hay varios rostros, y lo indica', async () => {
      vi.mocked(analizarFotograma).mockResolvedValue({ estado: 'varios' });
      const llamadas = abrir();
      await screen.findByText('Colócate frente a la cámara');
      await avanzar(3000);
      expect(await screen.findByText('Hay más de un rostro. Debe aparecer una sola persona.')).toBeInTheDocument();
      expect(identificaciones(llamadas)).toHaveLength(0);
    });

    it('espera 3 fotogramas estables antes de enviar (no con uno solo)', async () => {
      const llamadas = abrir();
      await screen.findByText('Colócate frente a la cámara');
      await avanzar(300); // ≈ 1 análisis
      expect(identificaciones(llamadas)).toHaveLength(0);
      await avanzar(1000);
      expect(identificaciones(llamadas)).toHaveLength(1);
    });

    it('la misma persona frente a la cámara no genera un intento nuevo antes de 10 segundos', async () => {
      const llamadas = abrir('recepcionista', [autorizado]);
      await screen.findByText('Colócate frente a la cámara');
      await avanzar(1000);
      await screen.findByText('Acceso autorizado');
      await avanzar(8000); // 5 s de resultado + espera, todavía dentro de los 10 s
      expect(identificaciones(llamadas)).toHaveLength(1);
      await avanzar(4000);
      expect(identificaciones(llamadas).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('3 rostros no reconocidos seguidos', () => {
    it('al tercero muestra el mensaje de ayuda, pausa 30 s sin enviar nada y luego reanuda', async () => {
      const llamadas = abrir('recepcionista', [noReconocido]);
      await screen.findByText('Colócate frente a la cámara');

      // Tres intentos, separados por el enfriamiento de 10 s.
      await avanzar(1000);
      await screen.findByText('Acceso rechazado');
      await avanzar(10_000);
      await avanzar(10_000);
      expect(await screen.findByText('No te reconocemos. Pide ayuda en recepción')).toBeInTheDocument();
      expect(identificaciones(llamadas)).toHaveLength(3);

      // Durante la pausa no se procesa ni se envía nada.
      await avanzar(25_000);
      expect(screen.getByText('No te reconocemos. Pide ayuda en recepción')).toBeInTheDocument();
      expect(identificaciones(llamadas)).toHaveLength(3);

      // Al terminar vuelve a la espera.
      await avanzar(6000);
      await waitFor(() => expect(screen.queryByText('No te reconocemos. Pide ayuda en recepción')).not.toBeInTheDocument());
    });
  });

  describe('cámara', () => {
    it('permiso denegado: mensaje claro y nada enviado', async () => {
      simularCamara('NotAllowedError');
      const llamadas = abrir();
      expect(await screen.findByText(/No se permitió el acceso a la cámara/)).toBeInTheDocument();
      await avanzar(3000);
      expect(identificaciones(llamadas)).toHaveLength(0);
    });

    it('sin cámara: mensaje claro', async () => {
      simularCamara('NotFoundError');
      abrir();
      expect(await screen.findByText(/No se encontró una cámara/)).toBeInTheDocument();
    });

    it('modelos que no cargan: mensaje y botón para reintentar', async () => {
      vi.mocked(cargarModelos).mockRejectedValueOnce(new Error('x'));
      abrir();
      expect(await screen.findByText(/No se pudieron cargar los modelos/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      expect(await screen.findByText('Colócate frente a la cámara')).toBeInTheDocument();
    });
  });

  describe('salir y sesión', () => {
    it('"Salir" apaga la cámara y regresa al sistema', async () => {
      abrir();
      await screen.findByText('Colócate frente a la cámara');
      fireEvent.click(screen.getByRole('button', { name: 'Salir' }));

      expect(pistas[0].stop).toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByRole('main', { name: 'Estación de acceso' })).not.toBeInTheDocument());
    });

    it('si la sesión vence (401) se cierra la sesión y no se siguen registrando accesos', async () => {
      const llamadas = abrir('recepcionista', [{ status: 401, cuerpo: { error: { code: 'UNAUTHORIZED', message: 'La sesión no es válida o ya venció.' } } }]);
      await screen.findByText('Colócate frente a la cámara');
      await avanzar(1000);
      await waitFor(() => expect(sessionStorage.getItem('gym_token')).toBeNull());
      const enviados = identificaciones(llamadas).length;
      expect(enviados).toBe(1);
      expect(screen.queryByText('Acceso autorizado')).not.toBeInTheDocument();
    });
  });
});
