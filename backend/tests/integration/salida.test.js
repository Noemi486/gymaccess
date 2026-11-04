import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/config/db.js';
import {
  iniciarServidor,
  solicitar,
  crearToken,
  crearUsuarioConRol,
  crearClienteDePrueba,
  crearTipoMembresiaDePrueba,
  crearMembresiaDePrueba,
  crearDescriptorSintetico,
  fechaRelativa,
  limpiarDatosDePrueba,
  cerrarPool,
  sinBiometria,
} from '../helpers.js';

// Salida del gimnasio (spec 004, US8, FR-026 a FR-028, SC-010) sobre gymaccess_test.
// Las pruebas corren un archivo a la vez: las cifras globales se comparan antes y después dentro de este archivo.

describe('Modo Salida de la estación', () => {
  let servidor;
  let admin;
  let recepcion;
  let entrenador;
  let plan;
  let vigente;
  let sinMembresia;
  let baja;
  let tokenVigente;
  const usuarios = [];
  const clientes = [];
  const tipos = [];
  const idsAcceso = [];
  const marca = `Sal${process.pid}${Date.now() % 100000}`;
  const base = 96_000 + (process.pid % 1000) * 3;

  const api = (metodo, ruta, token, cuerpo) => solicitar(servidor.url, metodo, ruta, { token, cuerpo });
  const identificar = async (descriptor, tipo) => {
    const r = await api('POST', '/accesos/identificar', recepcion.token, tipo ? { descriptor, tipo } : { descriptor });
    if (r.cuerpo?.id_acceso) idsAcceso.push(r.cuerpo.id_acceso);
    return r;
  };
  const conRostro = async (sufijo, semilla, estado = 'activo') => {
    const c = await crearClienteDePrueba({ nombre: sufijo, apellido: marca });
    clientes.push(c.id_cliente);
    const r = await api('POST', `/clientes/${c.id_cliente}/rostro`, recepcion.token, { descriptor: crearDescriptorSintetico(semilla), consentimiento: true });
    assert.equal(r.status, 201);
    if (estado !== 'activo') await pool.execute('UPDATE clientes SET estado = ? WHERE id_cliente = ?', [estado, c.id_cliente]);
    return { ...c, semilla };
  };
  const cifras = async () => {
    const hoy = await fechaRelativa(0);
    const [a, e, d] = await Promise.all([
      api('GET', '/resumen', admin.token),
      api('GET', '/resumen', entrenador.token),
      api('GET', `/dashboard?periodo=rango&desde=${hoy}&hasta=${hoy}`, admin.token),
    ]);
    return {
      hoy: a.cuerpo.accesos.hoy,
      clientes_hoy: e.cuerpo.accesos.clientes_hoy,
      autorizados: d.cuerpo.periodo_datos.accesos_autorizados,
      rechazados: d.cuerpo.periodo_datos.accesos_rechazados,
      recientes: d.cuerpo.accesos_recientes.map((x) => x.id_acceso),
    };
  };

  before(async () => {
    servidor = await iniciarServidor();
    admin = await crearUsuarioConRol('administrador');
    recepcion = await crearUsuarioConRol('recepcionista');
    entrenador = await crearUsuarioConRol('entrenador');
    usuarios.push(admin.id_usuario, recepcion.id_usuario, entrenador.id_usuario);
    plan = await crearTipoMembresiaDePrueba();
    tipos.push(plan.id_tipo_membresia);
    vigente = await conRostro('Vigente', base + 1);
    await crearMembresiaDePrueba({ idCliente: vigente.id_cliente, idTipo: plan.id_tipo_membresia, inicio: await fechaRelativa(-1), fin: await fechaRelativa(20), pagada: true });
    sinMembresia = await conRostro('SinMembresia', base + 2);
    baja = await conRostro('Baja', base + 3, 'inactivo');
    const cuenta = await api('POST', '/usuarios', admin.token, { nombre: 'Cuenta', correo: vigente.correo, password: 'Secreta123', rol: 'cliente', id_cliente: vigente.id_cliente });
    usuarios.push(cuenta.cuerpo.id_usuario);
    tokenVigente = crearToken(cuenta.cuerpo.id_usuario);
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

  it('salida autorizada sin revisar membresía ni estado; no reconocido se rechaza como salida', async () => {
    for (const c of [vigente, sinMembresia, baja]) {
      const r = await identificar(crearDescriptorSintetico(c.semilla), 'salida');
      assert.equal(r.status, 200);
      assert.equal(r.cuerpo.resultado, 'autorizado', c.nombre);
      assert.equal(r.cuerpo.tipo, 'salida');
      assert.equal(r.cuerpo.cliente.id_cliente, c.id_cliente);
      assert.equal(r.cuerpo.membresia, undefined, 'la salida no informa de la membresía');
      sinBiometria(r.cuerpo);
    }
    const desconocido = await identificar(crearDescriptorSintetico(base + 999_000), 'salida');
    assert.equal(desconocido.cuerpo.resultado, 'rechazado');
    assert.equal(desconocido.cuerpo.tipo, 'salida');
    assert.equal(desconocido.cuerpo.motivo, 'Rostro no reconocido');
    assert.equal(desconocido.cuerpo.cliente, undefined);

    const [filas] = await pool.execute(`SELECT tipo, resultado FROM accesos WHERE id_acceso IN (${idsAcceso.map(() => '?').join(',')})`, idsAcceso);
    assert.ok(filas.every((f) => f.tipo === 'salida'));
  });

  it('sin tipo (o tipo entrada) sigue siendo entrada con sus reglas; tipo inválido 400', async () => {
    const r = await identificar(crearDescriptorSintetico(sinMembresia.semilla));
    assert.equal(r.cuerpo.tipo, 'entrada');
    assert.equal(r.cuerpo.motivo, 'Sin membresía');
    const ok = await identificar(crearDescriptorSintetico(vigente.semilla), 'entrada');
    assert.equal(ok.cuerpo.resultado, 'autorizado');
    assert.equal(ok.cuerpo.tipo, 'entrada');
    assert.ok(ok.cuerpo.membresia);
    assert.equal((await api('POST', '/accesos/identificar', recepcion.token, { descriptor: crearDescriptorSintetico(1), tipo: 'otro' })).status, 400);
  });

  it('GET /accesos filtra por tipo y muestra el tipo', async () => {
    const hoy = await fechaRelativa(0);
    const salidas = await api('GET', `/accesos?desde=${hoy}&hasta=${hoy}&tipo=salida&q=${encodeURIComponent(marca)}&limit=100`, admin.token);
    assert.equal(salidas.status, 200);
    assert.equal(salidas.cuerpo.total, 3);
    assert.ok(salidas.cuerpo.data.every((a) => a.tipo === 'salida'));
    const entradas = await api('GET', `/accesos?desde=${hoy}&hasta=${hoy}&tipo=entrada&q=${encodeURIComponent(marca)}&limit=100`, admin.token);
    assert.ok(entradas.cuerpo.data.every((a) => a.tipo === 'entrada'));
    assert.equal(entradas.cuerpo.total, 2);
    assert.equal((await api('GET', '/accesos?tipo=otro', admin.token)).status, 400);
  });

  it('las cifras del Sprint 2 cuentan solo entradas (SC-010)', async () => {
    const antes = await cifras();
    const salida = await identificar(crearDescriptorSintetico(vigente.semilla), 'salida');
    const rechazo = await identificar(crearDescriptorSintetico(base + 888_000), 'salida');
    const despues = await cifras();
    assert.equal(despues.hoy, antes.hoy);
    assert.equal(despues.clientes_hoy, antes.clientes_hoy);
    assert.equal(despues.autorizados, antes.autorizados);
    assert.equal(despues.rechazados, antes.rechazados);
    assert.ok(!despues.recientes.includes(salida.cuerpo.id_acceso));
    assert.ok(!despues.recientes.includes(rechazo.cuerpo.id_acceso));

    // Las últimas visitas del cliente son solo entradas.
    const mi = await api('GET', '/clientes/me/resumen', tokenVigente);
    assert.equal(mi.status, 200);
    assert.equal(mi.cuerpo.visitas.length, 1, 'solo la entrada autorizada; no las salidas');
  });

  it('la salida no genera auditoría y el entrenador no usa la estación', async () => {
    const [ev] = await pool.execute("SELECT COUNT(*) AS n FROM auditoria WHERE modulo = 'accesos'");
    assert.equal(Number(ev[0].n), 0);
    assert.equal((await api('POST', '/accesos/identificar', entrenador.token, { descriptor: crearDescriptorSintetico(1), tipo: 'salida' })).status, 403);
  });
});
