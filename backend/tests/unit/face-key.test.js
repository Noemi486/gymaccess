import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { leerFaceKey } from '../../src/config/faceKey.js';

const VALIDA = 'a1'.repeat(32);

describe('leerFaceKey', () => {
  it('acepta 64 caracteres hexadecimales y devuelve 32 bytes', () => {
    const clave = leerFaceKey(VALIDA);
    assert.ok(Buffer.isBuffer(clave));
    assert.equal(clave.length, 32);
    assert.equal(clave[0], 0xa1);
  });

  it('acepta mayúsculas y espacios alrededor', () => {
    assert.equal(leerFaceKey(`  ${VALIDA.toUpperCase()}  `).length, 32);
  });

  it('rechaza una clave ausente, vacía o que no es texto', () => {
    for (const valor of [undefined, null, '', '   ', 123, {}]) {
      assert.throws(() => leerFaceKey(valor), /FACE_KEY debe tener 64 caracteres hexadecimales/);
    }
  });

  it('rechaza una clave corta, larga o con caracteres no hexadecimales', () => {
    for (const valor of [VALIDA.slice(0, 63), `${VALIDA}0`, `${VALIDA.slice(0, 63)}z`, `${VALIDA.slice(0, 62)}  `]) {
      assert.throws(() => leerFaceKey(valor), /FACE_KEY/);
    }
  });

  it('el mensaje de error no contiene la clave recibida', () => {
    const casi = `${VALIDA.slice(0, 63)}z`;
    try {
      leerFaceKey(casi);
      assert.fail('debió lanzar un error');
    } catch (error) {
      assert.ok(!error.message.includes(casi));
      assert.ok(!error.message.includes(VALIDA.slice(0, 20)));
    }
  });
});
