import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { crearAuthService } from '../../src/services/auth.service.js';
import { crearServicioIntentos } from '../../src/services/intentos.service.js';

const SECRETO = 'secreto-de-prueba-para-pruebas-unitarias';
const PASSWORD = 'Secreta123';
const HASH = bcrypt.hashSync(PASSWORD, 4); // costo bajo: solo para que la prueba sea rápida

function usuarioDe(extra = {}) {
  return {
    id_usuario: 7,
    nombre: 'Rita Recepción',
    correo: 'rita@example.com',
    password: HASH,
    rol: 'recepcionista',
    estado: 'activo',
    id_cliente: null,
    fecha_registro: new Date('2026-10-01T10:00:00Z'),
    ...extra,
  };
}

describe('auth.service.iniciarSesion', () => {
  let usuarios;
  let servicio;
  let intentos;

  beforeEach(() => {
    usuarios = new Map([['rita@example.com', usuarioDe()]]);
    intentos = crearServicioIntentos({ maxIntentos: 5, minutosBloqueo: 15 });
    servicio = crearAuthService({
      modelo: { buscarPorCorreo: async (correo) => usuarios.get(correo) ?? null },
      intentos,
      config: { jwtSecreto: SECRETO, jwtExpiracion: '8h', costoBcrypt: 4 },
    });
  });

  it('con credenciales correctas devuelve token y usuario sin password', async () => {
    const { token, usuario } = await servicio.iniciarSesion('rita@example.com', PASSWORD);

    assert.equal(usuario.rol, 'recepcionista');
    assert.equal(usuario.correo, 'rita@example.com');
    assert.equal('password' in usuario, false);
    assert.ok(!JSON.stringify(usuario).includes(HASH));

    const payload = jwt.verify(token, SECRETO, { algorithms: ['HS256'] });
    assert.equal(payload.sub, '7');
    assert.ok(payload.exp - payload.iat === 8 * 3600, 'el token vence a las 8 horas');
  });

  it('contraseña errónea, correo inexistente y cuenta inactiva dan el mismo 401', async () => {
    usuarios.set('baja@example.com', usuarioDe({ correo: 'baja@example.com', estado: 'inactivo' }));

    const errores = [];
    for (const [correo, password] of [
      ['rita@example.com', 'Incorrecta999'],
      ['nadie@example.com', PASSWORD],
      ['baja@example.com', PASSWORD], // contraseña correcta pero cuenta desactivada
    ]) {
      await assert.rejects(servicio.iniciarSesion(correo, password), (error) => {
        errores.push(error);
        return true;
      });
    }

    for (const error of errores) {
      assert.equal(error.status, 401);
      assert.equal(error.code, 'UNAUTHORIZED');
    }
    assert.equal(new Set(errores.map((e) => e.message)).size, 1, 'el mensaje es idéntico en los tres casos');
  });

  it('un cliente dado de baja no inicia sesión: mismo 401 genérico aunque la contraseña sea correcta (FR-003b)', async () => {
    usuarios.set('cli@example.com', usuarioDe({ correo: 'cli@example.com', rol: 'cliente', id_cliente: 9, estado_cliente: 'inactivo' }));

    const errores = [];
    for (const [correo, password] of [
      ['cli@example.com', PASSWORD], // cliente inactivo, contraseña correcta
      ['rita@example.com', 'Incorrecta999'], // contraseña errónea, para comparar el mensaje
    ]) {
      await assert.rejects(servicio.iniciarSesion(correo, password), (error) => {
        errores.push(error);
        return true;
      });
    }
    assert.equal(errores[0].status, 401);
    assert.equal(errores[0].message, errores[1].message, 'no revela que el cliente está dado de baja');
  });

  it('un cliente activo sí inicia sesión y las cuentas del personal no dependen de ningún cliente', async () => {
    usuarios.set('cli@example.com', usuarioDe({ correo: 'cli@example.com', rol: 'cliente', id_cliente: 9, estado_cliente: 'activo' }));
    const cliente = await servicio.iniciarSesion('cli@example.com', PASSWORD);
    assert.equal(cliente.usuario.rol, 'cliente');
    assert.equal('estado_cliente' in cliente.usuario, false, 'el estado interno del cliente no se expone');

    const personal = await servicio.iniciarSesion('rita@example.com', PASSWORD); // estado_cliente indefinido
    assert.equal(personal.usuario.rol, 'recepcionista');
  });

  it('tras 5 fallos seguidos devuelve 423 aunque la contraseña sea correcta', async () => {
    for (let i = 0; i < 5; i += 1) {
      await assert.rejects(servicio.iniciarSesion('rita@example.com', 'Incorrecta999'), { status: 401 });
    }
    await assert.rejects(servicio.iniciarSesion('rita@example.com', PASSWORD), {
      status: 423,
      code: 'ACCOUNT_LOCKED',
    });
  });

  it('un inicio de sesión exitoso reinicia el conteo de fallos', async () => {
    for (let i = 0; i < 4; i += 1) {
      await assert.rejects(servicio.iniciarSesion('rita@example.com', 'Incorrecta999'), { status: 401 });
    }
    await servicio.iniciarSesion('rita@example.com', PASSWORD);
    for (let i = 0; i < 4; i += 1) {
      await assert.rejects(servicio.iniciarSesion('rita@example.com', 'Incorrecta999'), { status: 401 });
    }
    // Sigue sin bloquearse: 4 fallos desde el último éxito.
    const { usuario } = await servicio.iniciarSesion('rita@example.com', PASSWORD);
    assert.equal(usuario.id_usuario, 7);
  });

  it('bloquea también un correo inexistente (no revela si existe)', async () => {
    for (let i = 0; i < 5; i += 1) {
      await assert.rejects(servicio.iniciarSesion('nadie@example.com', PASSWORD), { status: 401 });
    }
    await assert.rejects(servicio.iniciarSesion('nadie@example.com', PASSWORD), { status: 423 });
  });
});
