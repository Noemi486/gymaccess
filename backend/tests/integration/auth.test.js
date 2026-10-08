import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  iniciarServidor,
  solicitar,
  crearToken,
  crearUsuarioDePrueba,
  desactivarUsuarioDePrueba,
  cerrarPool,
} from '../helpers.js';

// Escenarios 1 a 4 de quickstart.md. Usa la base de pruebas gymaccess_test (npm test carga
// backend/.env.test) con cuentas "test+..." que al terminar quedan inactivas.

describe('API de autenticación', () => {
  let servidor;
  let recepcionista;
  let entrenador;
  let desactivado;
  const creados = [];

  before(async () => {
    servidor = await iniciarServidor();
    recepcionista = await crearUsuarioDePrueba({ rol: 'recepcionista', nombre: 'Rita Prueba' });
    entrenador = await crearUsuarioDePrueba({ rol: 'entrenador', nombre: 'Enzo Prueba' });
    desactivado = await crearUsuarioDePrueba({ rol: 'recepcionista', estado: 'inactivo' });
    creados.push(recepcionista, entrenador, desactivado);
  });

  after(async () => {
    try {
      for (const usuario of creados) await desactivarUsuarioDePrueba(usuario.id_usuario);
    } finally {
      await servidor.cerrar();
      await cerrarPool();
    }
  });

  const login = (correo, password) =>
    solicitar(servidor.url, 'POST', '/auth/login', { cuerpo: { correo, password } });

  it('inicia sesión con credenciales válidas y reconoce el rol (escenario 1)', async () => {
    const { status, cuerpo } = await login(recepcionista.correo, recepcionista.password);

    assert.equal(status, 200);
    assert.equal(typeof cuerpo.token, 'string');
    assert.equal(cuerpo.usuario.rol, 'recepcionista');
    assert.equal(cuerpo.usuario.correo, recepcionista.correo);
    assert.equal('password' in cuerpo.usuario, false);
    assert.ok(!JSON.stringify(cuerpo).includes('$2'), 'no debe aparecer ningún hash bcrypt');
  });

  it('acepta el correo con mayúsculas y espacios', async () => {
    const { status } = await login(`  ${recepcionista.correo.toUpperCase()} `, recepcionista.password);
    assert.equal(status, 200);
  });

  it('identifica un rol distinto (entrenador)', async () => {
    const { cuerpo } = await login(entrenador.correo, entrenador.password);
    assert.equal(cuerpo.usuario.rol, 'entrenador');
  });

  it('rechaza contraseña errónea, correo inexistente y cuenta inactiva con el mismo 401 (escenario 2)', async () => {
    const respuestas = await Promise.all([
      login(recepcionista.correo, 'Incorrecta999'),
      login('no-existe-nadie@example.com', recepcionista.password),
      login(desactivado.correo, desactivado.password),
    ]);

    for (const { status, cuerpo } of respuestas) {
      assert.equal(status, 401);
      assert.equal(cuerpo.error.code, 'UNAUTHORIZED');
    }
    assert.equal(new Set(respuestas.map((r) => r.cuerpo.error.message)).size, 1);
  });

  it('responde 400 con detalle por campo si faltan datos', async () => {
    const { status, cuerpo } = await solicitar(servidor.url, 'POST', '/auth/login', { cuerpo: {} });

    assert.equal(status, 400);
    assert.equal(cuerpo.error.code, 'VALIDATION_ERROR');
    const campos = cuerpo.error.details.map((d) => d.field).sort();
    assert.deepEqual(campos, ['correo', 'password']);
  });

  it('bloquea la cuenta 15 minutos tras 5 intentos fallidos y responde 423 (escenario 3)', async () => {
    const cuenta = await crearUsuarioDePrueba({ rol: 'entrenador' });
    creados.push(cuenta);

    for (let i = 0; i < 5; i += 1) {
      const { status } = await login(cuenta.correo, 'Incorrecta999');
      assert.equal(status, 401);
    }
    const bloqueada = await login(cuenta.correo, cuenta.password); // contraseña correcta
    assert.equal(bloqueada.status, 423);
    assert.equal(bloqueada.cuerpo.error.code, 'ACCOUNT_LOCKED');
  });

  describe('GET /auth/me y rutas protegidas (escenario 4)', () => {
    it('devuelve la sesión actual con un token válido', async () => {
      const { cuerpo: sesion } = await login(recepcionista.correo, recepcionista.password);
      const { status, cuerpo } = await solicitar(servidor.url, 'GET', '/auth/me', { token: sesion.token });

      assert.equal(status, 200);
      assert.equal(cuerpo.id_usuario, recepcionista.id_usuario);
      assert.equal(cuerpo.rol, 'recepcionista');
      assert.equal('password' in cuerpo, false);
    });

    it('responde 401 sin token', async () => {
      const { status } = await solicitar(servidor.url, 'GET', '/auth/me');
      assert.equal(status, 401);
    });

    it('responde 401 con un token alterado', async () => {
      const token = crearToken(recepcionista.id_usuario);
      const alterado = `${token.slice(0, -2)}${token.endsWith('AA') ? 'BB' : 'AA'}`;
      const { status } = await solicitar(servidor.url, 'GET', '/auth/me', { token: alterado });
      assert.equal(status, 401);
    });

    it('responde 401 con un token firmado con otro secreto', async () => {
      const token = crearToken(recepcionista.id_usuario, { secreto: 'otro-secreto-completamente-distinto' });
      const { status } = await solicitar(servidor.url, 'GET', '/auth/me', { token });
      assert.equal(status, 401);
    });

    it('responde 401 con un token vencido', async () => {
      const token = crearToken(recepcionista.id_usuario, { expiracion: -10 });
      const { status } = await solicitar(servidor.url, 'GET', '/auth/me', { token });
      assert.equal(status, 401);
    });

    it('responde 401 si la cuenta está desactivada, aunque el token sea válido', async () => {
      const { status } = await solicitar(servidor.url, 'GET', '/auth/me', {
        token: crearToken(desactivado.id_usuario),
      });
      assert.equal(status, 401);
    });
  });
});
