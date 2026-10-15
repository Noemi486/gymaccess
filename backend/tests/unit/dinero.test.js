import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aCentavos, deCentavos, formatearMonto } from '../../src/utils/dinero.js';

describe('aCentavos', () => {
  it('convierte textos DECIMAL y números a centavos enteros', () => {
    assert.equal(aCentavos('450.00'), 45000);
    assert.equal(aCentavos('450'), 45000);
    assert.equal(aCentavos('450.5'), 45050);
    assert.equal(aCentavos(450.5), 45050);
    assert.equal(aCentavos(0.1), 10);
    assert.equal(aCentavos('0.01'), 1);
    assert.equal(aCentavos(' 99999999.99 '), 9999999999);
  });

  it('no sufre errores de punto flotante al sumar', () => {
    assert.equal(aCentavos(0.1) + aCentavos(0.2), aCentavos(0.3));
    assert.equal(aCentavos('19.99') * 3, aCentavos('59.97'));
  });

  it('rechaza montos con más de dos decimales', () => {
    assert.throws(() => aCentavos('450.001'), /Monto no válido/);
    assert.throws(() => aCentavos(0.001), /Monto no válido/);
  });

  it('rechaza negativos, texto, vacío, NaN e infinito', () => {
    for (const valor of ['-1', -5, 'abc', '', '  ', null, undefined, NaN, Infinity, '1,000.00', '1e3', '.5']) {
      assert.throws(() => aCentavos(valor), /Monto no válido/, String(valor));
    }
  });
});

describe('deCentavos y formatearMonto', () => {
  it('convierte de centavos a número con dos decimales', () => {
    assert.equal(deCentavos(45000), 450);
    assert.equal(deCentavos(45050), 450.5);
    assert.equal(deCentavos(1), 0.01);
  });

  it('da formato de moneda con separador de miles', () => {
    assert.equal(formatearMonto(45000), '$450.00');
    assert.equal(formatearMonto(125000), '$1,250.00');
    assert.equal(formatearMonto(100000000), '$1,000,000.00');
    assert.equal(formatearMonto(5), '$0.05');
  });
});
