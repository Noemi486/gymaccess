import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
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

// Matriz de permisos del Sprint 3 (spec 004, Anexo, FR-017 a FR-020, SC-004) sobre gymaccess_test.
// Para cada operación se prueba cada rol: los no permitidos reciben 403 (o 401 sin sesión) y nunca datos.

describe('Permisos del Sprint 3', () => {
  let servidor;
  const t = {};
  let cliente;
  let ajeno;
  let ids;
  const usuarios = [];
  const clientes = [];
  const marca = `PS3${process.pid}${Date.now() % 100000}`;

  const api = (metodo, ruta, token, cuerpo) => solicitar(servidor.url, metodo, ruta, { token, cuerpo });

  before(async () => {
    servidor = await iniciarServidor();
    const admin = await crearUsuarioConRol('administrador');
    const recepcion = await crearUsuarioConRol('recepcionista');
    const asignado = await crearEntrenadorDePrueba({ nombre: `Asignado ${marca}` });
    const otro = await crearEntrenadorDePrueba({ nombre: `Otro ${marca}` });
    usuarios.push(admin.id_usuario, recepcion.id_usuario, asignado.id_usuario, otro.id_usuario);
    cliente = await crearClienteDePrueba({ nombre: 'Cliente', apellido: marca });
    ajeno = await crearClienteDePrueba({ nombre: 'Ajeno', apellido: marca });
    clientes.push(cliente.id_cliente, ajeno.id_cliente);
    await asignarEntrenadorDePrueba(cliente.id_cliente, asignado.id_usuario);
    await asignarEntrenadorDePrueba(ajeno.id_cliente, otro.id_usuario);
    const cuenta = await api('POST', '/usuarios', admin.token, { nombre: 'Cuenta', correo: cliente.correo, password: 'Secreta123', rol: 'cliente', id_cliente: cliente.id_cliente });
    usuarios.push(cuenta.cuerpo.id_usuario);
    Object.assign(t, { administrador: admin.token, recepcionista: recepcion.token, asignado: asignado.token, otro: otro.token, cliente: crearToken(cuenta.cuerpo.id_usuario) });

    const rutina = await api('POST', `/clientes/${cliente.id_cliente}/rutinas`, t.asignado, { nombre: 'R', dias: [{ dia: 1, ejercicios: [{ nombre: 'X', series: 1 }] }] });
    const objetivo = await api('POST', `/clientes/${cliente.id_cliente}/objetivos`, t.asignado, { descripcion: 'O' });
    const avance = await api('POST', `/clientes/${cliente.id_cliente}/progresos`, t.asignado, { fecha: await fechaRelativa(0), peso_kg: 70 });
    ids = { rutina: rutina.cuerpo.id_rutina, objetivo: objetivo.cuerpo.id_objetivo, avance: avance.cuerpo.id_progreso, entrenador: asignado.id_usuario, otroEntrenador: otro.id_usuario };
  });

  after(async () => {
    try {
      await limpiarDatosDePrueba({ usuarios, clientes });
    } finally {
      await servidor.cerrar();
      await cerrarPool();
    }
  });

  // [método, ruta, cuerpo, roles permitidos] — `asignado` es el entrenador del cliente; `otro`, uno que no lo es.
  const operaciones = () => {
    const c = cliente.id_cliente;
    return [
      ['GET', '/entrenadores', undefined, ['administrador', 'recepcionista']],
      ['GET', `/entrenadores/${ids.entrenador}`, undefined, ['administrador', 'recepcionista']],
      ['POST', '/entrenadores', { nombre: 'X', correo: `test+${marca}@example.com`, password: 'corta' }, ['administrador']],
      ['PATCH', `/entrenadores/${ids.otroEntrenador}`, { especialidad: 'Yoga' }, ['administrador']],
      ['GET', `/clientes/${c}/entrenador`, undefined, ['administrador', 'recepcionista']],
      ['PUT', `/clientes/${c}/entrenador`, { id_entrenador: 999999999 }, ['administrador', 'recepcionista']],
      ['GET', '/entrenamiento/mis-clientes', undefined, ['asignado', 'otro']],
      ['GET', `/clientes/${c}/entrenamiento`, undefined, ['administrador', 'asignado']],
      ['GET', `/rutinas/${ids.rutina}`, undefined, ['administrador', 'asignado']],
      ['POST', `/clientes/${c}/rutinas`, { nombre: 'R2', dias: [{ dia: 1, ejercicios: [{ nombre: 'Y', series: 2 }] }] }, ['asignado']],
      ['POST', `/clientes/${c}/objetivos`, { descripcion: 'O2' }, ['asignado']],
      ['PATCH', `/objetivos/${ids.objetivo}`, { meta: 'M' }, ['asignado']],
      ['POST', `/clientes/${c}/progresos`, { fecha: '2000-01-01', peso_kg: 70 }, ['asignado']],
      ['PATCH', `/progresos/${ids.avance}`, { comentario: 'ok' }, ['asignado']],
      ['GET', '/clientes/me/entrenamiento', undefined, ['cliente']],
    ];
  };

  it('cada rol solo hace lo que le permite el Anexo; los demás reciben 403 sin datos (SC-004)', async () => {
    for (const [metodo, ruta, cuerpo, permitidos] of operaciones()) {
      for (const rol of ['administrador', 'recepcionista', 'asignado', 'otro', 'cliente']) {
        const r = await api(metodo, ruta, t[rol], cuerpo);
        const etiqueta = `${rol} ${metodo} ${ruta} → ${r.status}`;
        if (permitidos.includes(rol)) {
          assert.notEqual(r.status, 403, etiqueta);
          assert.notEqual(r.status, 401, etiqueta);
        } else {
          assert.equal(r.status, 403, etiqueta);
          assert.equal(r.cuerpo?.data, undefined, etiqueta);
        }
        sinBiometria(r.cuerpo);
        assert.ok(!JSON.stringify(r.cuerpo ?? null).includes('"password"'), `${etiqueta}: sin contraseñas`);
      }
    }
  });

  it('sin sesión: 401 en todas', async () => {
    for (const [metodo, ruta, cuerpo] of operaciones()) {
      assert.equal((await solicitar(servidor.url, metodo, ruta, { cuerpo })).status, 401, `${metodo} ${ruta}`);
    }
  });

  it('el entrenador no ve el entrenamiento del cliente ajeno ni con su id', async () => {
    assert.equal((await api('GET', `/clientes/${ajeno.id_cliente}/entrenamiento`, t.asignado)).status, 403);
    const mios = await api('GET', `/entrenamiento/mis-clientes?q=${encodeURIComponent(marca)}`, t.asignado);
    assert.deepEqual(mios.cuerpo.data.map((c) => c.id_cliente), [cliente.id_cliente]);
  });
});
