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

// Escenarios 5, 6, 7, 18 y 19 de quickstart.md contra la base de pruebas gymaccess_test.
// Todas las cuentas "test+..." quedan inactivas al terminar.

describe('API de usuarios (solo administrador)', () => {
  let servidor;
  let admin; // administrador de prueba
  let recepcionista; // para comprobar el 403
  let tokenAdmin;
  let tokenRecepcion;
  const idsParaLimpiar = [];

  const api = (metodo, ruta, token, cuerpo) => solicitar(servidor.url, metodo, ruta, { token, cuerpo });
  const nuevoUsuario = (extra = {}) => ({
    nombre: 'Persona de Prueba',
    correo: correoUnico('test'),
    password: 'Secreta123',
    rol: 'recepcionista',
    ...extra,
  });
  const crearComoAdmin = async (extra) => {
    const datos = nuevoUsuario(extra);
    const respuesta = await api('POST', '/usuarios', tokenAdmin, datos);
    if (respuesta.status === 201) idsParaLimpiar.push(respuesta.cuerpo.id_usuario);
    return { datos, respuesta };
  };

  before(async () => {
    servidor = await iniciarServidor();
    admin = await crearUsuarioDePrueba({ rol: 'administrador', nombre: 'Admin Prueba' });
    recepcionista = await crearUsuarioDePrueba({ rol: 'recepcionista' });
    idsParaLimpiar.push(admin.id_usuario, recepcionista.id_usuario);
    tokenAdmin = crearToken(admin.id_usuario);
    tokenRecepcion = crearToken(recepcionista.id_usuario);
  });

  after(async () => {
    try {
      for (const id of idsParaLimpiar) await desactivarUsuarioDePrueba(id);
    } finally {
      await servidor.cerrar();
      await cerrarPool();
    }
  });

  describe('alta y consulta (escenario 5)', () => {
    it('crea un recepcionista y un entrenador (201) sin devolver la contraseña', async () => {
      for (const rol of ['recepcionista', 'entrenador']) {
        const { datos, respuesta } = await crearComoAdmin({ rol });
        assert.equal(respuesta.status, 201);
        assert.equal(respuesta.cuerpo.rol, rol);
        assert.equal(respuesta.cuerpo.correo, datos.correo);
        assert.equal(respuesta.cuerpo.estado, 'activo');
        assert.equal('password' in respuesta.cuerpo, false);
      }
    });

    it('la cuenta creada puede iniciar sesión con la contraseña indicada', async () => {
      const { datos } = await crearComoAdmin();
      const login = await api('POST', '/auth/login', undefined, { correo: datos.correo, password: datos.password });
      assert.equal(login.status, 200);
      assert.equal(login.cuerpo.usuario.rol, 'recepcionista');
    });

    it('normaliza el correo (mayúsculas y espacios)', async () => {
      const correo = correoUnico('test');
      const { respuesta } = await crearComoAdmin({ correo: `  ${correo.toUpperCase()} ` });
      assert.equal(respuesta.status, 201);
      assert.equal(respuesta.cuerpo.correo, correo);
    });

    it('lista usuarios paginados sin ninguna contraseña y filtra por rol', async () => {
      await crearComoAdmin({ rol: 'entrenador' });
      const { status, cuerpo } = await api('GET', '/usuarios?rol=entrenador&limit=5', tokenAdmin);

      assert.equal(status, 200);
      assert.equal(cuerpo.limit, 5);
      assert.ok(cuerpo.total >= 1);
      assert.ok(cuerpo.data.length <= 5);
      assert.ok(cuerpo.data.every((u) => u.rol === 'entrenador'));
      assert.ok(!JSON.stringify(cuerpo).includes('password'));
      assert.ok(!JSON.stringify(cuerpo).includes('$2'));
    });

    it('consulta un usuario por id y responde 404 si no existe', async () => {
      const { respuesta } = await crearComoAdmin();
      const uno = await api('GET', `/usuarios/${respuesta.cuerpo.id_usuario}`, tokenAdmin);
      assert.equal(uno.status, 200);
      assert.equal(uno.cuerpo.id_usuario, respuesta.cuerpo.id_usuario);

      const inexistente = await api('GET', '/usuarios/99999999', tokenAdmin);
      assert.equal(inexistente.status, 404);
    });

    it('responde 400 con un id que no es numérico', async () => {
      const { status } = await api('GET', '/usuarios/abc', tokenAdmin);
      assert.equal(status, 400);
    });
  });

  describe('validaciones (escenario 6)', () => {
    it('rechaza un correo repetido con 409 indicando el campo', async () => {
      const { datos } = await crearComoAdmin();
      const repetido = await api('POST', '/usuarios', tokenAdmin, nuevoUsuario({ correo: datos.correo }));

      assert.equal(repetido.status, 409);
      assert.equal(repetido.cuerpo.error.code, 'CONFLICT');
      assert.equal(repetido.cuerpo.error.details[0].field, 'correo');
    });

    it('rechaza una contraseña de 7 caracteres (400, campo password)', async () => {
      const { respuesta } = await crearComoAdmin({ password: 'Abcde12' });
      assert.equal(respuesta.status, 400);
      assert.ok(respuesta.cuerpo.error.details.some((d) => d.field === 'password'));
    });

    it('rechaza una contraseña sin números y otra sin letras (400)', async () => {
      for (const password of ['SoloLetrasLargas', '1234567890']) {
        const { respuesta } = await crearComoAdmin({ password });
        assert.equal(respuesta.status, 400);
        assert.ok(respuesta.cuerpo.error.details.some((d) => d.field === 'password'));
      }
    });

    it('rechaza campos faltantes, roles inválidos y campos desconocidos (400)', async () => {
      const vacio = await api('POST', '/usuarios', tokenAdmin, {});
      assert.equal(vacio.status, 400);
      const campos = vacio.cuerpo.error.details.map((d) => d.field).sort();
      assert.deepEqual(campos, ['correo', 'nombre', 'password', 'rol']);

      const rolInvalido = await crearComoAdmin({ rol: 'superusuario' });
      assert.equal(rolInvalido.respuesta.status, 400);

      const extra = await crearComoAdmin({ estado: 'inactivo' });
      assert.equal(extra.respuesta.status, 400);
    });

    it('el rol cliente sin id_cliente es 400 y un rol de personal con id_cliente también', async () => {
      const sinCliente = await crearComoAdmin({ rol: 'cliente' });
      assert.equal(sinCliente.respuesta.status, 400);
      const conCliente = await crearComoAdmin({ id_cliente: 1 });
      assert.equal(conCliente.respuesta.status, 400);
    });

    it('rechaza el rol cliente con un cliente que no existe (404)', async () => {
      const { respuesta } = await crearComoAdmin({ rol: 'cliente', id_cliente: 99999999 });
      assert.equal(respuesta.status, 404);
    });
  });

  describe('modificación, roles y estado', () => {
    it('modifica nombre y rol, y el cambio de rol se aplica de inmediato', async () => {
      const { datos, respuesta } = await crearComoAdmin();
      const id = respuesta.cuerpo.id_usuario;
      const login = await api('POST', '/auth/login', undefined, { correo: datos.correo, password: datos.password });

      const cambio = await api('PATCH', `/usuarios/${id}`, tokenAdmin, { nombre: 'Nombre Nuevo', rol: 'entrenador' });
      assert.equal(cambio.status, 200);
      assert.equal(cambio.cuerpo.rol, 'entrenador');
      assert.equal(cambio.cuerpo.nombre, 'Nombre Nuevo');

      const yo = await api('GET', '/auth/me', login.cuerpo.token);
      assert.equal(yo.cuerpo.rol, 'entrenador');
    });

    it('cambia la contraseña y la nueva sirve para iniciar sesión', async () => {
      const { datos, respuesta } = await crearComoAdmin();
      const id = respuesta.cuerpo.id_usuario;
      const cambio = await api('PATCH', `/usuarios/${id}`, tokenAdmin, { password: 'OtraClave789' });
      assert.equal(cambio.status, 200);

      const vieja = await api('POST', '/auth/login', undefined, { correo: datos.correo, password: datos.password });
      assert.equal(vieja.status, 401);
      const nueva = await api('POST', '/auth/login', undefined, { correo: datos.correo, password: 'OtraClave789' });
      assert.equal(nueva.status, 200);
    });

    it('rechaza un PATCH vacío (400) y un correo que ya usa otra cuenta (409)', async () => {
      const a = await crearComoAdmin();
      const b = await crearComoAdmin();
      const vacio = await api('PATCH', `/usuarios/${a.respuesta.cuerpo.id_usuario}`, tokenAdmin, {});
      assert.equal(vacio.status, 400);

      const duplicado = await api('PATCH', `/usuarios/${a.respuesta.cuerpo.id_usuario}`, tokenAdmin, {
        correo: b.datos.correo,
      });
      assert.equal(duplicado.status, 409);
    });

    it('no permite cambiar un usuario hacia el rol cliente (409)', async () => {
      const { respuesta } = await crearComoAdmin();
      const cambio = await api('PATCH', `/usuarios/${respuesta.cuerpo.id_usuario}`, tokenAdmin, { rol: 'cliente' });
      assert.equal(cambio.status, 409);
    });

    it('desactivar a un usuario con sesión abierta invalida su token de inmediato (escenario 19)', async () => {
      const { datos, respuesta } = await crearComoAdmin();
      const id = respuesta.cuerpo.id_usuario;
      const login = await api('POST', '/auth/login', undefined, { correo: datos.correo, password: datos.password });
      assert.equal((await api('GET', '/auth/me', login.cuerpo.token)).status, 200);

      const baja = await api('PATCH', `/usuarios/${id}`, tokenAdmin, { estado: 'inactivo' });
      assert.equal(baja.status, 200);
      assert.equal(baja.cuerpo.estado, 'inactivo');

      assert.equal((await api('GET', '/auth/me', login.cuerpo.token)).status, 401);
      const nuevoLogin = await api('POST', '/auth/login', undefined, { correo: datos.correo, password: datos.password });
      assert.equal(nuevoLogin.status, 401);

      // El registro se conserva y se puede reactivar.
      const alta = await api('PATCH', `/usuarios/${id}`, tokenAdmin, { estado: 'activo' });
      assert.equal(alta.status, 200);
      assert.equal((await api('GET', '/auth/me', login.cuerpo.token)).status, 200);
    });
  });

  describe('permisos (escenario 7) y sesión', () => {
    it('sin token responde 401 en todas las rutas', async () => {
      assert.equal((await api('GET', '/usuarios')).status, 401);
      assert.equal((await api('POST', '/usuarios', undefined, nuevoUsuario())).status, 401);
      assert.equal((await api('PATCH', '/usuarios/1', undefined, { nombre: 'X' })).status, 401);
    });

    it('un recepcionista recibe 403 al listar, crear y modificar usuarios', async () => {
      assert.equal((await api('GET', '/usuarios', tokenRecepcion)).status, 403);
      assert.equal((await api('GET', `/usuarios/${admin.id_usuario}`, tokenRecepcion)).status, 403);
      assert.equal((await api('POST', '/usuarios', tokenRecepcion, nuevoUsuario())).status, 403);
      assert.equal(
        (await api('PATCH', `/usuarios/${recepcionista.id_usuario}`, tokenRecepcion, { rol: 'administrador' })).status,
        403,
      );
    });

    it('el rol del recepcionista no cambió tras el intento de escalada', async () => {
      const { cuerpo } = await api('GET', `/usuarios/${recepcionista.id_usuario}`, tokenAdmin);
      assert.equal(cuerpo.rol, 'recepcionista');
    });
  });

  describe('último administrador activo (escenario 18)', () => {
    it('permite desactivar a un administrador cuando queda otro activo', async () => {
      const segundo = await crearUsuarioDePrueba({ rol: 'administrador' });
      idsParaLimpiar.push(segundo.id_usuario);

      const baja = await api('PATCH', `/usuarios/${segundo.id_usuario}`, tokenAdmin, { estado: 'inactivo' });
      assert.equal(baja.status, 200);
    });

    it('rechaza (409) desactivar o degradar al único administrador activo', async (t) => {
      // La regla depende de todos los administradores de la base. Solo se puede comprobar de
      // extremo a extremo si el administrador de prueba es el único activo (en gymaccess_test
      // lo es); si hubiera otros, la regla queda cubierta por las pruebas unitarias.
      const [filas] = await pool.query("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'administrador' AND estado = 'activo'");
      if (filas[0].n !== 1) {
        t.skip('Hay otros administradores activos en la base: se cubre con las pruebas unitarias.');
        return;
      }

      const baja = await api('PATCH', `/usuarios/${admin.id_usuario}`, tokenAdmin, { estado: 'inactivo' });
      assert.equal(baja.status, 409);
      const degradar = await api('PATCH', `/usuarios/${admin.id_usuario}`, tokenAdmin, { rol: 'entrenador' });
      assert.equal(degradar.status, 409);
    });
  });
});
