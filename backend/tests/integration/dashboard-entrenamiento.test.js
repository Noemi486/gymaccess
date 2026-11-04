import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/config/db.js';
import { entrenamiento } from '../../src/models/dashboard.model.js';
import {
  iniciarServidor,
  solicitar,
  crearUsuarioConRol,
  crearClienteDePrueba,
  crearEntrenadorDePrueba,
  asignarEntrenadorDePrueba,
  fechaRelativa,
  limpiarDatosDePrueba,
  cerrarPool,
} from '../helpers.js';

// Sección "Entrenamiento" del Dashboard (spec 004, US6, FR-021 a FR-023, SC-008) sobre gymaccess_test.
// Las cifras exactas se comprueban con el modelo filtrado a los entrenadores de la prueba; las globales,
// con relaciones que deben cumplirse siempre (con + sin entrenador = clientes activos).

describe('Dashboard: entrenamiento', () => {
  let servidor;
  let admin;
  let recepcion;
  let luis;
  let eva;
  let inactivo;
  const usuarios = [];
  const clientes = [];
  const marca = `DEn${process.pid}${Date.now() % 100000}`;

  const api = (ruta, token) => solicitar(servidor.url, 'GET', ruta, { token });
  const post = (ruta, token, cuerpo) => solicitar(servidor.url, 'POST', ruta, { token, cuerpo });
  const patch = (ruta, token, cuerpo) => solicitar(servidor.url, 'PATCH', ruta, { token, cuerpo });
  const nuevo = async (sufijo, estado = 'activo') => {
    const c = await crearClienteDePrueba({ nombre: sufijo, apellido: marca, estado });
    clientes.push(c.id_cliente);
    await pool.execute('UPDATE clientes SET fecha_registro = DATE_SUB(NOW(), INTERVAL 90 DAY) WHERE id_cliente = ?', [c.id_cliente]);
    return c;
  };
  const rutina = { nombre: 'R', dias: [{ dia: 1, ejercicios: [{ nombre: 'Sentadilla', series: 3 }] }] };

  before(async () => {
    servidor = await iniciarServidor();
    admin = await crearUsuarioConRol('administrador');
    recepcion = await crearUsuarioConRol('recepcionista');
    luis = await crearEntrenadorDePrueba({ nombre: `Luis ${marca}` });
    eva = await crearEntrenadorDePrueba({ nombre: `Eva ${marca}` });
    inactivo = await crearEntrenadorDePrueba({ nombre: `Inactivo ${marca}`, estado: 'inactivo' });
    usuarios.push(admin.id_usuario, recepcion.id_usuario, luis.id_usuario, eva.id_usuario, inactivo.id_usuario);

    // Luis: 3 clientes activos (uno con rutina y avance reciente, otro con avance viejo), 1 dado de baja.
    const [a, b, c, baja] = [await nuevo('A'), await nuevo('B'), await nuevo('C'), await nuevo('Baja')];
    for (const x of [a, b, c, baja]) await asignarEntrenadorDePrueba(x.id_cliente, luis.id_usuario);
    await pool.execute("UPDATE clientes SET estado = 'inactivo' WHERE id_cliente = ?", [baja.id_cliente]);
    await post(`/clientes/${a.id_cliente}/rutinas`, luis.token, rutina);
    await post(`/clientes/${b.id_cliente}/rutinas`, luis.token, rutina);
    await post(`/clientes/${a.id_cliente}/progresos`, luis.token, { fecha: await fechaRelativa(-5), peso_kg: 80 });
    await post(`/clientes/${b.id_cliente}/progresos`, luis.token, { fecha: await fechaRelativa(-40), peso_kg: 70 });
    const o1 = await post(`/clientes/${a.id_cliente}/objetivos`, luis.token, { descripcion: 'Uno' });
    await post(`/clientes/${b.id_cliente}/objetivos`, luis.token, { descripcion: 'Dos' });
    await patch(`/objetivos/${o1.cuerpo.id_objetivo}`, luis.token, { estado: 'cumplido' });

    // Eva: 1 cliente sin nada.
    const d = await nuevo('D');
    await asignarEntrenadorDePrueba(d.id_cliente, eva.id_usuario);
  });

  after(async () => {
    try {
      await limpiarDatosDePrueba({ usuarios, clientes });
    } finally {
      await servidor.cerrar();
      await cerrarPool();
    }
  });

  it('cifras exactas para los entrenadores de la prueba (SC-008)', async () => {
    const hoy = await fechaRelativa(0);
    const e = await entrenamiento({ desde: hoy, hasta: hoy, soloEntrenadores: [luis.id_usuario, eva.id_usuario, inactivo.id_usuario] });
    assert.equal(e.entrenadores_activos, 2);
    assert.equal(e.clientes_con_entrenador, 4, '3 de Luis (sin el dado de baja) + 1 de Eva');
    assert.equal(e.rutinas_activas, 2);
    assert.equal(e.objetivos_en_curso, 1);
    assert.equal(e.objetivos_cumplidos_periodo, 1);
    assert.equal(e.con_avance_30_dias, 1, 'el avance de hace 40 días no cuenta');
    assert.deepEqual(
      e.carga.map((f) => [f.nombre, f.clientes_asignados, f.rutinas_activas, f.avances_periodo]),
      [[`Luis ${marca}`, 3, 2, 2], [`Eva ${marca}`, 1, 0, 0]],
      'ordenada por clientes; sin el entrenador inactivo; avances registrados hoy',
    );

    const ayer = await fechaRelativa(-1);
    const pasado = await entrenamiento({ desde: ayer, hasta: ayer, soloEntrenadores: [luis.id_usuario, eva.id_usuario] });
    assert.equal(pasado.objetivos_cumplidos_periodo, 0, 'el periodo solo cambia lo del periodo');
    assert.equal(pasado.carga[0].avances_periodo, 0);
    assert.equal(pasado.clientes_con_entrenador, 4, 'el estado actual no depende del periodo');
  });

  it('GET /dashboard incluye la sección con relaciones consistentes y porcentaje', async () => {
    const { status, cuerpo } = await api('/dashboard', admin.token);
    assert.equal(status, 200);
    const e = cuerpo.entrenamiento;
    assert.deepEqual(
      Object.keys(e).sort(),
      ['carga', 'clientes_con_entrenador', 'clientes_sin_entrenador', 'con_avance_30_dias', 'entrenadores_activos', 'objetivos_cumplidos_periodo', 'objetivos_en_curso', 'porcentaje_con_avance', 'rutinas_activas'],
    );
    assert.equal(e.clientes_con_entrenador + e.clientes_sin_entrenador, cuerpo.estado_actual.clientes_activos);
    assert.ok(e.con_avance_30_dias <= e.clientes_con_entrenador);
    assert.ok(e.porcentaje_con_avance >= 0 && e.porcentaje_con_avance <= 100);
    const filaLuis = e.carga.find((f) => f.id_usuario === luis.id_usuario);
    assert.deepEqual(Object.keys(filaLuis).sort(), ['avances_periodo', 'clientes_asignados', 'id_usuario', 'nombre', 'rutinas_activas']);
    assert.equal(filaLuis.clientes_asignados, 3);
    assert.ok(!e.carga.some((f) => f.id_usuario === inactivo.id_usuario));
    const texto = JSON.stringify(e);
    assert.ok(!/telefono|correo|peso|grasa|cintura/i.test(texto), 'sin datos personales ni medidas');
  });

  it('la lista de origen coincide: clientes asignados del detalle del entrenador', async () => {
    const { cuerpo } = await api('/dashboard', admin.token);
    const detalle = await api(`/entrenadores/${luis.id_usuario}`, admin.token);
    const activos = detalle.cuerpo.clientes.filter((c) => c.estado === 'activo').length;
    assert.equal(cuerpo.entrenamiento.carga.find((f) => f.id_usuario === luis.id_usuario).clientes_asignados, activos);
  });

  it('solo administrador', async () => {
    assert.equal((await api('/dashboard', recepcion.token)).status, 403);
    assert.equal((await api('/dashboard', luis.token)).status, 403);
  });
});
