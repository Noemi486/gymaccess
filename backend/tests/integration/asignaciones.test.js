import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/config/db.js';
import {
  iniciarServidor,
  solicitar,
  crearToken,
  crearUsuarioConRol,
  crearClienteDePrueba,
  crearEntrenadorDePrueba,
  limpiarDatosDePrueba,
  cerrarPool,
} from '../helpers.js';

// Asignación de entrenador a cliente (spec 004, US2 y US7, FR-005 a FR-008, FR-024, FR-029) sobre gymaccess_test.

describe('Asignaciones de entrenador', () => {
  let servidor;
  let admin;
  let recepcion;
  let luis;
  let eva;
  let inactivo;
  const usuarios = [];
  const clientes = [];
  const marca = `Asg${process.pid}${Date.now() % 100000}`;

  const api = (metodo, ruta, token, cuerpo) => solicitar(servidor.url, metodo, ruta, { token, cuerpo });
  const nuevoCliente = async (sufijo, estado = 'activo') => {
    const c = await crearClienteDePrueba({ nombre: sufijo, apellido: `${marca}${sufijo}`, estado });
    clientes.push(c.id_cliente);
    return c;
  };
  const activas = async (idCliente) =>
    Number((await pool.execute("SELECT COUNT(*) AS n FROM asignaciones_entrenador WHERE id_cliente = ? AND estado = 'activa'", [idCliente]))[0][0].n);
  const eventos = async (accion, idCliente) =>
    (await pool.execute("SELECT id_usuario, resultado FROM auditoria WHERE modulo = 'asignaciones' AND accion = ? AND descripcion LIKE ?", [accion, `Cliente ${idCliente}%`]))[0];

  before(async () => {
    servidor = await iniciarServidor();
    admin = await crearUsuarioConRol('administrador');
    recepcion = await crearUsuarioConRol('recepcionista');
    luis = await crearEntrenadorDePrueba({ nombre: `Luis ${marca}` });
    eva = await crearEntrenadorDePrueba({ nombre: `Eva ${marca}` });
    inactivo = await crearEntrenadorDePrueba({ nombre: `Inactivo ${marca}`, estado: 'inactivo' });
    usuarios.push(admin.id_usuario, recepcion.id_usuario, luis.id_usuario, eva.id_usuario, inactivo.id_usuario);
  });

  after(async () => {
    try {
      await limpiarDatosDePrueba({ usuarios, clientes });
    } finally {
      await servidor.cerrar();
      await cerrarPool();
    }
  });

  it('asignar, cambiar y quitar: nunca dos activas, historial con fechas y auditoría', async () => {
    const c = await nuevoCliente('Ciclo');
    const vacio = await api('GET', `/clientes/${c.id_cliente}/entrenador`, recepcion.token);
    assert.equal(vacio.status, 200);
    assert.deepEqual(vacio.cuerpo, { actual: null, historial: [] });

    const r1 = await api('PUT', `/clientes/${c.id_cliente}/entrenador`, recepcion.token, { id_entrenador: luis.id_usuario });
    assert.equal(r1.status, 200);
    assert.equal(r1.cuerpo.actual.entrenador.id_usuario, luis.id_usuario);
    assert.equal(r1.cuerpo.actual.entrenador.nombre, `Luis ${marca}`);
    assert.equal(r1.cuerpo.actual.fecha_fin, null);
    assert.equal((await eventos('asignar', c.id_cliente))[0].id_usuario, recepcion.id_usuario);

    const r2 = await api('PUT', `/clientes/${c.id_cliente}/entrenador`, admin.token, { id_entrenador: eva.id_usuario });
    assert.equal(r2.status, 200);
    assert.equal(r2.cuerpo.actual.entrenador.id_usuario, eva.id_usuario);
    assert.equal(r2.cuerpo.historial.length, 2);
    assert.equal(r2.cuerpo.historial[1].estado, 'finalizada');
    assert.ok(r2.cuerpo.historial[1].fecha_fin);
    assert.equal(await activas(c.id_cliente), 1);
    assert.equal((await eventos('cambiar', c.id_cliente)).length, 1);

    const r3 = await api('PUT', `/clientes/${c.id_cliente}/entrenador`, admin.token, { id_entrenador: null });
    assert.equal(r3.status, 200);
    assert.equal(r3.cuerpo.actual, null);
    assert.equal(r3.cuerpo.historial.length, 2);
    assert.ok(r3.cuerpo.historial.every((h) => h.estado === 'finalizada'));
    assert.equal((await eventos('quitar', c.id_cliente)).length, 1);

    const otraVez = await api('PUT', `/clientes/${c.id_cliente}/entrenador`, admin.token, { id_entrenador: null });
    assert.equal(otraVez.status, 409);
  });

  it('rechazos: cliente inactivo o inexistente, entrenador inactivo, otro rol o el mismo entrenador', async () => {
    const baja = await nuevoCliente('Baja', 'inactivo');
    assert.equal((await api('PUT', `/clientes/${baja.id_cliente}/entrenador`, recepcion.token, { id_entrenador: luis.id_usuario })).status, 409);
    assert.equal((await api('PUT', '/clientes/999999999/entrenador', recepcion.token, { id_entrenador: luis.id_usuario })).status, 404);

    const c = await nuevoCliente('Rechazos');
    const r1 = await api('PUT', `/clientes/${c.id_cliente}/entrenador`, recepcion.token, { id_entrenador: inactivo.id_usuario });
    assert.equal(r1.status, 409);
    assert.equal(r1.cuerpo.error.details[0].field, 'id_entrenador');
    assert.equal((await api('PUT', `/clientes/${c.id_cliente}/entrenador`, recepcion.token, { id_entrenador: recepcion.id_usuario })).status, 409);
    assert.equal((await api('PUT', `/clientes/${c.id_cliente}/entrenador`, recepcion.token, { id_entrenador: 999999999 })).status, 409);
    assert.equal((await api('PUT', `/clientes/${c.id_cliente}/entrenador`, recepcion.token, { id_entrenador: 'x' })).status, 400);

    await api('PUT', `/clientes/${c.id_cliente}/entrenador`, recepcion.token, { id_entrenador: luis.id_usuario });
    assert.equal((await api('PUT', `/clientes/${c.id_cliente}/entrenador`, recepcion.token, { id_entrenador: luis.id_usuario })).status, 409);
    assert.equal(await activas(c.id_cliente), 1);
    const [errores] = await pool.execute(
      "SELECT id_usuario FROM auditoria WHERE modulo = 'asignaciones' AND resultado = 'error' AND descripcion = ?",
      [`Asignación rechazada para el cliente ${c.id_cliente}.`],
    );
    assert.ok(errores.length >= 1, 'los rechazos dejan evento de error');
  });

  it('peticiones simultáneas: queda una sola asignación activa (SC-005)', async () => {
    const c = await nuevoCliente('Carrera');
    const respuestas = await Promise.all([
      api('PUT', `/clientes/${c.id_cliente}/entrenador`, admin.token, { id_entrenador: luis.id_usuario }),
      api('PUT', `/clientes/${c.id_cliente}/entrenador`, recepcion.token, { id_entrenador: eva.id_usuario }),
      api('PUT', `/clientes/${c.id_cliente}/entrenador`, admin.token, { id_entrenador: luis.id_usuario }),
    ]);
    assert.ok(respuestas.every((r) => [200, 409].includes(r.status)), respuestas.map((r) => r.status).join(','));
    assert.equal(await activas(c.id_cliente), 1);
  });

  it('mis clientes del entrenador = sus asignaciones activas de clientes activos; el Inicio los cuenta', async () => {
    const a = await nuevoCliente('Alfa');
    const b = await nuevoCliente('Beta');
    const otro = await nuevoCliente('Otro');
    for (const c of [a, b]) await api('PUT', `/clientes/${c.id_cliente}/entrenador`, admin.token, { id_entrenador: luis.id_usuario });
    await api('PUT', `/clientes/${otro.id_cliente}/entrenador`, admin.token, { id_entrenador: eva.id_usuario });

    const mios = await api('GET', `/entrenamiento/mis-clientes?q=${encodeURIComponent(marca)}`, luis.token);
    assert.equal(mios.status, 200);
    const ids = mios.cuerpo.data.map((c) => c.id_cliente);
    assert.ok(ids.includes(a.id_cliente) && ids.includes(b.id_cliente));
    assert.ok(!ids.includes(otro.id_cliente));
    assert.deepEqual(Object.keys(mios.cuerpo.data[0]).sort(), ['apellido', 'desde', 'estado', 'id_cliente', 'nombre']);

    const detalle = await api('GET', `/entrenadores/${luis.id_usuario}`, recepcion.token);
    const todos = await api('GET', '/entrenamiento/mis-clientes?limit=100', luis.token);
    assert.equal(detalle.cuerpo.clientes.filter((c) => c.estado === 'activo').length, todos.cuerpo.total);

    // Un cliente dado de baja deja de aparecer en "Mis clientes".
    await pool.execute("UPDATE clientes SET estado = 'inactivo' WHERE id_cliente = ?", [b.id_cliente]);
    const despues = await api('GET', `/entrenamiento/mis-clientes?q=${encodeURIComponent(marca)}`, luis.token);
    assert.ok(!despues.cuerpo.data.some((c) => c.id_cliente === b.id_cliente));

    const resumen = await api('GET', '/resumen', luis.token);
    const todosDespues = await api('GET', '/entrenamiento/mis-clientes?limit=100', luis.token);
    assert.equal(resumen.cuerpo.mis_clientes.total, todosDespues.cuerpo.total);
    assert.ok(resumen.cuerpo.mis_clientes.lista.length <= 8);
    for (const fila of resumen.cuerpo.mis_clientes.lista) {
      assert.deepEqual(Object.keys(fila).sort(), ['apellido', 'estado', 'id_cliente', 'nombre']);
    }
  });

  it('permisos: entrenador y cliente no asignan ni consultan asignaciones; el personal no usa "Mis clientes"', async () => {
    const c = await nuevoCliente('Permisos');
    assert.equal((await api('PUT', `/clientes/${c.id_cliente}/entrenador`, luis.token, { id_entrenador: luis.id_usuario })).status, 403);
    assert.equal((await api('GET', `/clientes/${c.id_cliente}/entrenador`, luis.token)).status, 403);
    const cuenta = await api('POST', '/usuarios', admin.token, { nombre: 'Cuenta', correo: c.correo, password: 'Secreta123', rol: 'cliente', id_cliente: c.id_cliente });
    usuarios.push(cuenta.cuerpo.id_usuario);
    const tokenCliente = crearToken(cuenta.cuerpo.id_usuario);
    assert.equal((await api('PUT', `/clientes/${c.id_cliente}/entrenador`, tokenCliente, { id_entrenador: luis.id_usuario })).status, 403);
    assert.equal((await api('GET', '/entrenamiento/mis-clientes', tokenCliente)).status, 403);
    assert.equal((await api('GET', '/entrenamiento/mis-clientes', recepcion.token)).status, 403);
    assert.equal((await solicitar(servidor.url, 'GET', `/clientes/${c.id_cliente}/entrenador`)).status, 401);
  });
});
