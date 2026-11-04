import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/config/db.js';
import { estadoActual } from '../../src/models/dashboard.model.js';
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
} from '../helpers.js';

// Dashboard del administrador (US8, FR-037 a FR-041) sobre gymaccess_test.
// Las cifras del periodo usan un rango de junio de 2001 (ninguna otra prueba usa esas fechas) y las del estado
// actual se comprueban sobre clientes propios con el filtro `soloClientes` del modelo, para no depender de los
// datos que crean otras pruebas al mismo tiempo.

describe('GET /dashboard', () => {
  let servidor;
  let admin;
  let recepcion;
  let entrenador;
  let tokenCliente;
  let plan;
  let hoy;
  const usuarios = [];
  const clientes = [];
  const tipos = [];
  const idsPago = [];
  const idsAcceso = [];
  const RANGO_2001 = 'periodo=rango&desde=2001-06-01&hasta=2001-06-03';
  const marca = `Dsh${process.pid}${Date.now() % 100000}`;
  const cat = {};

  const api = (ruta, token = admin.token) => solicitar(servidor.url, 'GET', ruta, { token });
  const cliente = async (nombre, estado = 'activo') => {
    const c = await crearClienteDePrueba({ nombre, apellido: `${marca}${nombre}`, estado });
    clientes.push(c.id_cliente);
    return c;
  };
  const membresia = async (c, inicio, fin, { pagada = false, estado = 'activa' } = {}) =>
    crearMembresiaDePrueba({ idCliente: c.id_cliente, idTipo: plan.id_tipo_membresia, inicio: await fechaRelativa(inicio), fin: await fechaRelativa(fin), pagada, estado });

  before(async () => {
    servidor = await iniciarServidor();
    admin = await crearUsuarioConRol('administrador');
    recepcion = await crearUsuarioConRol('recepcionista');
    entrenador = await crearUsuarioConRol('entrenador');
    usuarios.push(admin.id_usuario, recepcion.id_usuario, entrenador.id_usuario);
    plan = await crearTipoMembresiaDePrueba({ precio: '450.00' });
    tipos.push(plan.id_tipo_membresia);
    hoy = await fechaRelativa(0);

    // Cuenta del rol cliente.
    const propio = await cliente('Cuenta');
    const cuenta = await solicitar(servidor.url, 'POST', '/usuarios', {
      token: admin.token,
      cuerpo: { nombre: 'Cliente dashboard', correo: propio.correo, password: 'Secreta123', rol: 'cliente', id_cliente: propio.id_cliente },
    });
    usuarios.push(cuenta.cuerpo.id_usuario);
    tokenCliente = crearToken(cuenta.cuerpo.id_usuario);

    // Categorías del estado actual (FR-040).
    cat.vigente = await cliente('Vigente');
    await membresia(cat.vigente, -20, 10, { pagada: true });
    cat.porVencer = await cliente('PorVencer');
    await membresia(cat.porVencer, -27, 3, { pagada: true });
    cat.venceHoy = await cliente('VenceHoy');
    await membresia(cat.venceHoy, -29, 0, { pagada: true });
    cat.vencida = await cliente('Vencida');
    await membresia(cat.vencida, -31, -1, { pagada: true });
    cat.pendiente = await cliente('Pendiente');
    await membresia(cat.pendiente, -2, 27);
    cat.vencidaConPendiente = await cliente('VencidaPendiente');
    await membresia(cat.vencidaConPendiente, -60, -31, { pagada: true });
    await membresia(cat.vencidaConPendiente, -1, 28);
    cat.conRenovacionFutura = await cliente('Futura');
    await membresia(cat.conRenovacionFutura, -40, -11, { pagada: true });
    await membresia(cat.conRenovacionFutura, 5, 34, { pagada: true });
    cat.cancelada = await cliente('Cancelada');
    await membresia(cat.cancelada, -10, 19, { pagada: true, estado: 'cancelada' });
    cat.inactivo = await cliente('Inactivo', 'inactivo');
    await membresia(cat.inactivo, -5, 24, { pagada: true });

    // Cifras del periodo (junio de 2001).
    const vieja = await crearMembresiaDePrueba({ idCliente: cat.vigente.id_cliente, idTipo: plan.id_tipo_membresia, inicio: '2001-06-01', fin: '2001-06-30' });
    const viejaB = await crearMembresiaDePrueba({ idCliente: cat.vencida.id_cliente, idTipo: plan.id_tipo_membresia, inicio: '2001-06-02', fin: '2001-07-01' });
    for (const [idCliente, idMembresia, monto, fecha] of [
      [cat.vigente.id_cliente, vieja.id_membresia, '450.00', '2001-06-01 00:00:00'],
      [cat.vencida.id_cliente, viejaB.id_membresia, '1250.50', '2001-06-03 23:59:59'],
    ]) {
      const [r] = await pool.execute(
        "INSERT INTO pagos (id_cliente, id_membresia, monto, metodo_pago, estado, id_usuario, fecha_pago) VALUES (?, ?, ?, 'efectivo', 'registrado', ?, ?)",
        [idCliente, idMembresia, monto, admin.id_usuario, fecha],
      );
      idsPago.push(r.insertId);
    }
    for (const [idCliente, fecha, hora, resultado, motivo] of [
      [cat.vigente.id_cliente, '2001-06-01', '08:00:00', 'autorizado', null],
      [null, '2001-06-02', '09:00:00', 'rechazado', 'Rostro no reconocido'],
      [cat.vencida.id_cliente, '2001-06-03', '10:00:00', 'autorizado', null],
    ]) {
      const [r] = await pool.execute(
        "INSERT INTO accesos (id_cliente, fecha, hora, tipo, resultado, motivo_rechazo) VALUES (?, ?, ?, 'entrada', ?, ?)",
        [idCliente, fecha, hora, resultado, motivo],
      );
      idsAcceso.push(r.insertId);
    }
  });

  after(async () => {
    try {
      for (const id of idsPago) await pool.execute('DELETE FROM pagos WHERE id_pago = ?', [id]);
      for (const id of idsAcceso) await pool.execute('DELETE FROM accesos WHERE id_acceso = ?', [id]);
      await limpiarDatosDePrueba({ usuarios, clientes, tipos });
    } finally {
      await servidor.cerrar();
      await cerrarPool();
    }
  });

  describe('permisos', () => {
    it('solo el administrador: recepcionista, entrenador y cliente 403; sin sesión 401', async () => {
      assert.equal((await api('/dashboard')).status, 200);
      assert.equal((await api('/dashboard', recepcion.token)).status, 403);
      assert.equal((await api('/dashboard', entrenador.token)).status, 403);
      assert.equal((await api('/dashboard', tokenCliente)).status, 403);
      assert.equal((await solicitar(servidor.url, 'GET', '/dashboard')).status, 401);
    });
  });

  describe('periodo', () => {
    it('"hoy" es el predeterminado', async () => {
      const r = await api('/dashboard');
      assert.deepEqual(r.cuerpo.periodo, { tipo: 'hoy', desde: hoy, hasta: hoy });
      for (const clave of ['clientes_activos', 'con_membresia_vigente', 'con_membresia_vencida', 'con_membresia_por_vencer']) {
        assert.equal(typeof r.cuerpo.estado_actual[clave], 'number');
      }
      assert.ok(r.cuerpo.estado_actual.con_membresia_por_vencer <= r.cuerpo.estado_actual.con_membresia_vigente);
      assert.ok(Array.isArray(r.cuerpo.accesos_recientes) && r.cuerpo.accesos_recientes.length <= 10);
      sinBiometria(r.cuerpo);
    });

    it('"semana" va del lunes de esta semana a hoy', async () => {
      const { periodo } = (await api('/dashboard?periodo=semana')).cuerpo;
      assert.equal(periodo.tipo, 'semana');
      assert.equal(periodo.hasta, hoy);
      assert.equal(new Date(`${periodo.desde}T00:00:00Z`).getUTCDay(), 1, 'debe empezar en lunes');
      assert.ok(periodo.desde <= hoy);
      const dias = (Date.parse(hoy) - Date.parse(periodo.desde)) / 86_400_000;
      assert.ok(dias >= 0 && dias <= 6);
    });

    it('"mes" va del día 1 a hoy', async () => {
      const { periodo } = (await api('/dashboard?periodo=mes')).cuerpo;
      assert.deepEqual(periodo, { tipo: 'mes', desde: `${hoy.slice(0, 8)}01`, hasta: hoy });
    });

    it('rangos inválidos responden 400', async () => {
      const futuro = await fechaRelativa(1);
      for (const consulta of [
        'periodo=rango',
        'periodo=rango&desde=2001-06-03&hasta=2001-06-01',
        `periodo=rango&desde=${hoy}&hasta=${futuro}`,
        'periodo=rango&desde=2001-01-01&hasta=2002-01-02',
        'periodo=rango&desde=2001-02-30&hasta=2001-03-01',
        'periodo=anio',
      ]) {
        assert.equal((await api(`/dashboard?${consulta}`)).status, 400, consulta);
      }
      // Exactamente 366 días sí se acepta.
      assert.equal((await api('/dashboard?periodo=rango&desde=2001-01-01&hasta=2002-01-01')).status, 200);
    });
  });

  describe('cifras del periodo', () => {
    it('ingresos, accesos autorizados y rechazados del rango (incluye el primer y el último segundo)', async () => {
      const r = await api(`/dashboard?${RANGO_2001}`);
      assert.equal(r.status, 200);
      assert.deepEqual(r.cuerpo.periodo, { tipo: 'rango', desde: '2001-06-01', hasta: '2001-06-03' });
      assert.deepEqual(r.cuerpo.periodo_datos, { ingresos: 1700.5, accesos_autorizados: 2, accesos_rechazados: 1 });
    });

    it('accesos recientes del periodo, del más reciente al más antiguo', async () => {
      const r = await api(`/dashboard?${RANGO_2001}`);
      assert.deepEqual(r.cuerpo.accesos_recientes.map((a) => a.id_acceso), [...idsAcceso].reverse());
      assert.equal(r.cuerpo.accesos_recientes[1].cliente, null);
      assert.equal(r.cuerpo.accesos_recientes[1].motivo_rechazo, 'Rostro no reconocido');
    });

    it('cada cifra coincide con las listas de origen (Pagos y Accesos)', async () => {
      const tablero = (await api(`/dashboard?${RANGO_2001}`)).cuerpo.periodo_datos;
      const pagos = (await api('/pagos?desde=2001-06-01&hasta=2001-06-03')).cuerpo;
      const autorizados = (await api('/accesos?desde=2001-06-01&hasta=2001-06-03&resultado=autorizado')).cuerpo;
      const rechazados = (await api('/accesos?desde=2001-06-01&hasta=2001-06-03&resultado=rechazado')).cuerpo;
      assert.equal(tablero.ingresos, pagos.total_monto);
      assert.equal(tablero.accesos_autorizados, autorizados.total);
      assert.equal(tablero.accesos_rechazados, rechazados.total);
    });

    it('un periodo sin datos sale en 0 y sin accesos recientes', async () => {
      const r = await api('/dashboard?periodo=rango&desde=2001-08-01&hasta=2001-08-02');
      assert.deepEqual(r.cuerpo.periodo_datos, { ingresos: 0, accesos_autorizados: 0, accesos_rechazados: 0 });
      assert.deepEqual(r.cuerpo.accesos_recientes, []);
    });
  });

  describe('estado actual (FR-038, FR-040)', () => {
    it('cada cliente cuenta en una sola categoría y "por vencer" es parte de "vigente"', async () => {
      const ids = Object.values(cat).map((c) => c.id_cliente);
      assert.deepEqual(await estadoActual({ soloClientes: ids }), {
        clientes_activos: 8, // todos menos el inactivo
        con_membresia_vigente: 3, // vigente, por vencer (3 días) y vence hoy (0 días)
        con_membresia_vencida: 2, // vencida y vencida con una nueva pendiente de pago
        con_membresia_por_vencer: 2, // 3 días y 0 días
      });
    });

    it('las pendientes de pago y las canceladas no cuentan como vigentes', async () => {
      const r = await estadoActual({ soloClientes: [cat.pendiente.id_cliente, cat.cancelada.id_cliente] });
      assert.equal(r.con_membresia_vigente, 0);
      assert.equal(r.con_membresia_vencida, 0);
    });

    it('una renovación futura ya pagada evita contar al cliente como vencido', async () => {
      const r = await estadoActual({ soloClientes: [cat.conRenovacionFutura.id_cliente] });
      assert.deepEqual(r, { clientes_activos: 1, con_membresia_vigente: 0, con_membresia_vencida: 0, con_membresia_por_vencer: 0 });
    });

    it('las tarjetas del estado actual no cambian con el periodo', async () => {
      const ids = Object.values(cat).map((c) => c.id_cliente);
      const antes = await estadoActual({ soloClientes: ids });
      await api('/dashboard?periodo=mes');
      await api(`/dashboard?${RANGO_2001}`);
      assert.deepEqual(await estadoActual({ soloClientes: ids }), antes);
    });
  });
});
