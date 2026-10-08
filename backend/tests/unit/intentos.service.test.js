import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioIntentos } from '../../src/services/intentos.service.js';

// Reloj controlado para no esperar 15 minutos reales.
function crear() {
  const reloj = { ahora: 1_000_000 };
  const servicio = crearServicioIntentos({
    maxIntentos: 5,
    minutosBloqueo: 15,
    ahora: () => reloj.ahora,
  });
  return { servicio, reloj };
}

const MINUTO = 60_000;

describe('intentos.service (bloqueo por intentos fallidos, FR-003a)', () => {
  it('no bloquea con menos de 5 fallos', () => {
    const { servicio } = crear();
    for (let i = 0; i < 4; i += 1) servicio.registrarFallo('ana@example.com');
    assert.equal(servicio.estaBloqueado('ana@example.com'), false);
  });

  it('bloquea la cuenta tras 5 fallos seguidos', () => {
    const { servicio } = crear();
    for (let i = 0; i < 5; i += 1) servicio.registrarFallo('ana@example.com');
    assert.equal(servicio.estaBloqueado('ana@example.com'), true);
  });

  it('sigue bloqueada a los 14 minutos y se desbloquea a los 15', () => {
    const { servicio, reloj } = crear();
    for (let i = 0; i < 5; i += 1) servicio.registrarFallo('ana@example.com');
    reloj.ahora += 14 * MINUTO;
    assert.equal(servicio.estaBloqueado('ana@example.com'), true);
    reloj.ahora += 1 * MINUTO;
    assert.equal(servicio.estaBloqueado('ana@example.com'), false);
  });

  it('tras desbloquearse, el conteo empieza de cero', () => {
    const { servicio, reloj } = crear();
    for (let i = 0; i < 5; i += 1) servicio.registrarFallo('ana@example.com');
    reloj.ahora += 15 * MINUTO;
    for (let i = 0; i < 4; i += 1) servicio.registrarFallo('ana@example.com');
    assert.equal(servicio.estaBloqueado('ana@example.com'), false);
    servicio.registrarFallo('ana@example.com');
    assert.equal(servicio.estaBloqueado('ana@example.com'), true);
  });

  it('un inicio de sesión exitoso reinicia el conteo', () => {
    const { servicio } = crear();
    for (let i = 0; i < 4; i += 1) servicio.registrarFallo('ana@example.com');
    servicio.registrarExito('ana@example.com');
    for (let i = 0; i < 4; i += 1) servicio.registrarFallo('ana@example.com');
    assert.equal(servicio.estaBloqueado('ana@example.com'), false);
  });

  it('también cuenta los correos que no existen (no revela si existen)', () => {
    const { servicio } = crear();
    for (let i = 0; i < 5; i += 1) servicio.registrarFallo('no-existe@example.com');
    assert.equal(servicio.estaBloqueado('no-existe@example.com'), true);
  });

  it('el bloqueo de una cuenta no afecta a otra', () => {
    const { servicio } = crear();
    for (let i = 0; i < 5; i += 1) servicio.registrarFallo('ana@example.com');
    assert.equal(servicio.estaBloqueado('luis@example.com'), false);
  });

  it('respeta los límites configurados (3 intentos, 1 minuto)', () => {
    const reloj = { ahora: 0 };
    const servicio = crearServicioIntentos({ maxIntentos: 3, minutosBloqueo: 1, ahora: () => reloj.ahora });
    for (let i = 0; i < 3; i += 1) servicio.registrarFallo('ana@example.com');
    assert.equal(servicio.estaBloqueado('ana@example.com'), true);
    reloj.ahora += MINUTO;
    assert.equal(servicio.estaBloqueado('ana@example.com'), false);
  });
});
