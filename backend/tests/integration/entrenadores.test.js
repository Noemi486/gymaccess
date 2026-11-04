import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/config/db.js';
import {
  iniciarServidor,
  solicitar,
  crearToken,
  crearUsuarioConRol,
  crearUsuarioDePrueba,
  crearClienteDePrueba,
  crearEntrenadorDePrueba,
  asignarEntrenadorDePrueba,
  correoUnico,
  limpiarDatosDePrueba,
  cerrarPool,
} from '../helpers.js';

// Entrenadores (spec 004, US1, FR-001 a FR-004, FR-029) sobre gymaccess_test.

describe('/entrenadores', () => {
  let servidor;
  let admin;
  let recepcion;
  let entrenadorSesion;
  const usuarios = [];
  const clientes = [];
  const marca = `Ent${process.pid}${Date.now() % 100000}`;

  const api = (metodo, ruta, token, cuerpo) => solicitar(servidor.url, metodo, ruta, { token, cuerpo });
  const alta = (extra = {}) => ({ nombre: `Coach ${marca}`, correo: correoUnico('test'), password: 'Secreta123', telefono: '555 123 4567', especialidad: 'Fuerza', ...extra });
  const eventos = async (accion, id) => {
    const [filas] = await pool.execute(
      "SELECT id_usuario, resultado, descripcion FROM auditoria WHERE modulo = 'entrenadores' AND accion = ? AND descripcion LIKE ?",
      [accion, `%Entrenador ${id} %`],
    );
    return filas;
  };

  before(async () => {
    servidor = await iniciarServidor();
    admin = await crearUsuarioConRol('administrador');
    recepcion = await crearUsuarioConRol('recepcionista');
    entrenadorSesion = await crearEntrenadorDePrueba({ nombre: `Sesion ${marca}` });
    usuarios.push(admin.id_usuario, recepcion.id_usuario, entrenadorSesion.id_usuario);
  });

  after(async () => {
    try {
      await limpiarDatosDePrueba({ usuarios, clientes });
    } finally {
      await servidor.cerrar();
      await cerrarPool();
    }
  });

  it('alta: crea cuenta con rol entrenador y ficha; puede iniciar sesión; queda auditado', async () => {
    const datos = alta();
    const r = await api('POST', '/entrenadores', admin.token, datos);
    assert.equal(r.status, 201);
    usuarios.push(r.cuerpo.id_usuario);
    assert.equal(r.cuerpo.correo, datos.correo);
    assert.equal(r.cuerpo.especialidad, 'Fuerza');
    assert.equal(r.cuerpo.telefono, '555 123 4567');
    assert.equal(r.cuerpo.tiene_ficha, true);
    assert.equal(r.cuerpo.clientes_asignados, 0);
    assert.deepEqual(r.cuerpo.clientes, []);
    assert.ok(!('password' in r.cuerpo));

    const login = await api('POST', '/auth/login', undefined, { correo: datos.correo, password: datos.password });
    assert.equal(login.status, 200);
    assert.equal(login.cuerpo.usuario.rol, 'entrenador');

    const ev = await eventos('crear', r.cuerpo.id_usuario);
    assert.equal(ev.length, 1);
    assert.equal(ev[0].id_usuario, admin.id_usuario);
  });

  it('correo repetido: 409 en el campo y no se crea ni cuenta ni ficha', async () => {
    const r = await api('POST', '/entrenadores', admin.token, alta({ correo: recepcion.correo }));
    assert.equal(r.status, 409);
    assert.equal(r.cuerpo.error.details[0].field, 'correo');
    const [fichas] = await pool.execute('SELECT COUNT(*) AS n FROM entrenadores WHERE id_usuario = ?', [recepcion.id_usuario]);
    assert.equal(Number(fichas[0].n), 0);
  });

  it('validación: contraseña débil y teléfono inválido', async () => {
    const r = await api('POST', '/entrenadores', admin.token, alta({ password: 'corta', telefono: 'abc' }));
    assert.equal(r.status, 400);
    const campos = r.cuerpo.error.details.map((d) => d.field).sort();
    assert.deepEqual(campos, ['password', 'telefono']);
  });

  it('edición: nombre, teléfono y especialidad; una cuenta sin ficha aparece y se completa', async () => {
    const sinFicha = await crearUsuarioDePrueba({ rol: 'entrenador', nombre: `Antiguo ${marca}` });
    usuarios.push(sinFicha.id_usuario);
    const lista = await api('GET', `/entrenadores?q=${encodeURIComponent(`Antiguo ${marca}`)}`, recepcion.token);
    assert.equal(lista.status, 200);
    assert.equal(lista.cuerpo.total, 1);
    assert.equal(lista.cuerpo.data[0].tiene_ficha, false);

    const r = await api('PATCH', `/entrenadores/${sinFicha.id_usuario}`, admin.token, { especialidad: 'Yoga', nombre: `Renombrado ${marca}` });
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.tiene_ficha, true);
    assert.equal(r.cuerpo.especialidad, 'Yoga');
    assert.equal(r.cuerpo.telefono, null);
    assert.equal(r.cuerpo.nombre, `Renombrado ${marca}`);

    const r2 = await api('PATCH', `/entrenadores/${sinFicha.id_usuario}`, admin.token, { telefono: '5559998888' });
    assert.equal(r2.cuerpo.telefono, '5559998888');
    assert.equal(r2.cuerpo.especialidad, 'Yoga', 'no borra lo no enviado');
    assert.equal((await eventos('modificar', sinFicha.id_usuario)).length, 2);
  });

  it('un usuario que no es entrenador no existe como entrenador (404)', async () => {
    assert.equal((await api('GET', `/entrenadores/${recepcion.id_usuario}`, admin.token)).status, 404);
    assert.equal((await api('PATCH', `/entrenadores/${recepcion.id_usuario}`, admin.token, { especialidad: 'X' })).status, 404);
  });

  it('desactivar: con clientes asignados 409 (también desde Usuarios y roles); sin clientes se desactiva y reactiva', async () => {
    const e = await crearEntrenadorDePrueba({ nombre: `ConClientes ${marca}` });
    usuarios.push(e.id_usuario);
    const c1 = await crearClienteDePrueba({ apellido: `${marca}Uno` });
    const c2 = await crearClienteDePrueba({ apellido: `${marca}Dos` });
    clientes.push(c1.id_cliente, c2.id_cliente);
    await asignarEntrenadorDePrueba(c1.id_cliente, e.id_usuario);
    await asignarEntrenadorDePrueba(c2.id_cliente, e.id_usuario);

    const detalle = await api('GET', `/entrenadores/${e.id_usuario}`, recepcion.token);
    assert.equal(detalle.cuerpo.clientes_asignados, 2);
    assert.deepEqual(detalle.cuerpo.clientes.map((c) => c.id_cliente).sort(), [c1.id_cliente, c2.id_cliente].sort());
    assert.deepEqual(Object.keys(detalle.cuerpo.clientes[0]).sort(), ['apellido', 'desde', 'estado', 'id_cliente', 'nombre']);

    const r = await api('PATCH', `/entrenadores/${e.id_usuario}/estado`, admin.token, { estado: 'inactivo' });
    assert.equal(r.status, 409);
    assert.match(r.cuerpo.error.message, /a sus 2 clientes/);
    const desdeUsuarios = await api('PATCH', `/usuarios/${e.id_usuario}`, admin.token, { estado: 'inactivo' });
    assert.equal(desdeUsuarios.status, 409);
    const cambioRol = await api('PATCH', `/usuarios/${e.id_usuario}`, admin.token, { rol: 'recepcionista' });
    assert.equal(cambioRol.status, 409);
    assert.ok((await eventos('desactivar', e.id_usuario)).some((f) => f.resultado === 'error'));

    const libre = await crearEntrenadorDePrueba({ nombre: `Libre ${marca}` });
    usuarios.push(libre.id_usuario);
    const baja = await api('PATCH', `/entrenadores/${libre.id_usuario}/estado`, admin.token, { estado: 'inactivo' });
    assert.equal(baja.status, 200);
    assert.equal(baja.cuerpo.estado, 'inactivo');
    const login = await api('POST', '/auth/login', undefined, { correo: libre.correo, password: libre.password });
    assert.notEqual(login.status, 200, 'la cuenta inactiva ya no inicia sesión');
    const alta2 = await api('PATCH', `/entrenadores/${libre.id_usuario}/estado`, admin.token, { estado: 'activo' });
    assert.equal(alta2.cuerpo.estado, 'activo');
    assert.equal((await eventos('activar', libre.id_usuario)).length, 1);
  });

  it('lista: filtros por estado y búsqueda, con número de clientes y paginación', async () => {
    const r = await api('GET', `/entrenadores?q=${encodeURIComponent(marca)}&estado=activo&limit=2`, admin.token);
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.limit, 2);
    assert.ok(r.cuerpo.data.length <= 2);
    assert.ok(r.cuerpo.total >= 3);
    for (const fila of r.cuerpo.data) {
      assert.equal(fila.estado, 'activo');
      assert.equal(typeof fila.clientes_asignados, 'number');
      assert.ok(!('password' in fila));
    }
  });

  it('permisos: recepcionista solo consulta; entrenador y cliente 403; sin sesión 401', async () => {
    assert.equal((await api('POST', '/entrenadores', recepcion.token, alta())).status, 403);
    assert.equal((await api('PATCH', `/entrenadores/${entrenadorSesion.id_usuario}`, recepcion.token, { especialidad: 'X' })).status, 403);
    assert.equal((await api('PATCH', `/entrenadores/${entrenadorSesion.id_usuario}/estado`, recepcion.token, { estado: 'inactivo' })).status, 403);
    assert.equal((await api('GET', '/entrenadores', entrenadorSesion.token)).status, 403);
    assert.equal((await api('GET', `/entrenadores/${entrenadorSesion.id_usuario}`, entrenadorSesion.token)).status, 403);

    const c = await crearClienteDePrueba({ apellido: `${marca}Cli` });
    clientes.push(c.id_cliente);
    const cuenta = await api('POST', '/usuarios', admin.token, { nombre: 'Cuenta', correo: c.correo, password: 'Secreta123', rol: 'cliente', id_cliente: c.id_cliente });
    usuarios.push(cuenta.cuerpo.id_usuario);
    assert.equal((await api('GET', '/entrenadores', crearToken(cuenta.cuerpo.id_usuario))).status, 403);
    assert.equal((await solicitar(servidor.url, 'GET', '/entrenadores')).status, 401);
  });
});
