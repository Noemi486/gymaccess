import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';
import { cifrarDescriptor } from '../../src/utils/cifradoFacial.js';
import {
  iniciarServidor,
  solicitar,
  crearToken,
  crearUsuarioConRol,
  crearClienteDePrueba,
  crearTipoMembresiaDePrueba,
  crearMembresiaDePrueba,
  fechaRelativa,
  limpiarDatosDePrueba,
  cerrarPool,
  sinBiometria,
  crearDescriptorSintetico,
} from '../helpers.js';

// Inicio de cada rol con la información del Sprint 2 (US9, FR-042 a FR-044) sobre gymaccess_test.
// Las cifras globales de hoy (accesos, por vencer) se comprueban con su consulta de origen y con márgenes
// porque otras pruebas crean accesos al mismo tiempo; el resumen del cliente se comprueba exacto.

describe('Inicio con datos del Sprint 2', () => {
  let servidor;
  let admin;
  let recepcion;
  let entrenador;
  let plan;
  let ana;
  let beto;
  let tokenAna;
  let tokenBeto;
  const usuarios = [];
  const clientes = [];
  const tipos = [];
  const idsAcceso = [];
  const marca = `Ini${process.pid}${Date.now() % 100000}`;

  const api = (ruta, token) => solicitar(servidor.url, 'GET', ruta, { token });
  const acceso = async (idCliente, resultado, motivo = null, hora = null) => {
    const [r] = hora
      ? await pool.execute("INSERT INTO accesos (id_cliente, fecha, hora, tipo, resultado, motivo_rechazo) VALUES (?, CURDATE(), ?, 'entrada', ?, ?)", [idCliente, hora, resultado, motivo])
      : await pool.execute("INSERT INTO accesos (id_cliente, tipo, resultado, motivo_rechazo) VALUES (?, 'entrada', ?, ?)", [idCliente, resultado, motivo]);
    idsAcceso.push(r.insertId);
    return r.insertId;
  };
  const cuentaCliente = async (c) => {
    const r = await solicitar(servidor.url, 'POST', '/usuarios', {
      token: admin.token,
      cuerpo: { nombre: `Cuenta ${c.nombre}`, correo: c.correo, password: 'Secreta123', rol: 'cliente', id_cliente: c.id_cliente },
    });
    usuarios.push(r.cuerpo.id_usuario);
    return crearToken(r.cuerpo.id_usuario);
  };

  before(async () => {
    servidor = await iniciarServidor();
    admin = await crearUsuarioConRol('administrador');
    recepcion = await crearUsuarioConRol('recepcionista');
    entrenador = await crearUsuarioConRol('entrenador');
    usuarios.push(admin.id_usuario, recepcion.id_usuario, entrenador.id_usuario);
    plan = await crearTipoMembresiaDePrueba({ precio: '450.00', duracion: 30 });
    tipos.push(plan.id_tipo_membresia);

    ana = await crearClienteDePrueba({ nombre: 'Ana', apellido: `${marca}Alfa` });
    beto = await crearClienteDePrueba({ nombre: 'Beto', apellido: `${marca}Beta` });
    clientes.push(ana.id_cliente, beto.id_cliente);
    tokenAna = await cuentaCliente(ana);
    tokenBeto = await cuentaCliente(beto);

    // Ana: membresía vigente pagada que vence en 3 días, rostro registrado, 6 visitas y 1 pago.
    await crearMembresiaDePrueba({ idCliente: ana.id_cliente, idTipo: plan.id_tipo_membresia, inicio: await fechaRelativa(-26), fin: await fechaRelativa(3), pagada: true, idUsuario: admin.id_usuario });
    // Rostro cifrado de verdad (vector sintético) para no estorbar a las pruebas de identificación en paralelo.
    const blob = cifrarDescriptor(crearDescriptorSintetico(90_000 + (process.pid % 1000)), ana.id_cliente, env.faceKey);
    await pool.execute("INSERT INTO rostros (id_cliente, descriptor_facial, estado) VALUES (?, ?, 'activo')", [ana.id_cliente, blob]);
    for (let i = 0; i < 5; i += 1) await acceso(ana.id_cliente, 'autorizado');
    await acceso(ana.id_cliente, 'rechazado', 'Pago pendiente');
    // Beto: membresía pendiente de pago (sin rostro, sin visitas, sin pagos).
    await crearMembresiaDePrueba({ idCliente: beto.id_cliente, idTipo: plan.id_tipo_membresia, inicio: await fechaRelativa(0), fin: await fechaRelativa(29) });
  });

  after(async () => {
    try {
      for (const id of idsAcceso) await pool.execute('DELETE FROM accesos WHERE id_acceso = ?', [id]);
      await limpiarDatosDePrueba({ usuarios, clientes, tipos });
    } finally {
      await servidor.cerrar();
      await cerrarPool();
    }
  });

  describe('GET /resumen (personal)', () => {
    for (const rol of ['administrador', 'recepcionista']) {
      it(`${rol}: accesos de hoy y membresías por vencer coinciden con su origen`, async () => {
        const token = rol === 'administrador' ? admin.token : recepcion.token;
        const { status, cuerpo } = await api('/resumen', token);
        assert.equal(status, 200);
        assert.deepEqual(Object.keys(cuerpo.accesos), ['hoy']);
        assert.deepEqual(Object.keys(cuerpo.membresias), ['por_vencer']);
        assert.ok(cuerpo.accesos.hoy >= 5, 'incluye los 5 accesos autorizados de Ana');
        assert.ok(cuerpo.membresias.por_vencer >= 1, 'incluye la membresía de Ana');

        // Misma cifra que GET /accesos de hoy con resultado autorizado (puede crecer si otras pruebas registran accesos).
        const hoy = await fechaRelativa(0);
        const lista = await api(`/accesos?desde=${hoy}&hasta=${hoy}&resultado=autorizado&limit=1`, admin.token);
        assert.ok(Math.abs(lista.cuerpo.total - cuerpo.accesos.hoy) <= 50);
        assert.ok(lista.cuerpo.total >= cuerpo.accesos.hoy);
      });
    }

    it('entrenador: clientes distintos que entraron hoy y la lista básica, sin datos de contacto ni financieros', async () => {
      const { cuerpo } = await api('/resumen', entrenador.token);
      assert.deepEqual(Object.keys(cuerpo.accesos).sort(), ['clientes_hoy', 'ultimos']);
      assert.equal(cuerpo.membresias, undefined);
      assert.ok(cuerpo.accesos.clientes_hoy >= 1);
      assert.ok(cuerpo.accesos.ultimos.length <= 5);
      for (const fila of cuerpo.accesos.ultimos) {
        assert.deepEqual(Object.keys(fila).sort(), ['apellido', 'hora', 'id_cliente', 'nombre']);
      }
      // Ana entró 5 veces, pero cuenta una sola vez.
      const filasAna = cuerpo.accesos.ultimos.filter((f) => f.id_cliente === ana.id_cliente);
      assert.ok(filasAna.length <= 1);
      const texto = JSON.stringify(cuerpo);
      assert.ok(!/telefono|correo|direccion|monto|motivo/i.test(texto));
    });
  });

  describe('GET /clientes/me/resumen (cliente)', () => {
    it('Ana: membresía vigente por vencer, rostro registrado sin biometría, últimas 5 visitas y sus pagos', async () => {
      const { status, cuerpo } = await api('/clientes/me/resumen', tokenAna);
      assert.equal(status, 200);
      assert.deepEqual(Object.keys(cuerpo).sort(), ['adeudo', 'membresia', 'pagos', 'rostro', 'visitas']);
      assert.equal(cuerpo.membresia.estado, 'vigente');
      assert.equal(cuerpo.membresia.dias_restantes, 3);
      assert.equal(cuerpo.membresia.por_vencer, true);
      assert.equal(cuerpo.rostro.registrado, true);
      assert.ok(cuerpo.rostro.fecha_registro);
      assert.equal(cuerpo.visitas.length, 5);
      assert.equal(cuerpo.visitas[0].resultado, 'rechazado');
      assert.equal(cuerpo.visitas[0].motivo_rechazo, 'Pago pendiente');
      assert.equal(cuerpo.pagos.length, 1);
      assert.equal(cuerpo.pagos[0].monto, 450);
      assert.equal(cuerpo.pagos[0].plan, plan.nombre);
      assert.equal(cuerpo.adeudo, null);
      sinBiometria(cuerpo);
    });

    it('Beto: pendiente de pago con el monto que debe; estados vacíos en lo demás', async () => {
      const { cuerpo } = await api('/clientes/me/resumen', tokenBeto);
      assert.equal(cuerpo.membresia.estado, 'pendiente_de_pago');
      assert.deepEqual(cuerpo.adeudo, { monto: 450, plan: plan.nombre });
      assert.deepEqual(cuerpo.rostro, { registrado: false, fecha_registro: null });
      assert.deepEqual(cuerpo.visitas, []);
      assert.deepEqual(cuerpo.pagos, []);
    });

    it('cada cliente ve solo lo suyo', async () => {
      const deAna = (await api('/clientes/me/resumen', tokenAna)).cuerpo;
      const deBeto = (await api('/clientes/me/resumen', tokenBeto)).cuerpo;
      assert.equal(deAna.membresia.id_cliente, ana.id_cliente);
      assert.equal(deBeto.membresia.id_cliente, beto.id_cliente);
    });

    it('solo el rol cliente: el personal recibe 403 y sin sesión 401', async () => {
      for (const token of [admin.token, recepcion.token, entrenador.token]) {
        assert.equal((await api('/clientes/me/resumen', token)).status, 403);
      }
      assert.equal((await solicitar(servidor.url, 'GET', '/clientes/me/resumen')).status, 401);
    });
  });
});
