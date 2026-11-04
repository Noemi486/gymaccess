import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/config/db.js';
import {
  iniciarServidor,
  solicitar,
  crearUsuarioConRol,
  crearClienteDePrueba,
  crearTipoMembresiaDePrueba,
  crearMembresiaDePrueba,
  fechaRelativa,
  limpiarDatosDePrueba,
  cerrarPool,
  sinBiometria,
} from '../helpers.js';

// Consulta de pagos y adeudos (US7, FR-018, FR-020, FR-021) sobre gymaccess_test.
// Los pagos del historial usan fechas de abril de 2001 para no mezclarse con los de otras pruebas, y los
// clientes llevan una marca en el apellido para filtrar con `q`.

describe('GET /pagos y GET /adeudos', () => {
  let servidor;
  let admin;
  let recepcion;
  let entrenador;
  let ana;
  let beto;
  let carla;
  let plan;
  let planCaro;
  const usuarios = [];
  const clientes = [];
  const tipos = [];
  const marca = `Pga${process.pid}${Date.now() % 100000}`;
  const RANGO = 'desde=2001-04-10&hasta=2001-04-12';
  const pagos = {};
  const membresias = {};

  const api = (metodo, ruta, token, cuerpo) => solicitar(servidor.url, metodo, ruta, { token, cuerpo });
  const listarPagos = (consulta = '', token = admin.token) => api('GET', `/pagos?${RANGO}${consulta ? `&${consulta}` : ''}`, token);
  const listarAdeudos = (consulta = '', token = admin.token) => api('GET', `/adeudos?q=${marca}${consulta ? `&${consulta}` : ''}`, token);

  // Pago con fecha exacta (inserción directa) para probar los filtros por rango.
  const insertarPago = async (idCliente, idMembresia, monto, metodo, fechaPago) => {
    const [r] = await pool.execute(
      "INSERT INTO pagos (id_cliente, id_membresia, monto, metodo_pago, estado, id_usuario, fecha_pago) VALUES (?, ?, ?, ?, 'registrado', ?, ?)",
      [idCliente, idMembresia, monto, metodo, admin.id_usuario, fechaPago],
    );
    return r.insertId;
  };

  before(async () => {
    servidor = await iniciarServidor();
    admin = await crearUsuarioConRol('administrador');
    recepcion = await crearUsuarioConRol('recepcionista');
    entrenador = await crearUsuarioConRol('entrenador');
    usuarios.push(admin.id_usuario, recepcion.id_usuario, entrenador.id_usuario);

    ana = await crearClienteDePrueba({ nombre: 'Ana', apellido: `${marca}Alfa` });
    beto = await crearClienteDePrueba({ nombre: 'Beto', apellido: `${marca}Beta` });
    carla = await crearClienteDePrueba({ nombre: 'Carla', apellido: `${marca}Gama` });
    clientes.push(ana.id_cliente, beto.id_cliente, carla.id_cliente);

    plan = await crearTipoMembresiaDePrueba({ precio: '450.00' });
    planCaro = await crearTipoMembresiaDePrueba({ precio: '1250.50' });
    tipos.push(plan.id_tipo_membresia, planCaro.id_tipo_membresia);

    // Historial: membresías de 2001 con pagos en fechas conocidas.
    const viejaA = await crearMembresiaDePrueba({ idCliente: ana.id_cliente, idTipo: plan.id_tipo_membresia, inicio: '2001-04-10', fin: '2001-05-09' });
    const viejaB = await crearMembresiaDePrueba({ idCliente: beto.id_cliente, idTipo: planCaro.id_tipo_membresia, inicio: '2001-04-11', fin: '2001-05-10' });
    const viejaC = await crearMembresiaDePrueba({ idCliente: carla.id_cliente, idTipo: plan.id_tipo_membresia, inicio: '2001-04-12', fin: '2001-05-11' });
    pagos.a = await insertarPago(ana.id_cliente, viejaA.id_membresia, '450.00', 'efectivo', '2001-04-10 00:00:00');
    pagos.b = await insertarPago(beto.id_cliente, viejaB.id_membresia, '1250.50', 'tarjeta', '2001-04-11 13:30:00');
    pagos.c = await insertarPago(carla.id_cliente, viejaC.id_membresia, '450.00', 'transferencia', '2001-04-12 23:59:59');

    // Adeudos actuales: Ana (empieza hace 3 días) y Beto (empieza hoy) sin pagar; Carla pagada.
    membresias.anaPendiente = (await crearMembresiaDePrueba({
      idCliente: ana.id_cliente, idTipo: plan.id_tipo_membresia, inicio: await fechaRelativa(-3), fin: await fechaRelativa(26),
    })).id_membresia;
    membresias.betoPendiente = (await crearMembresiaDePrueba({
      idCliente: beto.id_cliente, idTipo: planCaro.id_tipo_membresia, inicio: await fechaRelativa(0), fin: await fechaRelativa(29),
    })).id_membresia;
    membresias.carlaPagada = (await crearMembresiaDePrueba({
      idCliente: carla.id_cliente, idTipo: plan.id_tipo_membresia, inicio: await fechaRelativa(0), fin: await fechaRelativa(29), pagada: true,
    })).id_membresia;
  });

  after(async () => {
    try {
      await limpiarDatosDePrueba({ usuarios, clientes, tipos });
    } finally {
      await servidor.cerrar();
      await cerrarPool();
    }
  });

  describe('GET /pagos', () => {
    it('lista del más reciente al más antiguo con cliente, plan, monto, método y quién lo registró', async () => {
      const r = await listarPagos();
      assert.equal(r.status, 200);
      assert.deepEqual(r.cuerpo.data.map((p) => p.id_pago), [pagos.c, pagos.b, pagos.a]);
      const b = r.cuerpo.data[1];
      assert.equal(b.cliente.id_cliente, beto.id_cliente);
      assert.equal(b.membresia.plan, planCaro.nombre);
      assert.equal(b.monto, 1250.5);
      assert.equal(b.metodo_pago, 'tarjeta');
      assert.ok(b.registrado_por);
      assert.equal(r.cuerpo.total, 3);
      sinBiometria(r.cuerpo);
    });

    it('incluye los pagos del primer y del último segundo del rango', async () => {
      const r = await listarPagos();
      const idsPagos = r.cuerpo.data.map((p) => p.id_pago);
      assert.ok(idsPagos.includes(pagos.a) && idsPagos.includes(pagos.c));
    });

    it('total_monto suma solo lo filtrado (sin errores de decimales)', async () => {
      assert.equal((await listarPagos()).cuerpo.total_monto, 2150.5);
      const efectivo = await listarPagos('metodo_pago=efectivo');
      assert.deepEqual(efectivo.cuerpo.data.map((p) => p.id_pago), [pagos.a]);
      assert.equal(efectivo.cuerpo.total_monto, 450);
    });

    it('filtra por rango de una sola fecha y busca por cliente', async () => {
      const dia = await api('GET', '/pagos?desde=2001-04-11&hasta=2001-04-11', admin.token);
      assert.deepEqual(dia.cuerpo.data.map((p) => p.id_pago), [pagos.b]);
      const busqueda = await listarPagos(`q=${marca}Gama`);
      assert.deepEqual(busqueda.cuerpo.data.map((p) => p.id_pago), [pagos.c]);
    });

    it('pagina sin perder el total', async () => {
      const r = await listarPagos('limit=2&page=2');
      assert.deepEqual(r.cuerpo.data.map((p) => p.id_pago), [pagos.a]);
      assert.equal(r.cuerpo.total, 3);
      assert.equal(r.cuerpo.total_monto, 2150.5);
    });

    it('rechaza filtros inválidos con 400', async () => {
      assert.equal((await api('GET', '/pagos?desde=2001-04-12&hasta=2001-04-10', admin.token)).status, 400);
      assert.equal((await api('GET', '/pagos?desde=2001-02-30', admin.token)).status, 400);
      assert.equal((await api('GET', '/pagos?metodo_pago=cheque', admin.token)).status, 400);
    });

    it('el recepcionista consulta; entrenador 403; sin sesión 401', async () => {
      assert.equal((await listarPagos('', recepcion.token)).status, 200);
      assert.equal((await listarPagos('', entrenador.token)).status, 403);
      assert.equal((await solicitar(servidor.url, 'GET', `/pagos?${RANGO}`)).status, 401);
    });

    it('no existen rutas para editar ni eliminar pagos', async () => {
      for (const metodo of ['PUT', 'PATCH', 'DELETE']) {
        const r = await api(metodo, `/pagos/${pagos.a}`, admin.token, {});
        assert.equal(r.status, 404, `${metodo} no debe existir`);
      }
    });
  });

  describe('GET /adeudos', () => {
    it('lista solo membresías pendientes de pago, la fecha de inicio más antigua primero', async () => {
      const r = await listarAdeudos();
      assert.equal(r.status, 200);
      assert.deepEqual(r.cuerpo.data.map((a) => a.id_membresia), [membresias.anaPendiente, membresias.betoPendiente]);
      const ana1 = r.cuerpo.data[0];
      assert.equal(ana1.cliente.id_cliente, ana.id_cliente);
      assert.equal(ana1.plan, plan.nombre);
      assert.equal(ana1.adeudo, 450);
      assert.equal(ana1.fecha_inicio, await fechaRelativa(-3));
      assert.equal(r.cuerpo.total_adeudo, 1700.5);
      sinBiometria(r.cuerpo);
    });

    it('al registrar el pago, la membresía sale de Adeudos', async () => {
      const pago = await api('POST', '/pagos', recepcion.token, { id_membresia: membresias.betoPendiente, metodo_pago: 'efectivo', monto: 1250.5 });
      assert.equal(pago.status, 201);
      const r = await listarAdeudos();
      assert.deepEqual(r.cuerpo.data.map((a) => a.id_membresia), [membresias.anaPendiente]);
      assert.equal(r.cuerpo.total_adeudo, 450);
    });

    it('el adeudo sigue el precio vigente del plan', async () => {
      await pool.execute('UPDATE tipos_membresia SET precio = ? WHERE id_tipo_membresia = ?', ['500.00', plan.id_tipo_membresia]);
      try {
        const r = await listarAdeudos();
        assert.equal(r.cuerpo.data[0].adeudo, 500);
      } finally {
        await pool.execute('UPDATE tipos_membresia SET precio = ? WHERE id_tipo_membresia = ?', ['450.00', plan.id_tipo_membresia]);
      }
    });

    it('no incluye canceladas, suspendidas ni vencidas', async () => {
      const suspendida = await crearMembresiaDePrueba({
        idCliente: carla.id_cliente, idTipo: plan.id_tipo_membresia, inicio: await fechaRelativa(40), fin: await fechaRelativa(69), estado: 'suspendida',
      });
      const vencida = await crearMembresiaDePrueba({
        idCliente: carla.id_cliente, idTipo: plan.id_tipo_membresia, inicio: await fechaRelativa(-40), fin: await fechaRelativa(-11),
      });
      const cancelada = await crearMembresiaDePrueba({
        idCliente: carla.id_cliente, idTipo: plan.id_tipo_membresia, inicio: await fechaRelativa(70), fin: await fechaRelativa(99), estado: 'cancelada',
      });
      const r = await listarAdeudos();
      const idsAdeudo = r.cuerpo.data.map((a) => a.id_membresia);
      for (const id of [suspendida.id_membresia, vencida.id_membresia, cancelada.id_membresia, membresias.carlaPagada]) {
        assert.ok(!idsAdeudo.includes(id), `la membresía ${id} no debe aparecer`);
      }
    });

    it('busca por cliente y estado vacío cuando no hay coincidencias', async () => {
      const ana2 = await api('GET', `/adeudos?q=${marca}Alfa`, admin.token);
      assert.deepEqual(ana2.cuerpo.data.map((a) => a.id_membresia), [membresias.anaPendiente]);
      const nadie = await api('GET', `/adeudos?q=${marca}NoExiste`, admin.token);
      assert.deepEqual(nadie.cuerpo.data, []);
      assert.equal(nadie.cuerpo.total, 0);
      assert.equal(nadie.cuerpo.total_adeudo, 0);
    });

    it('el recepcionista consulta; entrenador 403; sin sesión 401', async () => {
      assert.equal((await listarAdeudos('', recepcion.token)).status, 200);
      assert.equal((await listarAdeudos('', entrenador.token)).status, 403);
      assert.equal((await solicitar(servidor.url, 'GET', '/adeudos')).status, 401);
    });
  });
});
