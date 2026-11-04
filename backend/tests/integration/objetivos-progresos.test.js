import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/config/db.js';
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

// Objetivos y avances (spec 004, US4, FR-012 a FR-017, FR-029) sobre gymaccess_test.

describe('Objetivos y progreso', () => {
  let servidor;
  let admin;
  let recepcion;
  let luis;
  let eva;
  let cliente;
  const usuarios = [];
  const clientes = [];
  const marca = `Prg${process.pid}${Date.now() % 100000}`;

  const api = (metodo, ruta, token, cuerpo) => solicitar(servidor.url, metodo, ruta, { token, cuerpo });
  const eventos = async (modulo, accion, texto) =>
    (await pool.execute('SELECT resultado, descripcion FROM auditoria WHERE modulo = ? AND accion = ? AND descripcion LIKE ?', [modulo, accion, `%${texto}%`]))[0];

  before(async () => {
    servidor = await iniciarServidor();
    admin = await crearUsuarioConRol('administrador');
    recepcion = await crearUsuarioConRol('recepcionista');
    luis = await crearEntrenadorDePrueba({ nombre: `Luis ${marca}` });
    eva = await crearEntrenadorDePrueba({ nombre: `Eva ${marca}` });
    usuarios.push(admin.id_usuario, recepcion.id_usuario, luis.id_usuario, eva.id_usuario);
    cliente = await crearClienteDePrueba({ nombre: 'Ana', apellido: marca });
    clientes.push(cliente.id_cliente);
    // El cliente se registró hace 60 días para poder registrar avances en fechas anteriores.
    await pool.execute('UPDATE clientes SET fecha_registro = DATE_SUB(NOW(), INTERVAL 60 DAY) WHERE id_cliente = ?', [cliente.id_cliente]);
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

  describe('objetivos', () => {
    let idObjetivo;

    it('crear queda en curso; fecha límite pasada se rechaza', async () => {
      const r = await api('POST', `/clientes/${cliente.id_cliente}/objetivos`, luis.token, { descripcion: 'Bajar 5 kg', meta: '75 kg', fecha_limite: await fechaRelativa(60) });
      assert.equal(r.status, 201);
      assert.equal(r.cuerpo.estado, 'en_curso');
      assert.equal(r.cuerpo.meta, '75 kg');
      assert.equal(r.cuerpo.fecha_cierre, null);
      idObjetivo = r.cuerpo.id_objetivo;
      assert.equal((await eventos('objetivos', 'crear', `Objetivo ${idObjetivo} `)).length, 1);

      const pasada = await api('POST', `/clientes/${cliente.id_cliente}/objetivos`, luis.token, { descripcion: 'X', fecha_limite: await fechaRelativa(-1) });
      assert.equal(pasada.status, 400);
      assert.equal(pasada.cuerpo.error.details[0].field, 'fecha_limite');
    });

    it('editar en curso; cumplir lo cierra con fecha; un cerrado ya no cambia (409)', async () => {
      const e = await api('PATCH', `/objetivos/${idObjetivo}`, luis.token, { meta: '74 kg' });
      assert.equal(e.status, 200);
      assert.equal(e.cuerpo.meta, '74 kg');
      assert.equal(e.cuerpo.descripcion, 'Bajar 5 kg');

      const c = await api('PATCH', `/objetivos/${idObjetivo}`, luis.token, { estado: 'cumplido' });
      assert.equal(c.cuerpo.estado, 'cumplido');
      assert.ok(c.cuerpo.fecha_cierre);
      assert.equal((await api('PATCH', `/objetivos/${idObjetivo}`, luis.token, { meta: '70 kg' })).status, 409);
      assert.equal((await api('PATCH', `/objetivos/${idObjetivo}`, luis.token, { estado: 'cancelado' })).status, 409);

      const otro = await api('POST', `/clientes/${cliente.id_cliente}/objetivos`, luis.token, { descripcion: 'Correr 5 km' });
      const cancelado = await api('PATCH', `/objetivos/${otro.cuerpo.id_objetivo}`, luis.token, { estado: 'cancelado' });
      assert.equal(cancelado.cuerpo.estado, 'cancelado');
      assert.equal((await eventos('objetivos', 'cumplir', `Objetivo ${idObjetivo} `)).length, 1);
      assert.equal((await eventos('objetivos', 'cancelar', `Objetivo ${otro.cuerpo.id_objetivo} `)).length, 1);
      assert.equal((await api('PATCH', `/objetivos/${idObjetivo}`, luis.token, { estado: 'cumplido', meta: 'x' })).status, 400);
    });
  });

  describe('avances', () => {
    let idHoy;

    it('registrar con rangos válidos; al menos un dato; fecha futura o anterior al registro rechazada', async () => {
      const a1 = await api('POST', `/clientes/${cliente.id_cliente}/progresos`, luis.token, { fecha: await fechaRelativa(-30), peso_kg: 80, grasa_pct: 24, cintura_cm: 90.5 });
      assert.equal(a1.status, 201);
      assert.deepEqual([a1.cuerpo.peso_kg, a1.cuerpo.grasa_pct, a1.cuerpo.cintura_cm], [80, 24, 90.5]);
      await api('POST', `/clientes/${cliente.id_cliente}/progresos`, luis.token, { fecha: await fechaRelativa(-15), grasa_pct: 22.5, comentario: 'Mejor técnica' });
      const a3 = await api('POST', `/clientes/${cliente.id_cliente}/progresos`, luis.token, { fecha: await fechaRelativa(0), peso_kg: 78.4, cintura_cm: 88 });
      assert.equal(a3.status, 201);
      assert.equal(a3.cuerpo.puede_corregir, true);
      idHoy = a3.cuerpo.id_progreso;

      const futura = await api('POST', `/clientes/${cliente.id_cliente}/progresos`, luis.token, { fecha: await fechaRelativa(1), peso_kg: 70 });
      assert.equal(futura.status, 400);
      assert.equal(futura.cuerpo.error.details[0].field, 'fecha');
      const antes = await api('POST', `/clientes/${cliente.id_cliente}/progresos`, luis.token, { fecha: await fechaRelativa(-90), peso_kg: 70 });
      assert.equal(antes.status, 400);
      assert.equal((await api('POST', `/clientes/${cliente.id_cliente}/progresos`, luis.token, { fecha: await fechaRelativa(0) })).status, 400);
      assert.equal((await api('POST', `/clientes/${cliente.id_cliente}/progresos`, luis.token, { fecha: await fechaRelativa(0), peso_kg: 401 })).status, 400);
    });

    it('historial: del más reciente al más antiguo con diferencias contra el anterior que tenga la medida (FR-015)', async () => {
      const r = await api('GET', `/clientes/${cliente.id_cliente}/entrenamiento`, luis.token);
      const p = r.cuerpo.progresos;
      assert.equal(p.length, 3);
      assert.deepEqual(p.map((x) => x.fecha), [await fechaRelativa(0), await fechaRelativa(-15), await fechaRelativa(-30)]);
      assert.deepEqual(p[0].diferencias, { peso_kg: -1.6, grasa_pct: null, cintura_cm: -2.5 });
      assert.deepEqual(p[1].diferencias, { peso_kg: null, grasa_pct: -1.5, cintura_cm: null });
      // Los tres se registraron hoy (la fecha del avance puede ser anterior): su autor aún puede corregirlos.
      assert.ok(p.every((x) => x.puede_corregir === true));
    });

    it('corregir: el autor el mismo día; un dato debe quedar; otro entrenador 403; otro día 409', async () => {
      const c = await api('PATCH', `/progresos/${idHoy}`, luis.token, { peso_kg: 78.2, comentario: 'Corregido' });
      assert.equal(c.status, 200);
      assert.equal(c.cuerpo.peso_kg, 78.2);
      assert.equal(c.cuerpo.cintura_cm, 88, 'lo no enviado se conserva');
      assert.equal(c.cuerpo.corregido, true);
      assert.equal((await api('PATCH', `/progresos/${idHoy}`, luis.token, { peso_kg: null, cintura_cm: null, comentario: '' })).status, 400);
      assert.equal((await eventos('progresos', 'corregir', `Avance ${idHoy} `)).filter((e) => e.resultado === 'exito').length, 1);

      // Un avance registrado ayer ya no se corrige.
      await pool.execute('UPDATE progresos_clientes SET fecha_registro = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE id_progreso = ?', [idHoy]);
      assert.equal((await api('PATCH', `/progresos/${idHoy}`, luis.token, { peso_kg: 78 })).status, 409);

      // Eva, asignada después, ve el historial completo pero no corrige lo de Luis.
      const c2 = await crearClienteDePrueba({ nombre: 'Beto', apellido: marca });
      clientes.push(c2.id_cliente);
      await asignarEntrenadorDePrueba(c2.id_cliente, luis.id_usuario);
      const avance = await api('POST', `/clientes/${c2.id_cliente}/progresos`, luis.token, { fecha: await fechaRelativa(0), peso_kg: 90 });
      await api('PUT', `/clientes/${c2.id_cliente}/entrenador`, admin.token, { id_entrenador: eva.id_usuario });
      const deEva = await api('GET', `/clientes/${c2.id_cliente}/entrenamiento`, eva.token);
      assert.equal(deEva.cuerpo.progresos.length, 1);
      assert.equal(deEva.cuerpo.progresos[0].puede_corregir, false);
      assert.equal((await api('PATCH', `/progresos/${avance.cuerpo.id_progreso}`, eva.token, { peso_kg: 89 })).status, 403);
      assert.equal((await api('PATCH', `/progresos/${avance.cuerpo.id_progreso}`, luis.token, { peso_kg: 89 })).status, 403, 'Luis ya no lo tiene asignado');
    });

    it('auditoría sin medidas ni comentarios', async () => {
      const [filas] = await pool.execute("SELECT descripcion FROM auditoria WHERE modulo IN ('objetivos', 'progresos') AND descripcion LIKE ?", [`%cliente ${cliente.id_cliente}%`]);
      assert.ok(filas.length >= 4);
      for (const { descripcion } of filas) {
        assert.ok(!/kg|%|cm|Corregido|técnica|\d+\.\d/.test(descripcion), descripcion);
      }
    });
  });

  it('permisos: recepcionista y administrador no registran; entrenador no asignado 403', async () => {
    const cuerpo = { fecha: await fechaRelativa(0), peso_kg: 70 };
    assert.equal((await api('POST', `/clientes/${cliente.id_cliente}/progresos`, recepcion.token, cuerpo)).status, 403);
    assert.equal((await api('POST', `/clientes/${cliente.id_cliente}/progresos`, admin.token, cuerpo)).status, 403);
    assert.equal((await api('POST', `/clientes/${cliente.id_cliente}/objetivos`, recepcion.token, { descripcion: 'X' })).status, 403);
    assert.equal((await api('POST', `/clientes/${cliente.id_cliente}/progresos`, eva.token, cuerpo)).status, 403);
    const ver = await api('GET', `/clientes/${cliente.id_cliente}/entrenamiento`, admin.token);
    assert.equal(ver.status, 200);
    assert.ok(ver.cuerpo.objetivos.length >= 2);
    assert.ok(ver.cuerpo.progresos.every((p) => p.puede_corregir === false));
  });
});
