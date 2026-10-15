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
} from '../helpers.js';

// Pagos: un solo pago por membresía, por el monto completo (gymaccess_test).

describe('API de pagos', () => {
  let servidor;
  let admin;
  let recepcion;
  let entrenador;
  let tokenCliente;
  let plan; // 30 días, $450
  const usuarios = [];
  const clientes = [];
  const tipos = [];

  const api = (metodo, ruta, token, cuerpo) => solicitar(servidor.url, metodo, ruta, { token, cuerpo });
  const nuevoCliente = async () => {
    const c = await crearClienteDePrueba();
    clientes.push(c.id_cliente);
    return c;
  };
  const sinPago = async (idCliente, dIni, dFin, extra = {}) =>
    crearMembresiaDePrueba({ idCliente, idTipo: plan.id_tipo_membresia, inicio: await fechaRelativa(dIni), fin: await fechaRelativa(dFin), ...extra });
  const pagar = (id, cuerpo = {}, token = recepcion.token) => api('POST', '/pagos', token, { id_membresia: id, metodo_pago: 'efectivo', monto: 450, ...cuerpo });
  const campos = (r) => (r.cuerpo?.error?.details ?? []).map((d) => d.field);

  before(async () => {
    servidor = await iniciarServidor();
    admin = await crearUsuarioConRol('administrador');
    recepcion = await crearUsuarioConRol('recepcionista');
    entrenador = await crearUsuarioConRol('entrenador');
    usuarios.push(admin.id_usuario, recepcion.id_usuario, entrenador.id_usuario);
    plan = await crearTipoMembresiaDePrueba({ precio: '450.00', duracion: 30 });
    tipos.push(plan.id_tipo_membresia);

    const cuentaCliente = await nuevoCliente();
    const cuenta = await api('POST', '/usuarios', admin.token, {
      nombre: 'Cliente pagos',
      correo: cuentaCliente.correo,
      password: 'Secreta123',
      rol: 'cliente',
      id_cliente: cuentaCliente.id_cliente,
    });
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

  describe('permisos y rutas', () => {
    it('sin sesión 401; entrenador y cliente 403; recepcionista y administrador pueden', async () => {
      const c = await nuevoCliente();
      const m = await sinPago(c.id_cliente, 0, 29);
      assert.equal((await pagar(m.id_membresia, {}, null)).status, 401);
      assert.equal((await pagar(m.id_membresia, {}, entrenador.token)).status, 403);
      assert.equal((await pagar(m.id_membresia, {}, tokenCliente)).status, 403);
      assert.equal((await pagar(m.id_membresia, {}, admin.token)).status, 201);
      const d = await nuevoCliente();
      const n = await sinPago(d.id_cliente, 0, 29);
      assert.equal((await pagar(n.id_membresia, {}, recepcion.token)).status, 201);
    });

    it('no existen PUT, PATCH ni DELETE sobre /pagos', async () => {
      for (const metodo of ['PUT', 'PATCH', 'DELETE']) {
        for (const ruta of ['/pagos', '/pagos/1']) {
          const r = await api(metodo, ruta, admin.token, {});
          assert.equal(r.status, 404, `${metodo} ${ruta}`);
        }
      }
    });
  });

  describe('registrar un pago', () => {
    it('por el monto exacto: 201, la membresía queda vigente y sin adeudo, con datos del pago', async () => {
      const c = await nuevoCliente();
      const m = await sinPago(c.id_cliente, 0, 29);
      const r = await pagar(m.id_membresia, { metodo_pago: 'tarjeta' });
      assert.equal(r.status, 201);
      assert.equal(r.cuerpo.membresia.estado, 'vigente');
      assert.equal(r.cuerpo.membresia.adeudo, 0);
      assert.equal(r.cuerpo.pago.monto, 450);
      assert.equal(r.cuerpo.pago.metodo_pago, 'tarjeta');
      assert.ok(r.cuerpo.pago.fecha_pago);
      const [[fila]] = await pool.execute('SELECT * FROM pagos WHERE id_pago = ?', [r.cuerpo.pago.id_pago]);
      assert.equal(fila.id_cliente, c.id_cliente);
      assert.equal(fila.id_membresia, m.id_membresia);
      assert.equal(fila.id_usuario, recepcion.id_usuario);
      assert.equal(fila.estado, 'registrado');
      assert.ok(fila.fecha_pago);
    });

    it('una membresía que empieza después de hoy queda "proxima"', async () => {
      const c = await nuevoCliente();
      const futura = await crearMembresiaDePrueba({ idCliente: c.id_cliente, idTipo: plan.id_tipo_membresia, inicio: await fechaRelativa(5), fin: await fechaRelativa(34) });
      const r = await pagar(futura.id_membresia);
      assert.equal(r.status, 201);
      assert.equal(r.cuerpo.membresia.estado, 'proxima');
    });

    it('acepta el monto como texto y rechaza (400) un monto menor o mayor con el mensaje del monto completo', async () => {
      const c = await nuevoCliente();
      const m = await sinPago(c.id_cliente, 0, 29);
      for (const monto of [449.99, 450.01, 100, 900]) {
        const r = await pagar(m.id_membresia, { monto });
        assert.equal(r.status, 400, String(monto));
        assert.deepEqual(r.cuerpo.error.details, [{ field: 'monto', message: 'El pago debe ser por el monto completo: $450.00.' }]);
      }
      assert.equal((await pagar(m.id_membresia, { monto: '450.00' })).status, 201);
    });

    it('rechaza (400) método ausente o inválido, monto inválido, membresía inválida y campos extra', async () => {
      const c = await nuevoCliente();
      const m = await sinPago(c.id_cliente, 0, 29);
      assert.ok(campos(await pagar(m.id_membresia, { metodo_pago: undefined })).includes('metodo_pago'));
      assert.ok(campos(await pagar(m.id_membresia, { metodo_pago: 'cheque' })).includes('metodo_pago'));
      for (const monto of [0, -450, 'abc', 450.123, null, undefined]) {
        const r = await pagar(m.id_membresia, { monto });
        assert.equal(r.status, 400, String(monto));
        assert.ok(campos(r).includes('monto'));
      }
      assert.equal((await pagar('x')).status, 400);
      assert.equal((await pagar(0)).status, 400);
      assert.equal((await pagar(m.id_membresia, { estado: 'registrado' })).status, 400);
    });

    it('un segundo pago de la misma membresía responde 409 y no crea nada', async () => {
      const c = await nuevoCliente();
      const m = await sinPago(c.id_cliente, 0, 29);
      assert.equal((await pagar(m.id_membresia)).status, 201);
      assert.equal((await pagar(m.id_membresia)).status, 409);
      const [[conteo]] = await pool.execute('SELECT COUNT(*) AS n FROM pagos WHERE id_membresia = ?', [m.id_membresia]);
      assert.equal(Number(conteo.n), 1);
    });

    it('cancelada, vencida o suspendida responden 409; inexistente 404', async () => {
      const a = await nuevoCliente();
      const cancelada = await sinPago(a.id_cliente, 0, 29, { estado: 'cancelada' });
      assert.equal((await pagar(cancelada.id_membresia)).status, 409);
      const b = await nuevoCliente();
      const vencida = await sinPago(b.id_cliente, -40, -10);
      assert.equal((await pagar(vencida.id_membresia)).status, 409);
      const s = await nuevoCliente();
      const suspendida = await sinPago(s.id_cliente, 0, 29, { estado: 'suspendida' });
      assert.equal((await pagar(suspendida.id_membresia)).status, 409);
      assert.equal((await pagar(999999999)).status, 404);
    });

    it('si el precio del plan cambió, se exige el precio vigente', async () => {
      const otro = await crearTipoMembresiaDePrueba({ precio: '300.00', duracion: 30 });
      tipos.push(otro.id_tipo_membresia);
      const c = await nuevoCliente();
      const m = await crearMembresiaDePrueba({ idCliente: c.id_cliente, idTipo: otro.id_tipo_membresia, inicio: await fechaRelativa(0), fin: await fechaRelativa(29) });
      await pool.execute("UPDATE tipos_membresia SET precio = '350.00' WHERE id_tipo_membresia = ?", [otro.id_tipo_membresia]);
      const mal = await pagar(m.id_membresia, { monto: 300 });
      assert.equal(mal.status, 400);
      assert.equal(mal.cuerpo.error.details[0].message, 'El pago debe ser por el monto completo: $350.00.');
      assert.equal((await pagar(m.id_membresia, { monto: 350 })).status, 201);
    });

    it('una vez pagada conserva el monto aunque el plan cambie de precio', async () => {
      const otro = await crearTipoMembresiaDePrueba({ precio: '300.00', duracion: 30 });
      tipos.push(otro.id_tipo_membresia);
      const c = await nuevoCliente();
      const m = await crearMembresiaDePrueba({ idCliente: c.id_cliente, idTipo: otro.id_tipo_membresia, inicio: await fechaRelativa(0), fin: await fechaRelativa(29) });
      assert.equal((await pagar(m.id_membresia, { monto: 300 })).status, 201);
      await pool.execute("UPDATE tipos_membresia SET precio = '999.00' WHERE id_tipo_membresia = ?", [otro.id_tipo_membresia]);
      const r = await api('GET', `/clientes/${c.id_cliente}/membresias`, admin.token);
      assert.equal(r.cuerpo.actual.precio, 300);
      assert.equal(r.cuerpo.actual.adeudo, 0);
    });

    it('dos pagos simultáneos de la misma membresía: uno 201 y uno 409', async () => {
      const c = await nuevoCliente();
      const m = await sinPago(c.id_cliente, 0, 29);
      const resultados = await Promise.all([pagar(m.id_membresia), pagar(m.id_membresia), pagar(m.id_membresia, {}, admin.token)]);
      assert.deepEqual(resultados.map((r) => r.status).sort(), [201, 409, 409]);
      const [[conteo]] = await pool.execute('SELECT COUNT(*) AS n FROM pagos WHERE id_membresia = ?', [m.id_membresia]);
      assert.equal(Number(conteo.n), 1);
    });

    it('deja constancia en la auditoría sin datos sensibles', async () => {
      const c = await nuevoCliente();
      const m = await sinPago(c.id_cliente, 0, 29);
      const r = await pagar(m.id_membresia);
      const [filas] = await pool.execute(
        "SELECT descripcion, resultado FROM auditoria WHERE modulo = 'pagos' AND accion = 'registrar' AND descripcion LIKE ?",
        [`Pago ${r.cuerpo.pago.id_pago} %`],
      );
      assert.equal(filas.length, 1);
      assert.equal(filas[0].resultado, 'exito');
    });
  });

  describe('asignar y renovar con pago en la misma operación', () => {
    const tipoId = () => plan.id_tipo_membresia;

    it('asignar con pago crea membresía y pago: queda vigente', async () => {
      const c = await nuevoCliente();
      const r = await api('POST', `/clientes/${c.id_cliente}/membresias`, recepcion.token, {
        id_tipo_membresia: tipoId(),
        pago: { metodo_pago: 'transferencia', monto: 450 },
      });
      assert.equal(r.status, 201);
      assert.equal(r.cuerpo.membresia.estado, 'vigente');
      assert.equal(r.cuerpo.membresia.adeudo, 0);
      assert.equal(r.cuerpo.pago.metodo_pago, 'transferencia');
      assert.equal(r.cuerpo.pago.monto, 450);
    });

    it('asignar con monto incorrecto responde 400 y no crea ni la membresía ni el pago', async () => {
      const c = await nuevoCliente();
      const r = await api('POST', `/clientes/${c.id_cliente}/membresias`, recepcion.token, {
        id_tipo_membresia: tipoId(),
        pago: { metodo_pago: 'efectivo', monto: 100 },
      });
      assert.equal(r.status, 400);
      assert.deepEqual(r.cuerpo.error.details, [{ field: 'pago.monto', message: 'El pago debe ser por el monto completo: $450.00.' }]);
      const [[m]] = await pool.execute('SELECT COUNT(*) AS n FROM membresias WHERE id_cliente = ?', [c.id_cliente]);
      const [[p]] = await pool.execute('SELECT COUNT(*) AS n FROM pagos WHERE id_cliente = ?', [c.id_cliente]);
      assert.equal(Number(m.n), 0);
      assert.equal(Number(p.n), 0);
    });

    it('un pago anidado con método inválido responde 400', async () => {
      const c = await nuevoCliente();
      const r = await api('POST', `/clientes/${c.id_cliente}/membresias`, recepcion.token, {
        id_tipo_membresia: tipoId(),
        pago: { metodo_pago: 'cheque', monto: 450 },
      });
      assert.equal(r.status, 400);
      assert.ok(campos(r).includes('pago.metodo_pago'));
    });

    it('renovar con pago crea la renovación pagada ("proxima" si empieza después de hoy)', async () => {
      const c = await nuevoCliente();
      const actual = await crearMembresiaDePrueba({
        idCliente: c.id_cliente,
        idTipo: tipoId(),
        inicio: await fechaRelativa(-20),
        fin: await fechaRelativa(10),
        pagada: true,
      });
      const r = await api('POST', `/membresias/${actual.id_membresia}/renovar`, recepcion.token, { pago: { metodo_pago: 'efectivo', monto: 450 } });
      assert.equal(r.status, 201);
      assert.equal(r.cuerpo.membresia.estado, 'proxima');
      assert.equal(r.cuerpo.membresia.adeudo, 0);
      assert.equal(r.cuerpo.pago.monto, 450);
    });

    it('renovar con monto incorrecto responde 400 y no crea la renovación', async () => {
      const c = await nuevoCliente();
      const actual = await crearMembresiaDePrueba({
        idCliente: c.id_cliente,
        idTipo: tipoId(),
        inicio: await fechaRelativa(-20),
        fin: await fechaRelativa(10),
        pagada: true,
      });
      const r = await api('POST', `/membresias/${actual.id_membresia}/renovar`, recepcion.token, { pago: { metodo_pago: 'efectivo', monto: 1 } });
      assert.equal(r.status, 400);
      const [[m]] = await pool.execute('SELECT COUNT(*) AS n FROM membresias WHERE id_cliente = ?', [c.id_cliente]);
      assert.equal(Number(m.n), 1);
    });
  });
});
