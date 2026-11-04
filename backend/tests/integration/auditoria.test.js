import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/config/db.js';
import {
  iniciarServidor,
  solicitar,
  crearUsuarioConRol,
  crearClienteDePrueba,
  crearDescriptorSintetico,
  limpiarDatosDePrueba,
  cerrarPool,
} from '../helpers.js';

// Auditoría de acciones importantes (US11, FR-045, FR-046, SC-013) sobre gymaccess_test.
// Cada acción se hace por la API y se busca su evento por el identificador que lleva la descripción.

describe('Auditoría del Sprint 2', () => {
  let servidor;
  let admin;
  let recepcion;
  const usuarios = [];
  const clientes = [];
  const tipos = [];
  const marca = `Aud${process.pid}${Date.now() % 100000}`;

  const api = (metodo, ruta, token, cuerpo) => solicitar(servidor.url, metodo, ruta, { token, cuerpo });

  // Eventos de un módulo y acción cuya descripción contiene `texto`, del más reciente al más antiguo.
  const eventos = async (modulo, accion, texto) => {
    const [filas] = await pool.execute(
      'SELECT id_usuario, accion, modulo, resultado, descripcion, fecha FROM auditoria WHERE modulo = ? AND accion = ? AND descripcion LIKE ? ORDER BY id_auditoria DESC',
      [modulo, accion, `%${texto}%`],
    );
    return filas;
  };
  const exito = async (modulo, accion, texto, actor) => {
    const filas = (await eventos(modulo, accion, texto)).filter((f) => f.resultado === 'exito');
    assert.equal(filas.length, 1, `un evento de éxito ${modulo}/${accion} con "${texto}"`);
    assert.equal(filas[0].id_usuario, actor.id_usuario);
    assert.ok(filas[0].fecha, 'con fecha y hora');
    assert.ok(filas[0].descripcion.length > 0 && filas[0].descripcion.length <= 500);
    return filas[0];
  };
  const nuevoCliente = async (nombre = 'Cli') => {
    const c = await crearClienteDePrueba({ nombre, apellido: `${marca}${nombre}` });
    clientes.push(c.id_cliente);
    return c;
  };

  before(async () => {
    servidor = await iniciarServidor();
    admin = await crearUsuarioConRol('administrador');
    recepcion = await crearUsuarioConRol('recepcionista');
    usuarios.push(admin.id_usuario, recepcion.id_usuario);
  });

  after(async () => {
    try {
      await limpiarDatosDePrueba({ usuarios, clientes, tipos });
    } finally {
      await servidor.cerrar();
      await cerrarPool();
    }
  });

  it('tipos de membresía: crear, modificar, desactivar y activar', async () => {
    const r = await api('POST', '/tipos-membresia', admin.token, { nombre: `Plan test ${marca}`, duracion: 30, precio: 450 });
    assert.equal(r.status, 201);
    const id = r.cuerpo.id_tipo_membresia;
    tipos.push(id);
    await api('PATCH', `/tipos-membresia/${id}`, admin.token, { precio: 500 });
    await api('PATCH', `/tipos-membresia/${id}/estado`, admin.token, { estado: 'inactivo' });
    await api('PATCH', `/tipos-membresia/${id}/estado`, admin.token, { estado: 'activo' });
    for (const accion of ['crear', 'modificar', 'desactivar', 'activar']) {
      const filas = (await eventos('tipos_membresia', accion, `Plan de membresía ${id} `)).filter((f) => f.resultado === 'exito' && f.id_usuario === admin.id_usuario);
      assert.ok(filas.length >= 1, `evento ${accion}`);
    }
  });

  it('membresías y pagos: asignar, registrar pago, renovar, suspender, reactivar y cancelar', async () => {
    const plan = await api('POST', '/tipos-membresia', admin.token, { nombre: `Plan test ${marca} B`, duracion: 30, precio: 450 });
    tipos.push(plan.cuerpo.id_tipo_membresia);
    const c = await nuevoCliente('Memb');

    const asignada = await api('POST', `/clientes/${c.id_cliente}/membresias`, recepcion.token, { id_tipo_membresia: plan.cuerpo.id_tipo_membresia });
    assert.equal(asignada.status, 201);
    const idM = asignada.cuerpo.membresia.id_membresia;
    await exito('membresias', 'asignar', `Membresía ${idM} asignada`, recepcion);

    const pago = await api('POST', '/pagos', recepcion.token, { id_membresia: idM, metodo_pago: 'efectivo', monto: 450 });
    assert.equal(pago.status, 201);
    await exito('pagos', 'registrar', `Pago ${pago.cuerpo.pago.id_pago} `, recepcion);

    const renovada = await api('POST', `/membresias/${idM}/renovar`, recepcion.token, {});
    assert.equal(renovada.status, 201);
    await exito('membresias', 'renovar', `Membresía ${idM} renovada`, recepcion);

    for (const accion of ['suspender', 'reactivar', 'cancelar']) {
      const r = await api('PATCH', `/membresias/${idM}/estado`, admin.token, { accion });
      assert.equal(r.status, 200, accion);
      await exito('membresias', accion, `Membresía ${idM} (`, admin);
    }
  });

  it('rostros: registrar, reemplazar, desactivar y reactivar', async () => {
    const c = await nuevoCliente('Rostro');
    const primero = await api('POST', `/clientes/${c.id_cliente}/rostro`, recepcion.token, { descriptor: crearDescriptorSintetico(70_001), consentimiento: true });
    assert.equal(primero.status, 201);
    await exito('rostros', 'registrar', `Rostro ${primero.cuerpo.id_rostro} registrado`, recepcion);

    const segundo = await api('POST', `/clientes/${c.id_cliente}/rostro`, recepcion.token, { descriptor: crearDescriptorSintetico(70_002), consentimiento: true });
    await exito('rostros', 'reemplazar', `Rostro ${segundo.cuerpo.id_rostro} reemplazado`, recepcion);

    await api('PATCH', `/rostros/${segundo.cuerpo.id_rostro}/estado`, admin.token, { estado: 'inactivo' });
    await exito('rostros', 'desactivar', `Rostro ${segundo.cuerpo.id_rostro} del cliente`, admin);
    await api('PATCH', `/rostros/${segundo.cuerpo.id_rostro}/estado`, admin.token, { estado: 'activo' });
    await exito('rostros', 'reactivar', `Rostro ${segundo.cuerpo.id_rostro} del cliente`, admin);
  });

  it('una acción rechazada por una regla de negocio deja un evento de error', async () => {
    const plan = await api('POST', '/tipos-membresia', admin.token, { nombre: `Plan test ${marca} C`, duracion: 30, precio: 450 });
    tipos.push(plan.cuerpo.id_tipo_membresia);
    const c = await nuevoCliente('Error');
    const m = await api('POST', `/clientes/${c.id_cliente}/membresias`, recepcion.token, { id_tipo_membresia: plan.cuerpo.id_tipo_membresia });
    const idM = m.cuerpo.membresia.id_membresia;
    await api('POST', '/pagos', recepcion.token, { id_membresia: idM, metodo_pago: 'efectivo', monto: 450 });

    // Segundo pago de la misma membresía: 409 y evento de error.
    const repetido = await api('POST', '/pagos', recepcion.token, { id_membresia: idM, metodo_pago: 'efectivo', monto: 450 });
    assert.equal(repetido.status, 409);
    const errores = (await eventos('pagos', 'registrar', `membresía ${idM}.`)).filter((f) => f.resultado === 'error');
    assert.equal(errores.length, 1);
    assert.equal(errores[0].id_usuario, recepcion.id_usuario);

    // Rostro de un cliente dado de baja: 409 y evento de error.
    const baja = await crearClienteDePrueba({ nombre: 'Baja', apellido: `${marca}Baja`, estado: 'inactivo' });
    clientes.push(baja.id_cliente);
    const rostro = await api('POST', `/clientes/${baja.id_cliente}/rostro`, recepcion.token, { descriptor: crearDescriptorSintetico(70_003), consentimiento: true });
    assert.equal(rostro.status, 409);
    const erroresRostro = (await eventos('rostros', 'registrar', `cliente ${baja.id_cliente}.`)).filter((f) => f.resultado === 'error');
    assert.equal(erroresRostro.length, 1);
  });

  it('si la acción falla y se revierte, no queda evento de éxito', async () => {
    const plan = await api('POST', '/tipos-membresia', admin.token, { nombre: `Plan test ${marca} D`, duracion: 30, precio: 450 });
    tipos.push(plan.cuerpo.id_tipo_membresia);
    const c = await nuevoCliente('Revertida');
    // Asignar con un monto incorrecto: 400 y no se crea ni la membresía ni el pago (todo o nada).
    const r = await api('POST', `/clientes/${c.id_cliente}/membresias`, recepcion.token, {
      id_tipo_membresia: plan.cuerpo.id_tipo_membresia,
      pago: { metodo_pago: 'efectivo', monto: 100 },
    });
    assert.equal(r.status, 400);
    const asignaciones = (await eventos('membresias', 'asignar', `cliente ${c.id_cliente} (`)).filter((f) => f.resultado === 'exito');
    assert.equal(asignaciones.length, 0);
  });

  it('ninguna descripción contiene datos biométricos, contraseñas ni vectores', async () => {
    const [filas] = await pool.execute(
      "SELECT descripcion FROM auditoria WHERE modulo IN ('tipos_membresia', 'membresias', 'pagos', 'rostros') ORDER BY id_auditoria DESC LIMIT 500",
    );
    for (const { descripcion } of filas) {
      assert.ok(!/descriptor|password|contrase|token/i.test(descripcion ?? ''), descripcion);
      assert.ok(!/-?\d+\.\d{3,}/.test(descripcion ?? ''), 'sin números de un vector facial');
    }
  });

  it('los intentos de acceso no generan eventos de auditoría', async () => {
    // La cuenta de recepción es solo de esta prueba: ningún otro proceso escribe eventos con su id.
    const contar = async () => Number((await pool.execute('SELECT COUNT(*) AS n FROM auditoria WHERE id_usuario = ?', [recepcion.id_usuario]))[0][0].n);
    const antes = await contar();
    const r = await api('POST', '/accesos/identificar', recepcion.token, { descriptor: crearDescriptorSintetico(70_999) });
    assert.equal(r.status, 200);
    assert.equal(await contar(), antes);
    const [deAcceso] = await pool.execute("SELECT COUNT(*) AS n FROM auditoria WHERE modulo = 'accesos'");
    assert.equal(Number(deAcceso[0].n), 0);
  });

  it('no existe ninguna ruta para consultar, modificar o borrar la auditoría', async () => {
    for (const metodo of ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']) {
      const r = await api(metodo, '/auditoria', admin.token, {});
      assert.equal(r.status, 404, `${metodo} /auditoria`);
    }
  });
});
