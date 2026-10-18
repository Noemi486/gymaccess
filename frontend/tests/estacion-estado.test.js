import { describe, it, expect } from 'vitest';
import {
  DURACION_RESULTADO_MS,
  ENFRIAMIENTO_MS,
  MAX_NO_RECONOCIDOS,
  PAUSA_MS,
  estacionReducer,
  estadoInicial,
  promediar,
  puedeEnviar,
} from '../src/hooks/useEstacion.js';

// Reductor puro de la Estación de acceso, con tiempos simulados (milisegundos).

const autorizado = {
  resultado: 'autorizado',
  id_acceso: 1,
  cliente: { id_cliente: 7, nombre: 'Min', apellido: 'Cabrera' },
  membresia: { plan: 'Plan Mensual', fecha_fin: '2026-11-12', dias_restantes: 29 },
};
const noReconocido = { resultado: 'rechazado', id_acceso: 2, motivo: 'Rostro no reconocido' };
const rechazadoConCliente = { resultado: 'rechazado', id_acceso: 3, motivo: 'Pago pendiente', cliente: { id_cliente: 9, nombre: 'Luis', apellido: 'Soto' } };

const aplicar = (estado, ...acciones) => acciones.reduce(estacionReducer, estado);
const enEspera = () => estacionReducer(estadoInicial, { tipo: 'modelos_listos' });

// Un intento completo: enviar en `t` y recibir la respuesta en `t`.
const intento = (estado, respuesta, t) => aplicar(estado, { tipo: 'enviar', ahora: t }, { tipo: 'respuesta', respuesta, ahora: t });

describe('estacionReducer', () => {
  it('empieza cargando los modelos y pasa a la espera cuando están listos', () => {
    expect(estadoInicial.fase).toBe('cargando_modelos');
    expect(enEspera().fase).toBe('espera');
  });

  it('espera → analizando → resultado', () => {
    const espera = enEspera();
    const analizando = estacionReducer(espera, { tipo: 'enviar', ahora: 1000 });
    expect(analizando.fase).toBe('analizando');
    const resultado = estacionReducer(analizando, { tipo: 'respuesta', respuesta: autorizado, ahora: 1100 });
    expect(resultado.fase).toBe('resultado');
    expect(resultado.resultado).toBe(autorizado);
  });

  it('el resultado dura 5 s y luego la estación vuelve sola a la espera', () => {
    const resultado = intento(enEspera(), autorizado, 1000);
    expect(DURACION_RESULTADO_MS).toBe(5000);
    expect(estacionReducer(resultado, { tipo: 'tick', ahora: 5999 }).fase).toBe('resultado');
    const espera = estacionReducer(resultado, { tipo: 'tick', ahora: 6000 });
    expect(espera.fase).toBe('espera');
    expect(espera.resultado).toBeNull();
  });

  describe('enfriamiento de 10 s para la misma persona', () => {
    it('no vuelve a enviar mientras la misma persona sigue ahí', () => {
      const t0 = 1000;
      const espera = estacionReducer(intento(enEspera(), autorizado, t0), { tipo: 'tick', ahora: t0 + 5000 });
      expect(espera.fase).toBe('espera');
      expect(ENFRIAMIENTO_MS).toBe(10_000);
      expect(puedeEnviar(espera, t0 + 9999)).toBe(false);
      expect(estacionReducer(espera, { tipo: 'enviar', ahora: t0 + 9999 })).toBe(espera);
      expect(puedeEnviar(espera, t0 + 10_000)).toBe(true);
      expect(estacionReducer(espera, { tipo: 'enviar', ahora: t0 + 10_000 }).fase).toBe('analizando');
    });

    it('si la persona se fue, la siguiente se acepta sin esperar el enfriamiento', () => {
      const espera = estacionReducer(intento(enEspera(), autorizado, 1000), { tipo: 'tick', ahora: 6000 });
      expect(puedeEnviar(espera, 7000)).toBe(false);
      const libre = estacionReducer(espera, { tipo: 'persona_ausente' });
      expect(puedeEnviar(libre, 7000)).toBe(true);
    });

    it('un fallo de red vuelve a la espera con un aviso y reintenta pronto', () => {
      const analizando = estacionReducer(enEspera(), { tipo: 'enviar', ahora: 1000 });
      const espera = estacionReducer(analizando, { tipo: 'fallo_envio', ahora: 1200 });
      expect(espera.fase).toBe('espera');
      expect(espera.aviso).toMatch(/no se pudo verificar/i);
      expect(puedeEnviar(espera, 1200 + 2999)).toBe(false);
      expect(puedeEnviar(espera, 1200 + 3000)).toBe(true);
    });
  });

  describe('3 "Rostro no reconocido" seguidos', () => {
    it('los dos primeros muestran el resultado normal; el tercero pausa la estación 30 s', () => {
      expect(MAX_NO_RECONOCIDOS).toBe(3);
      expect(PAUSA_MS).toBe(30_000);
      let estado = enEspera();
      estado = estacionReducer(intento(estado, noReconocido, 1000), { tipo: 'tick', ahora: 6000 });
      expect(estado.fallos).toBe(1);
      estado = estacionReducer(intento(estado, noReconocido, 20_000), { tipo: 'tick', ahora: 25_000 });
      expect(estado.fallos).toBe(2);
      expect(estado.fase).toBe('espera');

      estado = intento(estado, noReconocido, 40_000);
      expect(estado.fase).toBe('pausa');
      expect(estado.resultado).toBe(noReconocido); // el tercero también se registra y se muestra
      expect(estado.hasta).toBe(40_000 + 30_000);
    });

    it('durante la pausa no se envía nada, ni siquiera sin enfriamiento', () => {
      let estado = enEspera();
      for (const t of [1000, 20_000, 40_000]) estado = intento(estacionReducer(estado, { tipo: 'tick', ahora: t - 1 }), noReconocido, t);
      expect(estado.fase).toBe('pausa');
      const sinEnfriamiento = estacionReducer(estado, { tipo: 'persona_ausente' });
      expect(puedeEnviar(sinEnfriamiento, 50_000)).toBe(false);
      expect(estacionReducer(sinEnfriamiento, { tipo: 'enviar', ahora: 50_000 }).fase).toBe('pausa');
      expect(estacionReducer(sinEnfriamiento, { tipo: 'tick', ahora: 69_999 }).fase).toBe('pausa');
    });

    it('al terminar la pausa vuelve a la espera con el conteo en cero', () => {
      let estado = enEspera();
      for (const t of [1000, 20_000, 40_000]) estado = intento(estacionReducer(estado, { tipo: 'tick', ahora: t - 1 }), noReconocido, t);
      const espera = estacionReducer(estado, { tipo: 'tick', ahora: 70_000 });
      expect(espera.fase).toBe('espera');
      expect(espera.fallos).toBe(0);
      expect(espera.resultado).toBeNull();
    });

    it('un cliente identificado reinicia el conteo, aunque su acceso se rechace por otro motivo', () => {
      let estado = enEspera();
      estado = estacionReducer(intento(estado, noReconocido, 1000), { tipo: 'tick', ahora: 6000 });
      estado = estacionReducer(intento(estado, noReconocido, 20_000), { tipo: 'tick', ahora: 25_000 });
      expect(estado.fallos).toBe(2);
      estado = estacionReducer(intento(estado, rechazadoConCliente, 40_000), { tipo: 'tick', ahora: 45_000 });
      expect(estado.fallos).toBe(0);
      // Hacen falta otros tres para pausar.
      estado = estacionReducer(intento(estado, noReconocido, 60_000), { tipo: 'tick', ahora: 65_000 });
      expect(estado.fase).toBe('espera');
    });

    it('un acceso autorizado también reinicia el conteo', () => {
      let estado = estacionReducer(intento(enEspera(), noReconocido, 1000), { tipo: 'tick', ahora: 6000 });
      estado = estacionReducer(intento(estado, autorizado, 20_000), { tipo: 'tick', ahora: 25_000 });
      expect(estado.fallos).toBe(0);
    });
  });

  describe('otras fases', () => {
    it('sin cámara o sin modelos queda en error_camara y no envía nada', () => {
      const error = estacionReducer(enEspera(), { tipo: 'camara_error', error: 'denegada' });
      expect(error.fase).toBe('error_camara');
      expect(error.error).toBe('denegada');
      expect(puedeEnviar(error, 99_999)).toBe(false);
      expect(estacionReducer(error, { tipo: 'camara_lista' }).fase).toBe('espera');
    });

    it('solo se envía desde la espera', () => {
      const cargando = estadoInicial;
      expect(estacionReducer(cargando, { tipo: 'enviar', ahora: 1 })).toBe(cargando);
      const analizando = estacionReducer(enEspera(), { tipo: 'enviar', ahora: 1000 });
      expect(estacionReducer(analizando, { tipo: 'enviar', ahora: 99_000 })).toBe(analizando);
    });

    it('ignora una respuesta que llega cuando ya no se estaba analizando', () => {
      const espera = enEspera();
      expect(estacionReducer(espera, { tipo: 'respuesta', respuesta: autorizado, ahora: 1 })).toBe(espera);
    });
  });
});

describe('promediar', () => {
  it('promedia varios descriptores coordenada a coordenada', () => {
    expect(promediar([[0, 2, 4], [2, 4, 6]])).toEqual([1, 3, 5]);
  });
});
