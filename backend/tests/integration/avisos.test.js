import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
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

// Avisos de membresías por vencer y vencidas (US12, FR-054 a FR-058, SC-016 a SC-019) sobre gymaccess_test.
// Cada caso es un cliente propio; se buscan por id para no depender de otros datos de la base.

describe('GET /avisos', () => {
  let servidor;
  let admin;
  let recepcion;
  let entrenador;
  let plan;
  const usuarios = [];
  const clientes = [];
  const tipos = [];
  const casos = {};
  const marca = `Avi${process.pid}${Date.now() % 100000}`;

  const api = (token, ruta = '/avisos') => solicitar(servidor.url, 'GET', ruta, { token });

  // Crea un cliente con las membresías dadas: [{ inicio, fin, pagada, estado }] en días relativos a hoy.
  const caso = async (clave, membresias, { estadoCliente = 'activo' } = {}) => {
    const c = await crearClienteDePrueba({ nombre: clave, apellido: marca, estado: estadoCliente });
    clientes.push(c.id_cliente);
    const ids = [];
    for (const m of membresias) {
      const r = await crearMembresiaDePrueba({
        idCliente: c.id_cliente, idTipo: plan.id_tipo_membresia,
        inicio: await fechaRelativa(m.inicio), fin: await fechaRelativa(m.fin),
        pagada: m.pagada ?? true, estado: m.estado ?? 'activa',
      });
      ids.push(r.id_membresia);
    }
    casos[clave] = { ...c, membresias: ids };
  };
  const delCliente = (cuerpo, clave) => cuerpo.avisos.filter((a) => a.cliente.id_cliente === casos[clave].id_cliente);

  before(async () => {
    servidor = await iniciarServidor();
    admin = await crearUsuarioConRol('administrador');
    recepcion = await crearUsuarioConRol('recepcionista');
    entrenador = await crearUsuarioConRol('entrenador');
    usuarios.push(admin.id_usuario, recepcion.id_usuario, entrenador.id_usuario);
    plan = await crearTipoMembresiaDePrueba({ precio: '450.00', duracion: 30 });
    tipos.push(plan.id_tipo_membresia);

    // Aparecen
    await caso('Hoy', [{ inicio: -29, fin: 0 }]);
    await caso('Tres', [{ inicio: -26, fin: 3 }]);
    await caso('Cinco', [{ inicio: -24, fin: 5 }]);
    await caso('VencioUno', [{ inicio: -30, fin: -1 }]);
    await caso('VencioSiete', [{ inicio: -36, fin: -7 }]);
    await caso('RenovacionSinPagar', [{ inicio: -27, fin: 2 }, { inicio: 3, fin: 32, pagada: false }]);
    // No aparecen
    await caso('Seis', [{ inicio: -23, fin: 6 }]);
    await caso('VencioOcho', [{ inicio: -37, fin: -8 }]);
    await caso('RenovacionPagada', [{ inicio: -27, fin: 2 }, { inicio: 3, fin: 32 }]);
    await caso('VencioYRenovo', [{ inicio: -31, fin: -2 }, { inicio: 0, fin: 29 }]);
    await caso('Suspendida', [{ inicio: -27, fin: 2, estado: 'suspendida' }]);
    await caso('Cancelada', [{ inicio: -27, fin: 2, estado: 'cancelada' }]);
    await caso('Pendiente', [{ inicio: -27, fin: 2, pagada: false }]);
    await caso('VencidaSinPagar', [{ inicio: -31, fin: -2, pagada: false }]);
    await caso('Baja', [{ inicio: -27, fin: 2 }], { estadoCliente: 'inactivo' });
  });

  after(async () => {
    try {
      await limpiarDatosDePrueba({ usuarios, clientes, tipos });
    } finally {
      await servidor.cerrar();
      await cerrarPool();
    }
  });

  it('el personal ve exactamente los avisos esperados, con su texto de días (SC-016)', async () => {
    for (const token of [admin.token, recepcion.token]) {
      const { status, cuerpo } = await api(token);
      assert.equal(status, 200);
      const esperados = { Hoy: 0, Tres: 3, Cinco: 5, VencioUno: -1, VencioSiete: -7, RenovacionSinPagar: 2 };
      for (const [clave, dias] of Object.entries(esperados)) {
        const avisos = delCliente(cuerpo, clave);
        assert.equal(avisos.length, 1, `${clave} tiene un aviso`);
        assert.equal(avisos[0].dias, dias, `${clave}: días`);
        assert.equal(avisos[0].tipo, dias < 0 ? 'vencida' : 'por_vencer');
        assert.equal(avisos[0].plan, plan.nombre);
        assert.equal(avisos[0].id_membresia, casos[clave].membresias[0]);
        assert.match(avisos[0].fecha_fin, /^\d{4}-\d{2}-\d{2}$/);
      }
      for (const clave of ['Seis', 'VencioOcho', 'RenovacionPagada', 'VencioYRenovo', 'Suspendida', 'Cancelada', 'Pendiente', 'VencidaSinPagar', 'Baja']) {
        assert.equal(delCliente(cuerpo, clave).length, 0, `${clave} no tiene aviso`);
      }
    }
  });

  it('el total coincide con la lista y las vencidas van primero (SC-017, FR-057)', async () => {
    const { cuerpo } = await api(admin.token);
    assert.equal(cuerpo.total, cuerpo.avisos.length);
    const dias = cuerpo.avisos.map((a) => a.dias);
    assert.deepEqual(dias, [...dias].sort((a, b) => a - b));
    assert.deepEqual(Object.keys(cuerpo.avisos[0]).sort(), ['cliente', 'dias', 'fecha_fin', 'id_membresia', 'plan', 'tipo']);
    assert.deepEqual(Object.keys(cuerpo.avisos[0].cliente).sort(), ['apellido', 'id_cliente', 'nombre']);
    sinBiometria(cuerpo);
  });

  it('el cliente ve solo su aviso, aunque intente pedir el de otro (SC-018)', async () => {
    const cuenta = await solicitar(servidor.url, 'POST', '/usuarios', {
      token: admin.token,
      cuerpo: { nombre: 'Cuenta Tres', correo: casos.Tres.correo, password: 'Secreta123', rol: 'cliente', id_cliente: casos.Tres.id_cliente },
    });
    usuarios.push(cuenta.cuerpo.id_usuario);
    const token = crearToken(cuenta.cuerpo.id_usuario);
    for (const ruta of ['/avisos', `/avisos?id_cliente=${casos.Hoy.id_cliente}`]) {
      const { status, cuerpo } = await api(token, ruta);
      assert.equal(status, 200);
      assert.equal(cuerpo.total, 1);
      assert.equal(cuerpo.avisos[0].cliente.id_cliente, casos.Tres.id_cliente);
    }
  });

  it('un cliente sin avisos recibe una lista vacía', async () => {
    const cuenta = await solicitar(servidor.url, 'POST', '/usuarios', {
      token: admin.token,
      cuerpo: { nombre: 'Cuenta Seis', correo: casos.Seis.correo, password: 'Secreta123', rol: 'cliente', id_cliente: casos.Seis.id_cliente },
    });
    usuarios.push(cuenta.cuerpo.id_usuario);
    const { cuerpo } = await api(crearToken(cuenta.cuerpo.id_usuario));
    assert.deepEqual(cuerpo, { total: 0, avisos: [] });
  });

  it('el entrenador recibe 403 y sin sesión 401', async () => {
    assert.equal((await api(entrenador.token)).status, 403);
    assert.equal((await solicitar(servidor.url, 'GET', '/avisos')).status, 401);
  });

  it('al renovar y pagar, el aviso desaparece', async () => {
    const r = await solicitar(servidor.url, 'POST', `/membresias/${casos.Tres.membresias[0]}/renovar`, {
      token: recepcion.token, cuerpo: {},
    });
    assert.equal(r.status, 201);
    assert.equal(delCliente((await api(admin.token)).cuerpo, 'Tres').length, 1, 'renovada sin pagar: el aviso sigue');
    const idNueva = r.cuerpo.membresia.id_membresia;
    const pago = await solicitar(servidor.url, 'POST', '/pagos', {
      token: recepcion.token, cuerpo: { id_membresia: idNueva, metodo_pago: 'efectivo', monto: 450 },
    });
    assert.equal(pago.status, 201);
    assert.equal(delCliente((await api(admin.token)).cuerpo, 'Tres').length, 0, 'renovada y pagada: sin aviso');
  });

  it('la lista responde en menos de 2 segundos (SC-019)', async () => {
    const inicio = performance.now();
    await api(admin.token);
    assert.ok(performance.now() - inicio < 2000);
  });
});
