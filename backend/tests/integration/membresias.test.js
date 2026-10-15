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
  fechaRelativa,
  limpiarDatosDePrueba,
  cerrarPool,
  sinBiometria,
} from '../helpers.js';

// Asignar, renovar y administrar membresías contra la base de pruebas gymaccess_test.
// Las fechas son relativas a la fecha de la base (CURDATE).

describe('API de membresías', () => {
  let servidor;
  let admin;
  let recepcion;
  let entrenador;
  let tokenCliente;
  let plan; // 30 días, $450
  const usuarios = [];
  const clientes = [];
  const tipos = [];
  let hoy;

  const api = (metodo, ruta, token, cuerpo) => solicitar(servidor.url, metodo, ruta, { token, cuerpo });
  const nuevoCliente = async (extra) => {
    const c = await crearClienteDePrueba(extra);
    clientes.push(c.id_cliente);
    return c;
  };
  // Las altas responden { membresia, pago }; los helpers entregan la membresía en `cuerpo` y el sobre en `sobre`.
  const desenvolver = (r) => (r.status === 201 ? { ...r, sobre: r.cuerpo, cuerpo: r.cuerpo.membresia } : r);
  const asignar = async (idCliente, cuerpo, token = recepcion.token) =>
    desenvolver(await api('POST', `/clientes/${idCliente}/membresias`, token, { id_tipo_membresia: plan.id_tipo_membresia, ...cuerpo }));
  const consultar = (idCliente, token = admin.token) => api('GET', `/clientes/${idCliente}/membresias`, token);
  const campos = (r) => (r.cuerpo?.error?.details ?? []).map((d) => d.field);
  // Membresía pagada que termina en `diasFin` días y empezó `diasInicio` días antes de hoy.
  const pagada = async (idCliente, diasInicio, diasFin, extra = {}) =>
    crearMembresiaDePrueba({ idCliente, idTipo: plan.id_tipo_membresia, inicio: await fechaRelativa(-diasInicio), fin: await fechaRelativa(diasFin), pagada: true, ...extra });
  const sinPago = async (idCliente, diasInicio, diasFin, extra = {}) =>
    crearMembresiaDePrueba({ idCliente, idTipo: plan.id_tipo_membresia, inicio: await fechaRelativa(-diasInicio), fin: await fechaRelativa(diasFin), ...extra });

  before(async () => {
    servidor = await iniciarServidor();
    admin = await crearUsuarioConRol('administrador');
    recepcion = await crearUsuarioConRol('recepcionista');
    entrenador = await crearUsuarioConRol('entrenador');
    usuarios.push(admin.id_usuario, recepcion.id_usuario, entrenador.id_usuario);
    plan = await crearTipoMembresiaDePrueba({ precio: '450.00', duracion: 30 });
    tipos.push(plan.id_tipo_membresia);
    hoy = await fechaRelativa(0);

    const cuentaCliente = await nuevoCliente();
    const cuenta = await api('POST', '/usuarios', admin.token, {
      nombre: 'Cliente membresías',
      correo: cuentaCliente.correo,
      password: 'Secreta123',
      rol: 'cliente',
      id_cliente: cuentaCliente.id_cliente,
    });
    assert.equal(cuenta.status, 201);
    usuarios.push(cuenta.cuerpo.id_usuario);
    tokenCliente = crearToken(cuenta.cuerpo.id_usuario);
  });

  after(async () => {
    try {
      await limpiarDatosDePrueba({ usuarios, clientes, tipos });
    } finally {
      await servidor.cerrar();
      await cerrarPool();
    }
  });

  describe('permisos', () => {
    it('sin sesión responde 401 y el entrenador y el cliente 403', async () => {
      const c = await nuevoCliente();
      assert.equal((await api('GET', `/clientes/${c.id_cliente}/membresias`)).status, 401);
      assert.equal((await api('POST', `/clientes/${c.id_cliente}/membresias`, undefined, { id_tipo_membresia: plan.id_tipo_membresia })).status, 401);
      for (const token of [entrenador.token, tokenCliente]) {
        assert.equal((await consultar(c.id_cliente, token)).status, 403);
        assert.equal((await asignar(c.id_cliente, {}, token)).status, 403);
        assert.equal((await api('POST', '/membresias/1/renovar', token, {})).status, 403);
        assert.equal((await api('PATCH', '/membresias/1/estado', token, { accion: 'cancelar' })).status, 403);
      }
    });

    it('el recepcionista consulta, asigna y renueva pero no suspende, reactiva ni cancela', async () => {
      const c = await nuevoCliente();
      const m = await asignar(c.id_cliente, {});
      assert.equal(m.status, 201);
      assert.equal((await consultar(c.id_cliente, recepcion.token)).status, 200);
      for (const accion of ['suspender', 'reactivar', 'cancelar']) {
        assert.equal((await api('PATCH', `/membresias/${m.cuerpo.id_membresia}/estado`, recepcion.token, { accion })).status, 403);
      }
    });
  });

  describe('asignar', () => {
    it('crea la membresía pendiente de pago con fecha de fin = inicio + duración − 1', async () => {
      const c = await nuevoCliente();
      const r = await asignar(c.id_cliente, {});
      assert.equal(r.status, 201);
      const m = r.cuerpo;
      assert.equal(m.id_cliente, c.id_cliente);
      assert.equal(m.fecha_inicio, hoy);
      assert.equal(m.fecha_fin, await fechaRelativa(29));
      assert.equal(m.estado, 'pendiente_de_pago');
      assert.equal(m.dias_restantes, 29);
      assert.equal(m.precio, 450);
      assert.equal(m.adeudo, 450);
      assert.equal(m.pago, null);
      assert.equal(r.sobre.pago, null); // sin pago en la misma operación
      assert.deepEqual(m.tipo, { id_tipo_membresia: plan.id_tipo_membresia, nombre: plan.nombre, duracion: 30 });
      const [[fila]] = await pool.execute('SELECT estado FROM membresias WHERE id_membresia = ?', [m.id_membresia]);
      assert.equal(fila.estado, 'activa'); // el estado "pendiente de pago" se deriva: no se guarda
      sinBiometria(r.cuerpo);
    });

    it('acepta una fecha de inicio futura (hasta 60 días) y calcula la fecha de fin desde ella', async () => {
      const c = await nuevoCliente();
      const inicio = await fechaRelativa(5);
      const r = await asignar(c.id_cliente, { fecha_inicio: inicio });
      assert.equal(r.status, 201);
      assert.equal(r.cuerpo.fecha_inicio, inicio);
      assert.equal(r.cuerpo.fecha_fin, await fechaRelativa(34));
      const limite = await nuevoCliente();
      assert.equal((await asignar(limite.id_cliente, { fecha_inicio: await fechaRelativa(60) })).status, 201);
    });

    it('rechaza (400) fechas pasadas, de más de 60 días, mal formadas o inexistentes', async () => {
      const c = await nuevoCliente();
      for (const fecha of [await fechaRelativa(-1), await fechaRelativa(61), '2026-13-01', '2026-02-30', '14/10/2026', 'mañana', 20261014]) {
        const r = await asignar(c.id_cliente, { fecha_inicio: fecha });
        assert.equal(r.status, 400, String(fecha));
        assert.ok(campos(r).includes('fecha_inicio'), String(fecha));
      }
    });

    it('rechaza (400) un plan ausente o con formato inválido y campos que no se pueden enviar', async () => {
      const c = await nuevoCliente();
      for (const cuerpo of [{ id_tipo_membresia: undefined }, { id_tipo_membresia: 0 }, { id_tipo_membresia: 'abc' }, { id_tipo_membresia: 1.5 }]) {
        const r = await asignar(c.id_cliente, cuerpo);
        assert.equal(r.status, 400);
        assert.ok(campos(r).includes('id_tipo_membresia'));
      }
      assert.equal((await asignar(c.id_cliente, { estado: 'activa' })).status, 400);
      assert.equal((await asignar(c.id_cliente, { fecha_fin: hoy })).status, 400);
    });

    it('rechaza un cliente inactivo (409), inexistente (404), un plan inactivo (409) y un plan inexistente (404)', async () => {
      const inactivo = await nuevoCliente({ estado: 'inactivo' });
      assert.equal((await asignar(inactivo.id_cliente, {})).status, 409);
      assert.equal((await asignar(999999999, {})).status, 404);

      const c = await nuevoCliente();
      const apagado = await crearTipoMembresiaDePrueba({ estado: 'inactivo' });
      tipos.push(apagado.id_tipo_membresia);
      assert.equal((await asignar(c.id_cliente, { id_tipo_membresia: apagado.id_tipo_membresia })).status, 409);
      assert.equal((await asignar(c.id_cliente, { id_tipo_membresia: 999999999 })).status, 404);
    });

    it('rechaza (409) un plan con precio 0 aunque exista en la base', async () => {
      const c = await nuevoCliente();
      const gratis = await crearTipoMembresiaDePrueba({ precio: '0.00' });
      tipos.push(gratis.id_tipo_membresia);
      assert.equal((await asignar(c.id_cliente, { id_tipo_membresia: gratis.id_tipo_membresia })).status, 409);
    });

    it('no deja asignar otra si ya hay una vigente, pendiente de pago, suspendida o programada', async () => {
      const vigente = await nuevoCliente();
      await pagada(vigente.id_cliente, 5, 20);
      const r1 = await asignar(vigente.id_cliente, {});
      assert.equal(r1.status, 409);
      assert.match(r1.cuerpo.error.message, /renov/i);

      const pendiente = await nuevoCliente();
      assert.equal((await asignar(pendiente.id_cliente, {})).status, 201);
      const r2 = await asignar(pendiente.id_cliente, {});
      assert.equal(r2.status, 409);
      assert.match(r2.cuerpo.error.message, /pago/i);

      const suspendida = await nuevoCliente();
      await pagada(suspendida.id_cliente, 5, 20, { estado: 'suspendida' });
      assert.equal((await asignar(suspendida.id_cliente, {})).status, 409);

      const programada = await nuevoCliente();
      await crearMembresiaDePrueba({ idCliente: programada.id_cliente, idTipo: plan.id_tipo_membresia, inicio: await fechaRelativa(10), fin: await fechaRelativa(39), pagada: true });
      assert.equal((await asignar(programada.id_cliente, {})).status, 409);
    });

    it('sí deja asignar si las anteriores están vencidas o canceladas', async () => {
      const c = await nuevoCliente();
      await pagada(c.id_cliente, 60, -30); // venció hace 30 días
      await pagada(c.id_cliente, 5, 20, { estado: 'cancelada' });
      assert.equal((await asignar(c.id_cliente, {})).status, 201);
    });

    it('dos asignaciones simultáneas al mismo cliente: una se crea y la otra recibe 409', async () => {
      const c = await nuevoCliente();
      const resultados = await Promise.all([asignar(c.id_cliente, {}), asignar(c.id_cliente, {}), asignar(c.id_cliente, {})]);
      assert.deepEqual(resultados.map((r) => r.status).sort(), [201, 409, 409]);
      const [[conteo]] = await pool.execute('SELECT COUNT(*) AS n FROM membresias WHERE id_cliente = ?', [c.id_cliente]);
      assert.equal(Number(conteo.n), 1);
    });
  });

  describe('consultar', () => {
    it('devuelve la actual, la próxima y el historial con estados efectivos', async () => {
      const c = await nuevoCliente();
      const vencida = await pagada(c.id_cliente, 120, -60);
      const cancelada = await pagada(c.id_cliente, 59, -30, { estado: 'cancelada' });
      const actual = await pagada(c.id_cliente, 5, 24);
      const proxima = await crearMembresiaDePrueba({ idCliente: c.id_cliente, idTipo: plan.id_tipo_membresia, inicio: await fechaRelativa(25), fin: await fechaRelativa(54), pagada: true });

      const r = await consultar(c.id_cliente);
      assert.equal(r.status, 200);
      assert.deepEqual(Object.keys(r.cuerpo).sort(), ['actual', 'historial', 'proxima']);
      assert.equal(r.cuerpo.actual.id_membresia, actual.id_membresia);
      assert.equal(r.cuerpo.actual.estado, 'vigente');
      assert.equal(r.cuerpo.actual.dias_restantes, 24);
      assert.equal(r.cuerpo.proxima.id_membresia, proxima.id_membresia);
      assert.equal(r.cuerpo.proxima.estado, 'proxima');
      // El historial no repite la actual ni la próxima y va de la más reciente a la más antigua.
      assert.deepEqual(r.cuerpo.historial.map((m) => [m.id_membresia, m.estado]), [
        [cancelada.id_membresia, 'cancelada'],
        [vencida.id_membresia, 'vencida'],
      ]);
      sinBiometria(r.cuerpo);
    });

    it('un cliente sin membresías devuelve todo vacío; uno inexistente, 404', async () => {
      const c = await nuevoCliente();
      const r = await consultar(c.id_cliente);
      assert.deepEqual(r.cuerpo, { actual: null, proxima: null, historial: [] });
      assert.equal((await consultar(999999999)).status, 404);
      assert.equal((await api('GET', '/clientes/abc/membresias', admin.token)).status, 400);
    });

    it('marca la membresía por vencer cuando le quedan 5 días o menos', async () => {
      const c = await nuevoCliente();
      await pagada(c.id_cliente, 25, 5);
      const r = await consultar(c.id_cliente);
      assert.equal(r.cuerpo.actual.estado, 'vigente');
      assert.equal(r.cuerpo.actual.por_vencer, true);
    });

    it('una sin pago aparece pendiente de pago; una vencida sin pago, vencida; nunca se guarda "vencida"', async () => {
      const c = await nuevoCliente();
      await sinPago(c.id_cliente, 40, -10);
      await sinPago(c.id_cliente, 5, 24);
      const r = await consultar(c.id_cliente);
      assert.equal(r.cuerpo.actual.estado, 'pendiente_de_pago');
      assert.equal(r.cuerpo.actual.adeudo, 450);
      assert.equal(r.cuerpo.historial[0].estado, 'vencida');
      const [[conteo]] = await pool.execute("SELECT COUNT(*) AS n FROM membresias WHERE id_cliente = ? AND estado = 'vencida'", [c.id_cliente]);
      assert.equal(Number(conteo.n), 0);
    });
  });

  describe('renovar', () => {
    const renovar = async (id, cuerpo = {}, token = recepcion.token) => desenvolver(await api('POST', `/membresias/${id}/renovar`, token, cuerpo));

    it('con una vigente que vence en el futuro, el nuevo periodo empieza el día siguiente y queda pendiente de pago', async () => {
      const c = await nuevoCliente();
      const actual = await pagada(c.id_cliente, 20, 10);
      const r = await renovar(actual.id_membresia);
      assert.equal(r.status, 201);
      assert.equal(r.cuerpo.fecha_inicio, await fechaRelativa(11));
      assert.equal(r.cuerpo.fecha_fin, await fechaRelativa(40));
      assert.equal(r.cuerpo.estado, 'pendiente_de_pago');
      assert.equal(r.cuerpo.adeudo, 450);

      const consulta = await consultar(c.id_cliente);
      assert.equal(consulta.cuerpo.actual.id_membresia, actual.id_membresia); // sigue dando acceso hasta su fin
      assert.equal(consulta.cuerpo.actual.estado, 'vigente');
      assert.equal(consulta.cuerpo.proxima.id_membresia, r.cuerpo.id_membresia);
    });

    it('no acepta otra fecha de inicio cuando la membresía vigente aún no vence (400), pero sí la misma', async () => {
      const c = await nuevoCliente();
      const actual = await pagada(c.id_cliente, 20, 10);
      const r = await renovar(actual.id_membresia, { fecha_inicio: await fechaRelativa(15) });
      assert.equal(r.status, 400);
      assert.ok(campos(r).includes('fecha_inicio'));
      assert.equal((await renovar(actual.id_membresia, { fecha_inicio: await fechaRelativa(11) })).status, 201);
    });

    it('solo se permite una renovación futura a la vez (409)', async () => {
      const c = await nuevoCliente();
      const actual = await pagada(c.id_cliente, 20, 10);
      assert.equal((await renovar(actual.id_membresia)).status, 201);
      const otra = await renovar(actual.id_membresia);
      assert.equal(otra.status, 409);
      assert.match(otra.cuerpo.error.message, /renovaci/i);
    });

    it('no se puede renovar una membresía pendiente de pago (409)', async () => {
      const c = await nuevoCliente();
      const pendiente = await sinPago(c.id_cliente, 2, 27);
      const r = await renovar(pendiente.id_membresia);
      assert.equal(r.status, 409);
      assert.match(r.cuerpo.error.message, /pago/i);
    });

    it('una vencida se renueva desde hoy o desde la fecha indicada, nunca desde el pasado', async () => {
      const c = await nuevoCliente();
      const vencida = await pagada(c.id_cliente, 40, -10);
      const porDefecto = await renovar(vencida.id_membresia);
      assert.equal(porDefecto.status, 201);
      assert.equal(porDefecto.cuerpo.fecha_inicio, hoy);

      const d = await nuevoCliente();
      const otra = await pagada(d.id_cliente, 40, -10);
      assert.equal((await renovar(otra.id_membresia, { fecha_inicio: await fechaRelativa(3) })).cuerpo.fecha_inicio, await fechaRelativa(3));

      const e = await nuevoCliente();
      const tercera = await pagada(e.id_cliente, 40, -10);
      assert.equal((await renovar(tercera.id_membresia, { fecha_inicio: await fechaRelativa(-2) })).status, 400);
      assert.equal((await renovar(tercera.id_membresia, { fecha_inicio: await fechaRelativa(61) })).status, 400);
    });

    it('una vencida no se renueva si el cliente ya tiene otra en curso (409)', async () => {
      const c = await nuevoCliente();
      const vieja = await pagada(c.id_cliente, 90, -30);
      await pagada(c.id_cliente, 5, 24);
      assert.equal((await renovar(vieja.id_membresia)).status, 409);
    });

    it('rechaza renovar una cancelada o suspendida, una inexistente y un plan que ya no está disponible', async () => {
      const c = await nuevoCliente();
      const cancelada = await pagada(c.id_cliente, 40, -10, { estado: 'cancelada' });
      assert.equal((await renovar(cancelada.id_membresia)).status, 409);

      const s = await nuevoCliente();
      const suspendida = await pagada(s.id_cliente, 5, 20, { estado: 'suspendida' });
      assert.equal((await renovar(suspendida.id_membresia)).status, 409);

      assert.equal((await renovar(999999999)).status, 404);

      const i = await nuevoCliente();
      const apagado = await crearTipoMembresiaDePrueba({});
      tipos.push(apagado.id_tipo_membresia);
      const m = await crearMembresiaDePrueba({ idCliente: i.id_cliente, idTipo: apagado.id_tipo_membresia, inicio: await fechaRelativa(-40), fin: await fechaRelativa(-10), pagada: true });
      await pool.execute("UPDATE tipos_membresia SET estado = 'inactivo' WHERE id_tipo_membresia = ?", [apagado.id_tipo_membresia]);
      assert.equal((await renovar(m.id_membresia)).status, 409);
    });

    it('rechaza renovar a un cliente dado de baja (409)', async () => {
      const c = await nuevoCliente();
      const vencida = await pagada(c.id_cliente, 40, -10);
      await pool.execute("UPDATE clientes SET estado = 'inactivo' WHERE id_cliente = ?", [c.id_cliente]);
      assert.equal((await renovar(vencida.id_membresia)).status, 409);
    });

    it('dos renovaciones simultáneas: una se crea y la otra recibe 409', async () => {
      const c = await nuevoCliente();
      const actual = await pagada(c.id_cliente, 20, 10);
      const resultados = await Promise.all([renovar(actual.id_membresia), renovar(actual.id_membresia)]);
      assert.deepEqual(resultados.map((r) => r.status).sort(), [201, 409]);
    });
  });

  describe('suspender, reactivar y cancelar (administrador)', () => {
    const estado = (id, accion, token = admin.token) => api('PATCH', `/membresias/${id}/estado`, token, { accion });

    it('suspender una vigente la deja suspendida y reactivarla la devuelve a vigente con la misma fecha de fin', async () => {
      const c = await nuevoCliente();
      const m = await pagada(c.id_cliente, 5, 24);
      const fin = await fechaRelativa(24);

      const s = await estado(m.id_membresia, 'suspender');
      assert.equal(s.status, 200);
      assert.equal(s.cuerpo.estado, 'suspendida');
      assert.equal((await consultar(c.id_cliente)).cuerpo.actual.estado, 'suspendida');
      assert.equal((await estado(m.id_membresia, 'suspender')).status, 409);

      const r = await estado(m.id_membresia, 'reactivar');
      assert.equal(r.status, 200);
      assert.equal(r.cuerpo.estado, 'vigente');
      assert.equal(r.cuerpo.fecha_fin, fin);
    });

    it('reactivar una pendiente de pago suspendida la devuelve a pendiente de pago', async () => {
      const c = await nuevoCliente();
      const m = await sinPago(c.id_cliente, 5, 24);
      assert.equal((await estado(m.id_membresia, 'suspender')).cuerpo.estado, 'suspendida');
      assert.equal((await estado(m.id_membresia, 'reactivar')).cuerpo.estado, 'pendiente_de_pago');
    });

    it('cancelar es definitivo: no se reactiva ni se vuelve a cancelar o suspender', async () => {
      const c = await nuevoCliente();
      const m = await pagada(c.id_cliente, 5, 24);
      const r = await estado(m.id_membresia, 'cancelar');
      assert.equal(r.status, 200);
      assert.equal(r.cuerpo.estado, 'cancelada');
      for (const accion of ['reactivar', 'cancelar', 'suspender']) {
        assert.equal((await estado(m.id_membresia, accion)).status, 409, accion);
      }
    });

    it('se puede cancelar una suspendida y una pendiente de pago asignada por error', async () => {
      const a = await nuevoCliente();
      const suspendida = await pagada(a.id_cliente, 5, 24, { estado: 'suspendida' });
      assert.equal((await estado(suspendida.id_membresia, 'cancelar')).cuerpo.estado, 'cancelada');

      const b = await nuevoCliente();
      const asignada = await asignar(b.id_cliente, {});
      assert.equal((await estado(asignada.cuerpo.id_membresia, 'cancelar')).cuerpo.estado, 'cancelada');
      assert.equal((await asignar(b.id_cliente, {})).status, 201); // ya se puede asignar otra
    });

    it('no se puede suspender una vencida ni reactivar una que no está suspendida', async () => {
      const c = await nuevoCliente();
      const vencida = await pagada(c.id_cliente, 60, -30);
      assert.equal((await estado(vencida.id_membresia, 'suspender')).status, 409);
      const vigente = await pagada((await nuevoCliente()).id_cliente, 5, 24);
      assert.equal((await estado(vigente.id_membresia, 'reactivar')).status, 409);
    });

    it('rechaza una acción inválida (400), campos extra y una membresía inexistente (404)', async () => {
      const c = await nuevoCliente();
      const m = await pagada(c.id_cliente, 5, 24);
      assert.equal((await estado(m.id_membresia, 'borrar')).status, 400);
      assert.equal((await api('PATCH', `/membresias/${m.id_membresia}/estado`, admin.token, {})).status, 400);
      assert.equal((await api('PATCH', `/membresias/${m.id_membresia}/estado`, admin.token, { accion: 'cancelar', estado: 'activa' })).status, 400);
      assert.equal((await estado(999999999, 'cancelar')).status, 404);
    });
  });
});
