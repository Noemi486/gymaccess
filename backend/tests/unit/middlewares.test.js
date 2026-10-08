import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { crearAutenticar } from '../../src/middlewares/autenticar.js';
import { autorizar } from '../../src/middlewares/autorizar.js';

const SECRETO = 'secreto-de-prueba-para-pruebas-unitarias';

const usuarioActivo = {
  id_usuario: 3,
  nombre: 'Ema',
  correo: 'ema@example.com',
  password: '$2a$10$hash-que-no-debe-salir',
  rol: 'entrenador',
  estado: 'activo',
  id_cliente: null,
  fecha_registro: new Date('2026-10-01T10:00:00Z'),
};

function crear(usuariosPorId) {
  return crearAutenticar({
    secreto: SECRETO,
    buscarPorId: async (id) => usuariosPorId[id] ?? null,
  });
}

// Ejecuta un middleware y devuelve el argumento con que llamó a next().
async function ejecutar(middleware, req) {
  let resultado;
  await middleware(req, {}, (valor) => {
    resultado = valor;
  });
  return resultado;
}

const firmar = (sub, opciones = {}) =>
  jwt.sign({ sub: String(sub) }, opciones.secreto ?? SECRETO, {
    algorithm: opciones.algoritmo ?? 'HS256',
    expiresIn: opciones.expiracion ?? '1h',
  });

describe('middleware autenticar', () => {
  const autenticar = crear({ 3: usuarioActivo, 4: { ...usuarioActivo, id_usuario: 4, estado: 'inactivo' } });

  it('sin cabecera Authorization responde 401', async () => {
    const error = await ejecutar(autenticar, { headers: {} });
    assert.equal(error.status, 401);
    assert.equal(error.code, 'UNAUTHORIZED');
  });

  it('con un esquema distinto de Bearer responde 401', async () => {
    const error = await ejecutar(autenticar, { headers: { authorization: `Basic ${firmar(3)}` } });
    assert.equal(error.status, 401);
  });

  it('con un token basura responde 401', async () => {
    const error = await ejecutar(autenticar, { headers: { authorization: 'Bearer abc.def.ghi' } });
    assert.equal(error.status, 401);
  });

  it('con un token alterado responde 401', async () => {
    const token = firmar(3);
    const alterado = `${token.slice(0, -2)}${token.endsWith('AA') ? 'BB' : 'AA'}`;
    const error = await ejecutar(autenticar, { headers: { authorization: `Bearer ${alterado}` } });
    assert.equal(error.status, 401);
  });

  it('con un token firmado con otro secreto responde 401', async () => {
    const token = firmar(3, { secreto: 'otro-secreto-completamente-distinto' });
    const error = await ejecutar(autenticar, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(error.status, 401);
  });

  it('con un algoritmo distinto de HS256 responde 401', async () => {
    const token = firmar(3, { algoritmo: 'HS512' });
    const error = await ejecutar(autenticar, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(error.status, 401);
  });

  it('con un token vencido responde 401', async () => {
    const token = firmar(3, { expiracion: -10 });
    const error = await ejecutar(autenticar, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(error.status, 401);
  });

  it('si el usuario fue desactivado responde 401 de inmediato', async () => {
    const error = await ejecutar(autenticar, { headers: { authorization: `Bearer ${firmar(4)}` } });
    assert.equal(error.status, 401);
  });

  it('si es una cuenta de cliente y el cliente fue dado de baja responde 401 de inmediato (FR-003b)', async () => {
    const conClientes = crear({
      5: { ...usuarioActivo, id_usuario: 5, rol: 'cliente', id_cliente: 9, estado_cliente: 'inactivo' },
      6: { ...usuarioActivo, id_usuario: 6, rol: 'cliente', id_cliente: 10, estado_cliente: 'activo' },
    });
    const baja = await ejecutar(conClientes, { headers: { authorization: `Bearer ${firmar(5)}` } });
    assert.equal(baja.status, 401);

    const req = { headers: { authorization: `Bearer ${firmar(6)}` } };
    assert.equal(await ejecutar(conClientes, req), undefined);
    assert.equal('estado_cliente' in req.usuario, false, 'el estado del cliente no llega a req.usuario');
  });

  it('si el usuario ya no existe responde 401', async () => {
    const error = await ejecutar(autenticar, { headers: { authorization: `Bearer ${firmar(99)}` } });
    assert.equal(error.status, 401);
  });

  it('con un token válido deja req.usuario (sin password) y llama a next() sin error', async () => {
    const req = { headers: { authorization: `Bearer ${firmar(3)}` } };
    const resultado = await ejecutar(autenticar, req);

    assert.equal(resultado, undefined);
    assert.equal(req.usuario.id_usuario, 3);
    assert.equal(req.usuario.rol, 'entrenador');
    assert.equal('password' in req.usuario, false);
  });
});

describe('middleware autorizar', () => {
  it('permite el paso a un rol incluido', async () => {
    const resultado = await ejecutar(autorizar('administrador', 'recepcionista'), {
      usuario: { rol: 'recepcionista' },
    });
    assert.equal(resultado, undefined);
  });

  it('responde 403 a un rol no incluido', async () => {
    const error = await ejecutar(autorizar('administrador'), { usuario: { rol: 'entrenador' } });
    assert.equal(error.status, 403);
    assert.equal(error.code, 'FORBIDDEN');
  });

  it('responde 401 si no hay usuario autenticado', async () => {
    const error = await ejecutar(autorizar('administrador'), {});
    assert.equal(error.status, 401);
  });
});
