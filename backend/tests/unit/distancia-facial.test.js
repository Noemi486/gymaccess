import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buscarCoincidencia, distanciaEuclidiana, UMBRAL_COINCIDENCIA } from '../../src/utils/distanciaFacial.js';

const base = Array.from({ length: 128 }, (_, i) => Math.cos(i) * 0.3);

// Vector a distancia exacta `d` de `origen` (se desplaza solo la primera coordenada).
const aDistancia = (origen, d) => origen.map((v, i) => (i === 0 ? v + d : v));

describe('distanciaEuclidiana', () => {
  it('es 0 entre vectores iguales y conocida entre vectores distintos', () => {
    assert.equal(distanciaEuclidiana(base, base), 0);
    assert.ok(Math.abs(distanciaEuclidiana(base, aDistancia(base, 0.5)) - 0.5) < 1e-12);
    assert.equal(distanciaEuclidiana([0, 0], [3, 4]), 5);
  });

  it('exige el mismo tamaño', () => {
    assert.throws(() => distanciaEuclidiana([1, 2], [1]), /mismo tamaño/);
  });
});

describe('buscarCoincidencia (umbral 0.5)', () => {
  it('el umbral por defecto es 0.5', () => {
    assert.equal(UMBRAL_COINCIDENCIA, 0.5);
  });

  it('un solo cliente dentro del umbral es una coincidencia clara', () => {
    const resultado = buscarCoincidencia(base, [
      { id_cliente: 1, descriptor: aDistancia(base, 0.2) },
      { id_cliente: 2, descriptor: aDistancia(base, 2) },
    ]);
    assert.equal(resultado.tipo, 'clara');
    assert.equal(resultado.id_cliente, 1);
    assert.ok(resultado.distancia < 0.5);
  });

  it('exactamente 0.5 coincide; un poco más no', () => {
    assert.equal(buscarCoincidencia(base, [{ id_cliente: 1, descriptor: aDistancia(base, 0.5) }]).tipo, 'clara');
    assert.equal(buscarCoincidencia(base, [{ id_cliente: 1, descriptor: aDistancia(base, 0.5001) }]).tipo, 'ninguna');
  });

  it('un cliente con varios rostros cuenta como uno solo', () => {
    const resultado = buscarCoincidencia(base, [
      { id_cliente: 1, descriptor: aDistancia(base, 0.1) },
      { id_cliente: 1, descriptor: aDistancia(base, 0.3) },
    ]);
    assert.equal(resultado.tipo, 'clara');
    assert.equal(resultado.id_cliente, 1);
    assert.ok(Math.abs(resultado.distancia - 0.1) < 1e-9, 'usa la mejor distancia del cliente');
  });

  it('dos clientes distintos dentro del umbral son una coincidencia ambigua (se rechaza)', () => {
    const resultado = buscarCoincidencia(base, [
      { id_cliente: 1, descriptor: aDistancia(base, 0.2) },
      { id_cliente: 2, descriptor: aDistancia(base, 0.45) },
    ]);
    assert.deepEqual(resultado, { tipo: 'ambigua' });
  });

  it('sin candidatos o todos lejos no hay coincidencia', () => {
    assert.deepEqual(buscarCoincidencia(base, []), { tipo: 'ninguna' });
    assert.deepEqual(buscarCoincidencia(base, [{ id_cliente: 1, descriptor: aDistancia(base, 3) }]), { tipo: 'ninguna' });
  });

  it('acepta un umbral distinto', () => {
    const candidatos = [{ id_cliente: 1, descriptor: aDistancia(base, 0.55) }];
    assert.equal(buscarCoincidencia(base, candidatos, 0.5).tipo, 'ninguna');
    assert.equal(buscarCoincidencia(base, candidatos, 0.6).tipo, 'clara');
  });

  it('funciona con Float32Array', () => {
    const f = new Float32Array(base);
    assert.equal(buscarCoincidencia(base, [{ id_cliente: 9, descriptor: f }]).tipo, 'clara');
  });
});
