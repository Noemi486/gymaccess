import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/config/db.js';
import {
  iniciarServidor,
  solicitar,
  crearToken,
  correoUnico,
  crearUsuarioDePrueba,
  desactivarUsuarioDePrueba,
  cerrarPool,
} from '../helpers.js';

// PATCH /api/auth/password: cambio de contraseña de cualquier usuario autenticado.
// Se ejecuta contra la base de pruebas gymaccess_test.

const ACTUAL = 'Secreta123';
const NUEVA = 'NuevaClave456';

describe('API de cambio de contraseña', () => {
  let servidor;
  const usuariosParaLimpiar = [];
  let tokenAdmin;

  const api = (metodo, ruta, token, cuerpo) => solicitar(servidor.url, metodo, ruta, { token, cuerpo });
  const cambiar = (token, cuerpo) => api('PATCH', '/auth/password', token, cuerpo);
  const cuerpoValido = (extra = {}) => ({
    password_actual: ACTUAL,
    password_nueva: NUEVA,
    password_confirmacion: NUEVA,
    ...extra,
  });
  const iniciarSesion = (correo, password) => api('POST', '/auth/login', undefined, { correo, password });
  const hashDe = async (idUsuario) =>
    (await pool.execute('SELECT password FROM usuarios WHERE id_usuario = ?', [idUsuario]))[0][0].password;

  // Cuenta nueva por prueba, para que los cambios y los bloqueos no se mezclen.
  async function cuentaNueva(rol) {
    if (rol !== 'cliente') {
      const cuenta = await crearUsuarioDePrueba({ rol, password: ACTUAL });
      usuariosParaLimpiar.push(cuenta.id_usuario);
      return { ...cuenta, token: crearToken(cuenta.id_usuario) };
    }
    const correo = correoUnico('test');
    const cliente = await api('POST', '/clientes', tokenAdmin, {
      nombre: 'Clienta',
      apellido: `Clave${Date.now()}`,
      telefono: '555-400-5000',
      correo,
    });
    assert.equal(cliente.status, 201);
    const cuenta = await api('POST', '/usuarios', tokenAdmin, {
      nombre: 'Cuenta Clienta',
      correo,
      password: ACTUAL,
      rol: 'cliente',
      id_cliente: cliente.cuerpo.id_cliente,
    });
    assert.equal(cuenta.status, 201);
    usuariosParaLimpiar.push(cuenta.cuerpo.id_usuario);
    return { id_usuario: cuenta.cuerpo.id_usuario, correo, token: crearToken(cuenta.cuerpo.id_usuario) };
  }

  before(async () => {
    servidor = await iniciarServidor();
    const admin = await crearUsuarioDePrueba({ rol: 'administrador' });
    usuariosParaLimpiar.push(admin.id_usuario);
    tokenAdmin = crearToken(admin.id_usuario);
  });

  after(async () => {
    try {
      for (const id of usuariosParaLimpiar) await desactivarUsuarioDePrueba(id);
    } finally {
      await servidor.cerrar();
      await cerrarPool();
    }
  });

  describe('acceso', () => {
    it('sin sesión responde 401', async () => {
      assert.equal((await cambiar(undefined, cuerpoValido())).status, 401);
    });

    it('con un token alterado responde 401', async () => {
      const { token } = await cuentaNueva('recepcionista');
      const alterado = `${token.slice(0, -2)}${token.endsWith('AA') ? 'BB' : 'AA'}`;
      assert.equal((await cambiar(alterado, cuerpoValido())).status, 401);
    });
  });

  describe('cambio correcto, para cualquier rol', () => {
    for (const rol of ['administrador', 'recepcionista', 'entrenador', 'cliente']) {
      it(`el rol ${rol} cambia su contraseña y solo funciona la nueva`, async () => {
        const cuenta = await cuentaNueva(rol);
        const hashAntes = await hashDe(cuenta.id_usuario);

        const { status, cuerpo } = await cambiar(cuenta.token, cuerpoValido());

        assert.equal(status, 200);
        assert.equal(cuerpo.message, 'Contraseña actualizada correctamente.');
        assert.deepEqual(Object.keys(cuerpo), ['message']);
        assert.equal((await iniciarSesion(cuenta.correo, NUEVA)).status, 200);
        assert.equal((await iniciarSesion(cuenta.correo, ACTUAL)).status, 401);

        const hashDespues = await hashDe(cuenta.id_usuario);
        assert.notEqual(hashDespues, hashAntes);
        assert.match(hashDespues, /^\$2[aby]\$/); // hash bcrypt, nunca texto plano
        assert.ok(!hashDespues.includes(NUEVA));
      });
    }

    it('la respuesta no incluye contraseñas ni hash', async () => {
      const cuenta = await cuentaNueva('recepcionista');
      const { cuerpo } = await cambiar(cuenta.token, cuerpoValido());
      const texto = JSON.stringify(cuerpo);
      assert.ok(!texto.includes(NUEVA) && !texto.includes(ACTUAL) && !texto.includes('$2'));
    });

    it('la misma sesión sigue siendo válida después del cambio', async () => {
      const cuenta = await cuentaNueva('entrenador');
      await cambiar(cuenta.token, cuerpoValido());
      assert.equal((await api('GET', '/auth/me', cuenta.token)).status, 200);
    });
  });

  describe('contraseña actual incorrecta', () => {
    it('responde 400 con el error en password_actual (no 401) y no cambia nada', async () => {
      const cuenta = await cuentaNueva('recepcionista');
      const hashAntes = await hashDe(cuenta.id_usuario);

      const { status, cuerpo } = await cambiar(cuenta.token, cuerpoValido({ password_actual: 'EquivocadaXX1' }));

      assert.equal(status, 400);
      assert.equal(cuerpo.error.code, 'VALIDATION_ERROR');
      assert.deepEqual(cuerpo.error.details, [
        { field: 'password_actual', message: 'La contraseña actual no es correcta.' },
      ]);
      assert.equal(await hashDe(cuenta.id_usuario), hashAntes);
      assert.equal((await iniciarSesion(cuenta.correo, ACTUAL)).status, 200);
    });

    it('tras varios intentos fallidos bloquea temporalmente (423), incluso con la contraseña correcta', async () => {
      const cuenta = await cuentaNueva('entrenador');
      let bloqueado = null;
      for (let intento = 0; intento < 15 && !bloqueado; intento += 1) {
        const respuesta = await cambiar(cuenta.token, cuerpoValido({ password_actual: 'EquivocadaXX1' }));
        if (respuesta.status === 423) bloqueado = respuesta;
        else assert.equal(respuesta.status, 400);
      }
      assert.ok(bloqueado, 'debió bloquearse tras varios intentos fallidos');
      assert.equal(bloqueado.cuerpo.error.code, 'ACCOUNT_LOCKED');

      const conCorrecta = await cambiar(cuenta.token, cuerpoValido());
      assert.equal(conCorrecta.status, 423);
      assert.equal((await iniciarSesion(cuenta.correo, ACTUAL)).status, 200); // el bloqueo no afecta al inicio de sesión
    });
  });

  describe('contraseña nueva inválida', () => {
    const casos = [
      ['sin número', 'SoloLetrasAqui'],
      ['sin letra', '1234567890'],
      ['de menos de 8 caracteres', 'Ab1'],
      ['de más de 72 caracteres', `Ab1${'x'.repeat(70)}`],
    ];
    for (const [nombre, nueva] of casos) {
      it(`rechaza una contraseña ${nombre}`, async () => {
        const cuenta = await cuentaNueva('recepcionista');
        const hashAntes = await hashDe(cuenta.id_usuario);

        const { status, cuerpo } = await cambiar(
          cuenta.token,
          cuerpoValido({ password_nueva: nueva, password_confirmacion: nueva }),
        );

        assert.equal(status, 400);
        assert.ok(cuerpo.error.details.some((d) => d.field === 'password_nueva'));
        assert.equal(await hashDe(cuenta.id_usuario), hashAntes);
      });
    }

    it('rechaza una nueva igual a la actual', async () => {
      const cuenta = await cuentaNueva('recepcionista');
      const { status, cuerpo } = await cambiar(
        cuenta.token,
        cuerpoValido({ password_nueva: ACTUAL, password_confirmacion: ACTUAL }),
      );
      assert.equal(status, 400);
      assert.deepEqual(cuerpo.error.details, [
        { field: 'password_nueva', message: 'La nueva contraseña debe ser distinta de la actual.' },
      ]);
    });

    it('rechaza una confirmación distinta', async () => {
      const cuenta = await cuentaNueva('recepcionista');
      const hashAntes = await hashDe(cuenta.id_usuario);
      const { status, cuerpo } = await cambiar(cuenta.token, cuerpoValido({ password_confirmacion: 'OtraClave789' }));
      assert.equal(status, 400);
      assert.ok(cuerpo.error.details.some((d) => d.field === 'password_confirmacion'));
      assert.equal(await hashDe(cuenta.id_usuario), hashAntes);
    });
  });

  describe('cuerpo inválido', () => {
    it('rechaza campos faltantes, vacíos o de más', async () => {
      const cuenta = await cuentaNueva('recepcionista');
      const invalidos = [
        {},
        { password_actual: ACTUAL },
        cuerpoValido({ password_actual: '' }),
        cuerpoValido({ password_confirmacion: undefined }),
        cuerpoValido({ rol: 'administrador' }),
        cuerpoValido({ id_usuario: 1 }),
        cuerpoValido({ password_actual: 12345678 }),
      ];
      for (const cuerpo of invalidos) {
        assert.equal((await cambiar(cuenta.token, cuerpo)).status, 400, JSON.stringify(cuerpo));
      }
    });

    it('solo cambia la contraseña de la cuenta de la sesión, no la de otra', async () => {
      const propia = await cuentaNueva('recepcionista');
      const ajena = await cuentaNueva('recepcionista');
      const hashAjena = await hashDe(ajena.id_usuario);

      const respuesta = await cambiar(propia.token, cuerpoValido({ id_usuario: ajena.id_usuario }));

      assert.equal(respuesta.status, 400); // no se admite ningún id en el cuerpo
      assert.equal(await hashDe(ajena.id_usuario), hashAjena);
    });
  });
});
