import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { descriptorEsquema } from '../../src/validators/descriptor.validator.js';

const valido = () => Array.from({ length: 128 }, (_, i) => Math.sin(i + 1) * 0.4);
const aceptado = (valor) => descriptorEsquema.safeParse(valor).success;

describe('descriptorEsquema', () => {
  it('acepta 128 números finitos dentro de ±5', () => {
    assert.equal(aceptado(valido()), true);
  });

  it('acepta los límites -5 y 5', () => {
    const d = valido();
    d[0] = 5;
    d[1] = -5;
    assert.equal(aceptado(d), true);
  });

  it('rechaza una longitud distinta de 128', () => {
    assert.equal(aceptado(valido().slice(0, 127)), false);
    assert.equal(aceptado([...valido(), 0.1]), false);
    assert.equal(aceptado([]), false);
  });

  it('rechaza NaN, Infinity y valores que no son números', () => {
    for (const malo of [NaN, Infinity, -Infinity, '0.1', null, undefined, {}, true]) {
      const d = valido();
      d[10] = malo;
      assert.equal(aceptado(d), false, String(malo));
    }
  });

  it('rechaza valores fuera de ±5', () => {
    for (const fuera of [5.0001, -5.0001, 100, -1e9]) {
      const d = valido();
      d[3] = fuera;
      assert.equal(aceptado(d), false, String(fuera));
    }
  });

  it('rechaza un descriptor con todos los valores en cero', () => {
    assert.equal(aceptado(new Array(128).fill(0)), false);
  });

  it('rechaza lo que no es un arreglo', () => {
    for (const malo of [undefined, null, 'texto', 5, {}, { length: 128 }]) {
      assert.equal(aceptado(malo), false);
    }
  });

  it('los mensajes de error no repiten los valores recibidos', () => {
    const d = valido();
    d[0] = 12345.6789;
    const resultado = descriptorEsquema.safeParse(d);
    assert.equal(resultado.success, false);
    assert.ok(!JSON.stringify(resultado.error.issues).includes('12345'));
  });
});
