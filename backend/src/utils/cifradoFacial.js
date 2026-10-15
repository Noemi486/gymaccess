import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Cifrado de los descriptores faciales con AES-256-GCM (research R5).
//
// Formato del BLOB (541 bytes):
//   1 byte   versión del formato (0x01)
//   12 bytes IV aleatorio (distinto en cada cifrado)
//   16 bytes etiqueta de autenticación de GCM
//   512 bytes descriptor: 128 float32 little-endian, cifrado
// Datos autenticados: "rostro:<id_cliente>". Así un blob copiado a la fila de otro cliente no descifra.
//
// Los errores son genéricos a propósito: nunca incluyen el descriptor ni la clave.

const VERSION = 0x01;
const LARGO_IV = 12;
const LARGO_ETIQUETA = 16;
const VALORES = 128;
const LARGO_DESCRIPTOR = VALORES * 4;
export const LARGO_BLOB = 1 + LARGO_IV + LARGO_ETIQUETA + LARGO_DESCRIPTOR;

const ERROR = 'No se pudo procesar la información facial.';

function datosAutenticados(idCliente) {
  return Buffer.from(`rostro:${idCliente}`, 'utf8');
}

function validarClave(clave) {
  if (!Buffer.isBuffer(clave) || clave.length !== 32) throw new Error(ERROR);
}

export function cifrarDescriptor(descriptor, idCliente, clave) {
  validarClave(clave);
  if (!descriptor || descriptor.length !== VALORES) throw new Error(ERROR);

  const plano = Buffer.alloc(LARGO_DESCRIPTOR);
  for (let i = 0; i < VALORES; i += 1) {
    const valor = Number(descriptor[i]);
    if (!Number.isFinite(valor)) throw new Error(ERROR);
    plano.writeFloatLE(valor, i * 4);
  }

  const iv = randomBytes(LARGO_IV);
  const cifrador = createCipheriv('aes-256-gcm', clave, iv, { authTagLength: LARGO_ETIQUETA });
  cifrador.setAAD(datosAutenticados(idCliente));
  const cifrado = Buffer.concat([cifrador.update(plano), cifrador.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, cifrador.getAuthTag(), cifrado]);
}

export function descifrarDescriptor(blob, idCliente, clave) {
  validarClave(clave);
  if (!Buffer.isBuffer(blob) || blob.length !== LARGO_BLOB || blob[0] !== VERSION) throw new Error(ERROR);

  const iv = blob.subarray(1, 1 + LARGO_IV);
  const etiqueta = blob.subarray(1 + LARGO_IV, 1 + LARGO_IV + LARGO_ETIQUETA);
  const cifrado = blob.subarray(1 + LARGO_IV + LARGO_ETIQUETA);

  try {
    const descifrador = createDecipheriv('aes-256-gcm', clave, iv, { authTagLength: LARGO_ETIQUETA });
    descifrador.setAAD(datosAutenticados(idCliente));
    descifrador.setAuthTag(etiqueta);
    const plano = Buffer.concat([descifrador.update(cifrado), descifrador.final()]);
    const descriptor = new Float32Array(VALORES);
    for (let i = 0; i < VALORES; i += 1) descriptor[i] = plano.readFloatLE(i * 4);
    return descriptor;
  } catch {
    throw new Error(ERROR);
  }
}
