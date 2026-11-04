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
  asignarEntrenadorDePrueba,
  limpiarDatosDePrueba,
  cerrarPool,
  sinBiometria,
} from '../helpers.js';

// Rutinas versionadas (spec 004, US3, FR-009 a FR-011, FR-016 a FR-018, SC-004 a SC-006) sobre gymaccess_test.

const rutina = (nombre = 'Fuerza A', extra = {}) => ({
  nombre,
  indicaciones: 'Calentar 10 minutos.',
  dias: [
    { dia: 1, ejercicios: [{ nombre: 'Sentadilla', series: 4, repeticiones: '10-12', peso_kg: 40, descanso_seg: 90 }, { nombre: 'Plancha', instrucciones: '3 x 30 s' }] },
    { dia: 3, ejercicios: [{ nombre: 'Press de banca', series: 3, repeticiones: '8' }] },
  ],
  ...extra,
});

describe('Rutinas', () => {
  let servidor;
  let admin;
  let recepcion;
  let luis;
  let eva;
  let cliente;
  const usuarios = [];
  const clientes = [];
  const marca = `Rut${process.pid}${Date.now() % 100000}`;

  const api = (metodo, ruta, token, cuerpo) => solicitar(servidor.url, metodo, ruta, { token, cuerpo });
  const nuevoCliente = async (sufijo, estado = 'activo') => {
    const c = await crearClienteDePrueba({ nombre: sufijo, apellido: `${marca}${sufijo}`, estado });
    clientes.push(c.id_cliente);
    return c;
  };

  before(async () => {
    servidor = await iniciarServidor();
    admin = await crearUsuarioConRol('administrador');
    recepcion = await crearUsuarioConRol('recepcionista');
    luis = await crearEntrenadorDePrueba({ nombre: `Luis ${marca}` });
    eva = await crearEntrenadorDePrueba({ nombre: `Eva ${marca}` });
    usuarios.push(admin.id_usuario, recepcion.id_usuario, luis.id_usuario, eva.id_usuario);
    cliente = await nuevoCliente('Ana');
    await asignarEntrenadorDePrueba(cliente.id_cliente, luis.id_usuario);
  });

  after(async () => {
    try {
      await limpiarDatosDePrueba({ usuarios, clientes });
    } finally {
      await servidor.cerrar();
      await cerrarPool();
    }
  });

  it('sin rutina: el entrenamiento muestra el entrenador, rutina vacía y que puede editar', async () => {
    const r = await api('GET', `/clientes/${cliente.id_cliente}/entrenamiento`, luis.token);
    assert.equal(r.status, 200);
    assert.deepEqual(r.cuerpo.cliente, { id_cliente: cliente.id_cliente, nombre: 'Ana', apellido: `${marca}Ana`, estado: 'activo' });
    assert.equal(r.cuerpo.entrenador.id_usuario, luis.id_usuario);
    assert.equal(r.cuerpo.rutina_activa, null);
    assert.deepEqual(r.cuerpo.rutinas, []);
    assert.equal(r.cuerpo.puede_editar, true);
    assert.ok(!JSON.stringify(r.cuerpo).includes(cliente.telefono), 'sin datos de contacto');
  });

  it('crear y versionar N veces deja N+1 versiones; las archivadas conservan sus ejercicios (SC-006)', async () => {
    const primera = await api('POST', `/clientes/${cliente.id_cliente}/rutinas`, luis.token, rutina('Fuerza A'));
    assert.equal(primera.status, 201);
    assert.equal(primera.cuerpo.estado, 'activa');
    assert.equal(primera.cuerpo.entrenador.id_usuario, luis.id_usuario);
    assert.deepEqual(primera.cuerpo.dias.map((d) => d.dia), [1, 3]);
    assert.deepEqual(primera.cuerpo.dias[0].ejercicios[0], { nombre: 'Sentadilla', series: 4, repeticiones: '10-12', peso_kg: 40, descanso_seg: 90, instrucciones: null });
    assert.equal(primera.cuerpo.dias[0].ejercicios[1].instrucciones, '3 x 30 s');

    const N = 3;
    let ultima = primera;
    for (let i = 1; i <= N; i += 1) {
      ultima = await api('POST', `/clientes/${cliente.id_cliente}/rutinas`, luis.token, rutina(`Fuerza v${i + 1}`, { dias: [{ dia: 2, ejercicios: [{ nombre: `Remo ${i}`, series: i }] }] }));
      assert.equal(ultima.status, 201);
    }
    const e = await api('GET', `/clientes/${cliente.id_cliente}/entrenamiento`, luis.token);
    assert.equal(e.cuerpo.rutinas.length, N + 1);
    assert.equal(e.cuerpo.rutinas.filter((r) => r.estado === 'activa').length, 1);
    assert.equal(e.cuerpo.rutina_activa.id_rutina, ultima.cuerpo.id_rutina);
    assert.equal(e.cuerpo.rutina_activa.nombre, 'Fuerza v4');
    const archivada = e.cuerpo.rutinas.at(-1);
    assert.equal(archivada.estado, 'archivada');
    assert.ok(archivada.fecha_archivo);
    assert.equal(archivada.ejercicios, 3);
    assert.equal(archivada.dias, 2);

    const original = await api('GET', `/rutinas/${primera.cuerpo.id_rutina}`, luis.token);
    assert.equal(original.status, 200);
    assert.deepEqual(original.cuerpo.dias, primera.cuerpo.dias, 'la versión archivada no cambió');
    const [[fila]] = await pool.execute('SELECT id_rutina_anterior FROM rutinas WHERE id_rutina = ?', [ultima.cuerpo.id_rutina]);
    assert.ok(fila.id_rutina_anterior);

    const [eventos] = await pool.execute("SELECT accion FROM auditoria WHERE modulo = 'rutinas' AND resultado = 'exito' AND descripcion LIKE ?", [`%cliente ${cliente.id_cliente}%`]);
    assert.equal(eventos.filter((ev) => ev.accion === 'crear').length, 1);
    assert.equal(eventos.filter((ev) => ev.accion === 'versionar').length, N);
  });

  it('validación: ejercicio sin detalle y sin ejercicios', async () => {
    const r = await api('POST', `/clientes/${cliente.id_cliente}/rutinas`, luis.token, rutina('X', { dias: [{ dia: 1, ejercicios: [{ nombre: 'Trote' }] }] }));
    assert.equal(r.status, 400);
    assert.equal(r.cuerpo.error.details[0].field, 'dias.0.ejercicios.0.series');
    assert.equal((await api('POST', `/clientes/${cliente.id_cliente}/rutinas`, luis.token, rutina('X', { dias: [] }))).status, 400);
  });

  it('peticiones simultáneas: una sola rutina activa (SC-005)', async () => {
    const c = await nuevoCliente('Carrera');
    await asignarEntrenadorDePrueba(c.id_cliente, luis.id_usuario);
    const respuestas = await Promise.all([1, 2, 3].map((i) => api('POST', `/clientes/${c.id_cliente}/rutinas`, luis.token, rutina(`R${i}`))));
    assert.ok(respuestas.every((r) => [201, 409].includes(r.status)));
    const [[{ n }]] = await pool.execute("SELECT COUNT(*) AS n FROM rutinas WHERE id_cliente = ? AND estado = 'activa'", [c.id_cliente]);
    assert.equal(Number(n), 1);
  });

  it('entrenador no asignado o anterior: 403; cliente dado de baja: 409 al crear y consulta permitida', async () => {
    const otro = await nuevoCliente('Otro');
    await asignarEntrenadorDePrueba(otro.id_cliente, eva.id_usuario);
    assert.equal((await api('GET', `/clientes/${otro.id_cliente}/entrenamiento`, luis.token)).status, 403);
    assert.equal((await api('POST', `/clientes/${otro.id_cliente}/rutinas`, luis.token, rutina())).status, 403);

    // Luis deja de ser el entrenador de Ana: pierde el acceso; Eva ve todo el historial (FR-016).
    const c = await nuevoCliente('Cambio');
    await asignarEntrenadorDePrueba(c.id_cliente, luis.id_usuario);
    const hecha = await api('POST', `/clientes/${c.id_cliente}/rutinas`, luis.token, rutina());
    await api('PUT', `/clientes/${c.id_cliente}/entrenador`, admin.token, { id_entrenador: eva.id_usuario });
    assert.equal((await api('GET', `/clientes/${c.id_cliente}/entrenamiento`, luis.token)).status, 403);
    assert.equal((await api('GET', `/rutinas/${hecha.cuerpo.id_rutina}`, luis.token)).status, 403);
    const deEva = await api('GET', `/clientes/${c.id_cliente}/entrenamiento`, eva.token);
    assert.equal(deEva.status, 200);
    assert.equal(deEva.cuerpo.rutina_activa.entrenador.id_usuario, luis.id_usuario);

    await pool.execute("UPDATE clientes SET estado = 'inactivo' WHERE id_cliente = ?", [c.id_cliente]);
    assert.equal((await api('POST', `/clientes/${c.id_cliente}/rutinas`, eva.token, rutina())).status, 409);
    const consulta = await api('GET', `/clientes/${c.id_cliente}/entrenamiento`, eva.token);
    assert.equal(consulta.status, 200);
    assert.equal(consulta.cuerpo.puede_editar, false);
  });

  it('administrador solo consulta; recepcionista y cliente 403; inexistentes 404', async () => {
    const r = await api('GET', `/clientes/${cliente.id_cliente}/entrenamiento`, admin.token);
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.puede_editar, false);
    assert.equal((await api('POST', `/clientes/${cliente.id_cliente}/rutinas`, admin.token, rutina())).status, 403);
    assert.equal((await api('GET', `/clientes/${cliente.id_cliente}/entrenamiento`, recepcion.token)).status, 403);
    assert.equal((await api('GET', `/rutinas/${r.cuerpo.rutina_activa.id_rutina}`, recepcion.token)).status, 403);

    const cuenta = await api('POST', '/usuarios', admin.token, { nombre: 'Cuenta', correo: cliente.correo, password: 'Secreta123', rol: 'cliente', id_cliente: cliente.id_cliente });
    usuarios.push(cuenta.cuerpo.id_usuario);
    const tokenCliente = crearToken(cuenta.cuerpo.id_usuario);
    assert.equal((await api('GET', `/clientes/${cliente.id_cliente}/entrenamiento`, tokenCliente)).status, 403);
    assert.equal((await api('GET', `/rutinas/${r.cuerpo.rutina_activa.id_rutina}`, tokenCliente)).status, 403);

    assert.equal((await api('GET', '/clientes/999999999/entrenamiento', admin.token)).status, 404);
    assert.equal((await api('GET', '/rutinas/999999999', admin.token)).status, 404);
    sinBiometria(r.cuerpo);
  });
});
