import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { cifrarDescriptor, descifrarDescriptor, LARGO_BLOB } from '../../src/utils/cifradoFacial.js';

const clave = randomBytes(32);
const descriptor = Array.from({ length: 128 }, (_, i) => Math.sin(i + 1) * 0.4);

function aFloat32(arreglo) {
  return Array.from(new Float32Array(arreglo));
}

describe('cifrado del descriptor facial (AES-256-GCM)', () => {
  it('cifra y descifra devolviendo el mismo descriptor (con la precisión de float32)', () => {
    const blob = cifrarDescriptor(descriptor, 7, clave);
    const resultado = descifrarDescriptor(blob, 7, clave);
    assert.equal(resultado.length, 128);
    assert.deepEqual(Array.from(resultado), aFloat32(descriptor));
  });

  it('el blob mide 541 bytes y empieza con la versión 0x01', () => {
    const blob = cifrarDescriptor(descriptor, 7, clave);
    assert.equal(blob.length, 541);
    assert.equal(blob.length, LARGO_BLOB);
    assert.equal(blob[0], 0x01);
  });

  it('usa un IV distinto en cada cifrado y por eso dos blobs del mismo descriptor difieren', () => {
    const a = cifrarDescriptor(descriptor, 7, clave);
    const b = cifrarDescriptor(descriptor, 7, clave);
    assert.notDeepEqual(a.subarray(1, 13), b.subarray(1, 13));
    assert.notDeepEqual(a, b);
  });

  it('el descriptor no aparece en claro dentro del blob', () => {
    const blob = cifrarDescriptor(descriptor, 7, clave);
    const plano = Buffer.alloc(512);
    descriptor.forEach((valor, i) => plano.writeFloatLE(valor, i * 4));
    assert.equal(blob.includes(plano.subarray(0, 32)), false);
    assert.equal(blob.subarray(30).includes(plano.subarray(0, 16)), false);
  });

  it('un byte alterado en cualquier parte (versión, IV, etiqueta o datos) hace fallar el descifrado', () => {
    for (const posicion of [0, 1, 12, 13, 28, 29, 100, 540]) {
      const blob = Buffer.from(cifrarDescriptor(descriptor, 7, clave));
      blob[posicion] ^= 0x01;
      assert.throws(() => descifrarDescriptor(blob, 7, clave), /No se pudo procesar la información facial/, `byte ${posicion}`);
    }
  });

  it('un blob copiado a la fila de otro cliente no descifra', () => {
    const blob = cifrarDescriptor(descriptor, 7, clave);
    assert.throws(() => descifrarDescriptor(blob, 8, clave), /No se pudo procesar/);
  });

  it('una clave distinta no descifra', () => {
    const blob = cifrarDescriptor(descriptor, 7, clave);
    assert.throws(() => descifrarDescriptor(blob, 7, randomBytes(32)), /No se pudo procesar/);
  });

  it('rechaza una versión desconocida y longitudes incorrectas', () => {
    const blob = Buffer.from(cifrarDescriptor(descriptor, 7, clave));
    const otraVersion = Buffer.from(blob);
    otraVersion[0] = 0x02;
    assert.throws(() => descifrarDescriptor(otraVersion, 7, clave), /No se pudo procesar/);
    assert.throws(() => descifrarDescriptor(blob.subarray(0, 540), 7, clave), /No se pudo procesar/);
    assert.throws(() => descifrarDescriptor(Buffer.concat([blob, Buffer.from([0])]), 7, clave), /No se pudo procesar/);
    assert.throws(() => descifrarDescriptor(null, 7, clave), /No se pudo procesar/);
    assert.throws(() => descifrarDescriptor('texto', 7, clave), /No se pudo procesar/);
  });

  it('rechaza claves que no son de 32 bytes y descriptores que no son de 128 números finitos', () => {
    assert.throws(() => cifrarDescriptor(descriptor, 7, randomBytes(16)), /No se pudo procesar/);
    assert.throws(() => cifrarDescriptor(descriptor, 7, 'clave'), /No se pudo procesar/);
    assert.throws(() => cifrarDescriptor(descriptor.slice(0, 127), 7, clave), /No se pudo procesar/);
    assert.throws(() => cifrarDescriptor([...descriptor.slice(0, 127), NaN], 7, clave), /No se pudo procesar/);
    assert.throws(() => cifrarDescriptor(null, 7, clave), /No se pudo procesar/);
  });

  it('los errores nunca incluyen el descriptor ni la clave', () => {
    const blob = cifrarDescriptor(descriptor, 7, clave);
    try {
      descifrarDescriptor(blob, 9, clave);
      assert.fail('debió lanzar un error');
    } catch (error) {
      assert.ok(!error.message.includes(clave.toString('hex')));
      assert.ok(!error.message.includes(String(descriptor[0])));
    }
  });
});
