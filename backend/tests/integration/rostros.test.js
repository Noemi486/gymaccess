import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';
import { descifrarDescriptor, LARGO_BLOB } from '../../src/utils/cifradoFacial.js';
import {
  iniciarServidor,
  solicitar,
  crearToken,
  crearUsuarioConRol,
  crearClienteDePrueba,
  crearDescriptorSintetico,
  limpiarDatosDePrueba,
  cerrarPool,
  sinBiometria,
} from '../helpers.js';

// Registro de rostros con descriptores sintéticos (gymaccess_test).

describe('API de rostros', () => {
  let servidor;
  let admin;
  let recepcion;
  let entrenador;
  let tokenCliente;
  const usuarios = [];
  const clientes = [];
  let semilla = 1000 + (process.pid % 1000) * 10;

  const api = (metodo, ruta, token, cuerpo) => solicitar(servidor.url, metodo, ruta, { token, cuerpo });
  const nuevoCliente = async (extra) => {
    const c = await crearClienteDePrueba(extra);
    clientes.push(c.id_cliente);
    return c;
  };
  const descriptor = () => crearDescriptorSintetico((semilla += 1));
  const registrar = (idCliente, cuerpo = {}, token = recepcion.token) =>
    api('POST', `/clientes/${idCliente}/rostro`, token, { descriptor: descriptor(), consentimiento: true, ...cuerpo });
  const campos = (r) => (r.cuerpo?.error?.details ?? []).map((d) => d.field);
  const activos = async (idCliente) => {
    const [[f]] = await pool.execute("SELECT COUNT(*) AS n FROM rostros WHERE id_cliente = ? AND estado = 'activo'", [idCliente]);
    return Number(f.n);
  };
  const total = async (idCliente) => {
    const [[f]] = await pool.execute('SELECT COUNT(*) AS n FROM rostros WHERE id_cliente = ?', [idCliente]);
    return Number(f.n);
  };

  before(async () => {
    servidor = await iniciarServidor();
    admin = await crearUsuarioConRol('administrador');
    recepcion = await crearUsuarioConRol('recepcionista');
    entrenador = await crearUsuarioConRol('entrenador');
    usuarios.push(admin.id_usuario, recepcion.id_usuario, entrenador.id_usuario);
    const dueno = await nuevoCliente();
    const cuenta = await api('POST', '/usuarios', admin.token, {
      nombre: 'Cliente rostros',
      correo: dueno.correo,
      password: 'Secreta123',
      rol: 'cliente',
      id_cliente: dueno.id_cliente,
    });
    usuarios.push(cuenta.cuerpo.id_usuario);
    tokenCliente = crearToken(cuenta.cuerpo.id_usuario);
  });

  after(async () => {
    try {
      await limpiarDatosDePrueba({ usuarios, clientes });
    } finally {
      await servidor.cerrar();
      await cerrarPool();
    }
  });

  describe('permisos', () => {
    it('sin sesión 401; entrenador y cliente 403 en todas las rutas', async () => {
      const c = await nuevoCliente();
      assert.equal((await api('GET', `/clientes/${c.id_cliente}/rostro`)).status, 401);
      assert.equal((await registrar(c.id_cliente, {}, null)).status, 401);
      for (const token of [entrenador.token, tokenCliente]) {
        assert.equal((await api('GET', `/clientes/${c.id_cliente}/rostro`, token)).status, 403);
        assert.equal((await registrar(c.id_cliente, {}, token)).status, 403);
        assert.equal((await api('PATCH', '/rostros/1/estado', token, { estado: 'inactivo' })).status, 403);
      }
    });

    it('el recepcionista consulta y registra pero no desactiva ni reactiva', async () => {
      const c = await nuevoCliente();
      const r = await registrar(c.id_cliente);
      assert.equal(r.status, 201);
      assert.equal((await api('GET', `/clientes/${c.id_cliente}/rostro`, recepcion.token)).status, 200);
      assert.equal((await api('PATCH', `/rostros/${r.cuerpo.id_rostro}/estado`, recepcion.token, { estado: 'inactivo' })).status, 403);
    });

    it('no existe DELETE', async () => {
      assert.equal((await api('DELETE', '/rostros/1', admin.token)).status, 404);
      assert.equal((await api('DELETE', '/clientes/1/rostro', admin.token)).status, 404);
    });
  });

  describe('registrar', () => {
    it('201 con solo { id_rostro, fecha_registro, estado } y el descriptor queda cifrado en la base', async () => {
      const c = await nuevoCliente();
      const original = descriptor();
      const r = await api('POST', `/clientes/${c.id_cliente}/rostro`, recepcion.token, { descriptor: original, consentimiento: true });
      assert.equal(r.status, 201);
      assert.deepEqual(Object.keys(r.cuerpo).sort(), ['estado', 'fecha_registro', 'id_rostro']);
      assert.equal(r.cuerpo.estado, 'activo');
      sinBiometria(r.cuerpo);

      const [[fila]] = await pool.execute('SELECT descriptor_facial FROM rostros WHERE id_rostro = ?', [r.cuerpo.id_rostro]);
      const blob = fila.descriptor_facial;
      assert.equal(blob.length, LARGO_BLOB);
      assert.equal(blob.length, 541);
      assert.equal(blob[0], 0x01);
      // El vector en claro (float32) no aparece en el blob.
      const claro = Buffer.alloc(32);
      original.slice(0, 8).forEach((v, i) => claro.writeFloatLE(v, i * 4));
      assert.equal(blob.includes(claro), false);
      // Con FACE_KEY y el id del cliente se recupera el descriptor original.
      const recuperado = descifrarDescriptor(blob, c.id_cliente, env.faceKey);
      original.forEach((v, i) => assert.ok(Math.abs(recuperado[i] - v) < 1e-6));
      // Con el id de otro cliente no descifra.
      assert.throws(() => descifrarDescriptor(blob, c.id_cliente + 1, env.faceKey));
    });

    it('rechaza (400) el consentimiento ausente, falso o que no sea true', async () => {
      const c = await nuevoCliente();
      for (const consentimiento of [undefined, false, 'true', 1, null]) {
        const r = await registrar(c.id_cliente, { consentimiento });
        assert.equal(r.status, 400, String(consentimiento));
        assert.ok(campos(r).includes('consentimiento'));
      }
      assert.equal(await total(c.id_cliente), 0);
    });

    it('rechaza (400) descriptores de 127/129 valores, NaN, fuera de ±5, todo ceros o de otro tipo, sin guardar nada', async () => {
      const c = await nuevoCliente();
      const base = descriptor();
      const invalidos = [
        base.slice(0, 127),
        [...base, 0.1],
        base.map((v, i) => (i === 3 ? 'x' : v)),
        base.map((v, i) => (i === 3 ? null : v)),
        base.map((v, i) => (i === 3 ? 5.01 : v)),
        base.map((v, i) => (i === 3 ? -5.01 : v)),
        new Array(128).fill(0),
        'abc',
        {},
        undefined,
      ];
      for (const d of invalidos) {
        const r = await registrar(c.id_cliente, { descriptor: d });
        assert.equal(r.status, 400);
        assert.ok(campos(r).some((f) => f.startsWith('descriptor')));
        sinBiometria(JSON.stringify(r.cuerpo).replace(/descriptor/g, ''));
      }
      // NaN no existe en JSON: llega como null y se rechaza igual.
      assert.equal(await total(c.id_cliente), 0);
    });

    it('rechaza campos extra (400), cliente inactivo (409) e inexistente (404)', async () => {
      const c = await nuevoCliente();
      assert.equal((await registrar(c.id_cliente, { estado: 'activo' })).status, 400);
      const inactivo = await nuevoCliente({ estado: 'inactivo' });
      assert.equal((await registrar(inactivo.id_cliente)).status, 409);
      assert.equal((await registrar(999999999)).status, 404);
      assert.equal((await api('POST', '/clientes/abc/rostro', admin.token, {})).status, 400);
    });

    it('registrar otro rostro deja inactivo al anterior (siempre a lo más un activo)', async () => {
      const c = await nuevoCliente();
      const primero = await registrar(c.id_cliente);
      const segundo = await registrar(c.id_cliente);
      assert.equal(await activos(c.id_cliente), 1);
      assert.equal(await total(c.id_cliente), 2);
      const consulta = await api('GET', `/clientes/${c.id_cliente}/rostro`, admin.token);
      assert.equal(consulta.cuerpo.activo.id_rostro, segundo.cuerpo.id_rostro);
      const estados = Object.fromEntries(consulta.cuerpo.historial.map((h) => [h.id_rostro, h.estado]));
      assert.equal(estados[primero.cuerpo.id_rostro], 'inactivo');
    });

    it('registros simultáneos dejan un solo rostro activo', async () => {
      const c = await nuevoCliente();
      const resultados = await Promise.all([registrar(c.id_cliente), registrar(c.id_cliente), registrar(c.id_cliente)]);
      assert.deepEqual(resultados.map((r) => r.status), [201, 201, 201]);
      assert.equal(await activos(c.id_cliente), 1);
      assert.equal(await total(c.id_cliente), 3);
    });

    it('audita registrar y reemplazar sin datos biométricos', async () => {
      const c = await nuevoCliente();
      await registrar(c.id_cliente);
      await registrar(c.id_cliente);
      const [filas] = await pool.execute(
        "SELECT accion, descripcion FROM auditoria WHERE modulo = 'rostros' AND descripcion LIKE ? ORDER BY id_auditoria",
        [`%cliente ${c.id_cliente}.`],
      );
      assert.deepEqual(filas.map((f) => f.accion), ['registrar', 'reemplazar']);
      filas.forEach((f) => assert.ok(!/descriptor/i.test(f.descripcion)));
    });
  });

  describe('consultar', () => {
    it('sin rostro: registrado false; con rostro: activo e historial, sin datos biométricos', async () => {
      const c = await nuevoCliente();
      const vacio = await api('GET', `/clientes/${c.id_cliente}/rostro`, recepcion.token);
      assert.deepEqual(vacio.cuerpo, { registrado: false, activo: null, historial: [] });
      const r = await registrar(c.id_cliente);
      const consulta = await api('GET', `/clientes/${c.id_cliente}/rostro`, recepcion.token);
      assert.equal(consulta.cuerpo.registrado, true);
      assert.equal(consulta.cuerpo.activo.id_rostro, r.cuerpo.id_rostro);
      assert.equal(consulta.cuerpo.historial.length, 1);
      sinBiometria(consulta.cuerpo);
      assert.equal((await api('GET', '/clientes/999999999/rostro', admin.token)).status, 404);
    });
  });

  describe('desactivar y reactivar (administrador)', () => {
    const estado = (id, e, token = admin.token) => api('PATCH', `/rostros/${id}/estado`, token, { estado: e });

    it('desactivar conserva el registro y el blob; reactivar lo vuelve a activar', async () => {
      const c = await nuevoCliente();
      const r = await registrar(c.id_cliente);
      const off = await estado(r.cuerpo.id_rostro, 'inactivo');
      assert.equal(off.status, 200);
      assert.equal(off.cuerpo.estado, 'inactivo');
      assert.equal(off.cuerpo.id_cliente, c.id_cliente);
      sinBiometria(off.cuerpo);
      const [[fila]] = await pool.execute('SELECT LENGTH(descriptor_facial) AS largo FROM rostros WHERE id_rostro = ?', [r.cuerpo.id_rostro]);
      assert.equal(Number(fila.largo), 541);
      assert.equal(await activos(c.id_cliente), 0);
      assert.equal((await api('GET', `/clientes/${c.id_cliente}/rostro`, admin.token)).cuerpo.registrado, false);

      assert.equal((await estado(r.cuerpo.id_rostro, 'activo')).cuerpo.estado, 'activo');
      assert.equal(await activos(c.id_cliente), 1);
    });

    it('reactivar un rostro antiguo desactiva el que estaba activo', async () => {
      const c = await nuevoCliente();
      const viejo = await registrar(c.id_cliente);
      const nuevo = await registrar(c.id_cliente);
      assert.equal((await estado(viejo.cuerpo.id_rostro, 'activo')).status, 200);
      assert.equal(await activos(c.id_cliente), 1);
      const consulta = await api('GET', `/clientes/${c.id_cliente}/rostro`, admin.token);
      assert.equal(consulta.cuerpo.activo.id_rostro, viejo.cuerpo.id_rostro);
      const estados = Object.fromEntries(consulta.cuerpo.historial.map((h) => [h.id_rostro, h.estado]));
      assert.equal(estados[nuevo.cuerpo.id_rostro], 'inactivo');
    });

    it('repetir el mismo estado no falla; estado inválido 400; inexistente 404; cliente dado de baja 409 al reactivar', async () => {
      const c = await nuevoCliente();
      const r = await registrar(c.id_cliente);
      assert.equal((await estado(r.cuerpo.id_rostro, 'activo')).status, 200);
      assert.equal((await estado(r.cuerpo.id_rostro, 'borrado')).status, 400);
      assert.equal((await api('PATCH', `/rostros/${r.cuerpo.id_rostro}/estado`, admin.token, {})).status, 400);
      assert.equal((await estado(999999999, 'inactivo')).status, 404);
      await estado(r.cuerpo.id_rostro, 'inactivo');
      await pool.execute("UPDATE clientes SET estado = 'inactivo' WHERE id_cliente = ?", [c.id_cliente]);
      assert.equal((await estado(r.cuerpo.id_rostro, 'activo')).status, 409);
    });
  });
});
