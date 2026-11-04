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
  fechaRelativa,
  limpiarDatosDePrueba,
  cerrarPool,
  sinBiometria,
} from '../helpers.js';

// "Mi entrenamiento" del cliente (spec 004, US5, FR-019, SC-007) sobre gymaccess_test.

describe('GET /clientes/me/entrenamiento', () => {
  let servidor;
  let admin;
  let luis;
  let ana;
  let beto;
  let tokenAna;
  let tokenBeto;
  const usuarios = [];
  const clientes = [];
  const marca = `MiE${process.pid}${Date.now() % 100000}`;

  const api = (metodo, ruta, token, cuerpo) => solicitar(servidor.url, metodo, ruta, { token, cuerpo });
  const cuenta = async (c) => {
    const r = await api('POST', '/usuarios', admin.token, { nombre: `Cuenta ${c.nombre}`, correo: c.correo, password: 'Secreta123', rol: 'cliente', id_cliente: c.id_cliente });
    usuarios.push(r.cuerpo.id_usuario);
    return crearToken(r.cuerpo.id_usuario);
  };

  before(async () => {
    servidor = await iniciarServidor();
    admin = await crearUsuarioConRol('administrador');
    luis = await crearEntrenadorDePrueba({ nombre: `Luis ${marca}` });
    usuarios.push(admin.id_usuario, luis.id_usuario);
    ana = await crearClienteDePrueba({ nombre: 'Ana', apellido: marca });
    beto = await crearClienteDePrueba({ nombre: 'Beto', apellido: marca });
    clientes.push(ana.id_cliente, beto.id_cliente);
    await pool.execute('UPDATE clientes SET fecha_registro = DATE_SUB(NOW(), INTERVAL 30 DAY) WHERE id_cliente = ?', [ana.id_cliente]);
    tokenAna = await cuenta(ana);
    tokenBeto = await cuenta(beto);

    await asignarEntrenadorDePrueba(ana.id_cliente, luis.id_usuario);
    await api('POST', `/clientes/${ana.id_cliente}/rutinas`, luis.token, { nombre: 'Fuerza A', dias: [{ dia: 1, ejercicios: [{ nombre: 'Sentadilla', series: 4, repeticiones: '10' }] }] });
    await api('POST', `/clientes/${ana.id_cliente}/objetivos`, luis.token, { descripcion: 'Bajar 3 kg' });
    await api('POST', `/clientes/${ana.id_cliente}/progresos`, luis.token, { fecha: await fechaRelativa(-10), peso_kg: 80 });
    await api('POST', `/clientes/${ana.id_cliente}/progresos`, luis.token, { fecha: await fechaRelativa(0), peso_kg: 79 });
  });

  after(async () => {
    try {
      await limpiarDatosDePrueba({ usuarios, clientes });
    } finally {
      await servidor.cerrar();
      await cerrarPool();
    }
  });

  it('Ana ve su entrenador por nombre, su rutina por día, sus objetivos y su progreso con diferencias', async () => {
    const inicio = performance.now();
    const { status, cuerpo } = await api('GET', '/clientes/me/entrenamiento', tokenAna);
    assert.ok(performance.now() - inicio < 2000, 'menos de 2 s (SC-007)');
    assert.equal(status, 200);
    assert.deepEqual(Object.keys(cuerpo).sort(), ['entrenador', 'objetivos', 'progresos', 'rutina_activa']);
    assert.deepEqual(Object.keys(cuerpo.entrenador).sort(), ['desde', 'nombre']);
    assert.equal(cuerpo.entrenador.nombre, `Luis ${marca}`);
    assert.equal(cuerpo.rutina_activa.nombre, 'Fuerza A');
    assert.deepEqual(cuerpo.rutina_activa.entrenador, { nombre: `Luis ${marca}` });
    assert.equal(cuerpo.rutina_activa.dias[0].ejercicios[0].nombre, 'Sentadilla');
    assert.equal(cuerpo.objetivos[0].descripcion, 'Bajar 3 kg');
    assert.equal(cuerpo.progresos.length, 2);
    assert.equal(cuerpo.progresos[0].diferencias.peso_kg, -1);
    assert.ok(cuerpo.progresos.every((p) => p.puede_corregir === false));
    const texto = JSON.stringify(cuerpo);
    assert.ok(!texto.includes(luis.correo), 'sin correo del entrenador');
    assert.ok(!texto.includes('5550001111'), 'sin teléfono del entrenador');
    sinBiometria(cuerpo);
  });

  it('Beto, sin entrenador ni registros, recibe estados vacíos y nada de Ana', async () => {
    const { cuerpo } = await api('GET', '/clientes/me/entrenamiento', tokenBeto);
    assert.deepEqual(cuerpo, { entrenador: null, rutina_activa: null, objetivos: [], progresos: [] });
  });

  it('el cliente no puede consultar ni registrar el entrenamiento por id (ni el suyo)', async () => {
    assert.equal((await api('GET', `/clientes/${ana.id_cliente}/entrenamiento`, tokenAna)).status, 403);
    assert.equal((await api('POST', `/clientes/${ana.id_cliente}/progresos`, tokenAna, { fecha: await fechaRelativa(0), peso_kg: 70 })).status, 403);
    assert.equal((await api('POST', `/clientes/${ana.id_cliente}/rutinas`, tokenAna, { nombre: 'X', dias: [{ dia: 1, ejercicios: [{ nombre: 'X', series: 1 }] }] })).status, 403);
  });

  it('solo el rol cliente: el personal recibe 403 y sin sesión 401', async () => {
    for (const token of [admin.token, luis.token]) assert.equal((await api('GET', '/clientes/me/entrenamiento', token)).status, 403);
    assert.equal((await solicitar(servidor.url, 'GET', '/clientes/me/entrenamiento')).status, 401);
  });
});
