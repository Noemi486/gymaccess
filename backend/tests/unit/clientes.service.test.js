import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearClientesService } from '../../src/services/clientes.service.js';

// Modelos simulados en memoria: la prueba no toca la base de datos.
function crearEntorno({ clientes = [], cuentas = [] } = {}) {
  const tabla = new Map(clientes.map((c) => [c.id_cliente, { ...c }]));
  let siguienteId = 500;

  const modelo = {
    async buscarPorId(id) {
      return tabla.get(id) ?? null;
    },
    async buscarPorCorreo(correo) {
      return [...tabla.values()].find((c) => c.correo === correo) ?? null;
    },
    async crear(datos) {
      siguienteId += 1;
      tabla.set(siguienteId, {
        id_cliente: siguienteId,
        fecha_registro: new Date('2026-10-07T10:00:00Z'),
        estado: 'activo',
        ...datos,
      });
      return siguienteId;
    },
    async actualizar(id, campos) {
      for (const [clave, valor] of Object.entries(campos)) {
        if (valor !== undefined) tabla.get(id)[clave] = valor;
      }
    },
    async cambiarEstado(id, estado) {
      tabla.get(id).estado = estado;
    },
  };

  const servicio = crearClientesService({
    modelo,
    usuariosModelo: {
      buscarPorIdCliente: async (idCliente) => cuentas.find((u) => u.id_cliente === idCliente) ?? null,
    },
    conTransaccion: async (callback) => callback({}),
  });

  return { servicio, tabla };
}

const cliente = (id, extra = {}) => ({
  id_cliente: id,
  nombre: 'Ana',
  apellido: 'Pérez',
  correo: `ana${id}@example.com`,
  telefono: '555 123 4567',
  direccion: 'Calle 1',
  fecha_registro: new Date('2026-10-01T10:00:00Z'),
  estado: 'activo',
  ...extra,
});

const recepcion = { id_usuario: 2, rol: 'recepcionista' };
const admin = { id_usuario: 1, rol: 'administrador' };
const entrenador = { id_usuario: 3, rol: 'entrenador' };
const clienteRol = { id_usuario: 4, rol: 'cliente', id_cliente: 10 };

const datosValidos = (extra = {}) => ({
  nombre: 'Luis',
  apellido: 'Gómez',
  telefono: '555-000-1111',
  ...extra,
});

describe('clientes.service.crear', () => {
  let entorno;
  beforeEach(() => {
    entorno = crearEntorno({ clientes: [cliente(10, { correo: 'ocupado@example.com' })] });
  });

  it('crea un cliente con solo nombre, apellido y teléfono; correo y dirección quedan en null', async () => {
    const creado = await entorno.servicio.crear(datosValidos(), recepcion);

    assert.equal(creado.nombre, 'Luis');
    assert.equal(creado.correo, null);
    assert.equal(creado.direccion, null);
    assert.equal(creado.estado, 'activo');
    assert.ok(creado.fecha_registro);
  });

  it('un correo vacío o en blanco se guarda como null', async () => {
    for (const correo of ['', '   ']) {
      const creado = await entorno.servicio.crear(datosValidos({ correo }), recepcion);
      assert.equal(creado.correo, null);
    }
  });

  it('dos clientes sin correo conviven sin considerarse duplicados', async () => {
    await entorno.servicio.crear(datosValidos({ correo: '' }), recepcion);
    const segundo = await entorno.servicio.crear(datosValidos({ nombre: 'Otro', correo: '' }), recepcion);
    assert.equal(segundo.correo, null);
  });

  it('normaliza el correo (minúsculas y sin espacios)', async () => {
    const creado = await entorno.servicio.crear(datosValidos({ correo: '  Luis@Example.COM ' }), admin);
    assert.equal(creado.correo, 'luis@example.com');
  });

  it('un correo ya registrado en otro cliente da 409 indicando el campo', async () => {
    await assert.rejects(entorno.servicio.crear(datosValidos({ correo: 'OCUPADO@example.com' }), recepcion), (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.details[0].field, 'correo');
      return true;
    });
  });

  it('si faltan nombre, apellido o teléfono da 400 indicando el campo faltante', async () => {
    for (const campo of ['nombre', 'apellido', 'telefono']) {
      const datos = datosValidos();
      delete datos[campo];
      await assert.rejects(entorno.servicio.crear(datos, recepcion), (error) => {
        assert.equal(error.status, 400);
        assert.equal(error.details[0].field, campo);
        return true;
      });
      await assert.rejects(entorno.servicio.crear({ ...datos, [campo]: '   ' }, recepcion), { status: 400 });
    }
  });

  it('solo administrador y recepcionista pueden registrar clientes (403 para entrenador y cliente)', async () => {
    await assert.rejects(entorno.servicio.crear(datosValidos(), entrenador), { status: 403 });
    await assert.rejects(entorno.servicio.crear(datosValidos(), clienteRol), { status: 403 });
    assert.ok(await entorno.servicio.crear(datosValidos(), admin));
  });
});

describe('clientes.service.actualizar', () => {
  let entorno;
  beforeEach(() => {
    entorno = crearEntorno({
      clientes: [
        cliente(10, { correo: 'conCuenta@example.com'.toLowerCase() }),
        cliente(11, { correo: 'libre@example.com' }),
        cliente(12, { correo: 'otro@example.com' }),
      ],
      cuentas: [{ id_usuario: 40, rol: 'cliente', id_cliente: 10, correo: 'concuenta@example.com' }],
    });
  });

  it('modifica el teléfono sin tocar el resto', async () => {
    const actualizado = await entorno.servicio.actualizar(11, { telefono: '555 999 8888' }, recepcion);
    assert.equal(actualizado.telefono, '555 999 8888');
    assert.equal(actualizado.nombre, 'Ana');
    assert.equal(actualizado.correo, 'libre@example.com');
  });

  it('responde 404 si el cliente no existe', async () => {
    await assert.rejects(entorno.servicio.actualizar(999, { nombre: 'X' }, recepcion), { status: 404 });
  });

  it('rechaza un correo que ya tiene otro cliente (409) pero acepta repetir el propio', async () => {
    await assert.rejects(entorno.servicio.actualizar(11, { correo: 'otro@example.com' }, recepcion), {
      status: 409,
    });
    const mismo = await entorno.servicio.actualizar(11, { correo: 'LIBRE@example.com' }, recepcion);
    assert.equal(mismo.correo, 'libre@example.com');
  });

  it('permite quitar el correo a un cliente sin cuenta (queda null)', async () => {
    const actualizado = await entorno.servicio.actualizar(11, { correo: '' }, recepcion);
    assert.equal(actualizado.correo, null);
  });

  it('no permite cambiar el correo de un cliente que tiene cuenta (409)', async () => {
    await assert.rejects(entorno.servicio.actualizar(10, { correo: 'nuevo@example.com' }, recepcion), (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.details[0].field, 'correo');
      return true;
    });
  });

  it('no permite quitar el correo de un cliente que tiene cuenta (409)', async () => {
    await assert.rejects(entorno.servicio.actualizar(10, { correo: null }, recepcion), { status: 409 });
    await assert.rejects(entorno.servicio.actualizar(10, { correo: '  ' }, recepcion), { status: 409 });
    assert.equal(entorno.tabla.get(10).correo, 'concuenta@example.com');
  });

  it('un cliente con cuenta sí puede cambiar otros datos o repetir su mismo correo', async () => {
    const actualizado = await entorno.servicio.actualizar(
      10,
      { telefono: '555 111 2222', correo: 'concuenta@example.com' },
      admin,
    );
    assert.equal(actualizado.telefono, '555 111 2222');
  });

  it('rechaza dejar nombre, apellido o teléfono en blanco (400)', async () => {
    for (const campo of ['nombre', 'apellido', 'telefono']) {
      await assert.rejects(entorno.servicio.actualizar(11, { [campo]: '  ' }, recepcion), (error) => {
        assert.equal(error.status, 400);
        assert.equal(error.details[0].field, campo);
        return true;
      });
    }
  });

  it('el entrenador y el cliente no pueden modificar clientes (403)', async () => {
    await assert.rejects(entorno.servicio.actualizar(11, { nombre: 'X' }, entrenador), { status: 403 });
    await assert.rejects(entorno.servicio.actualizar(11, { nombre: 'X' }, clienteRol), { status: 403 });
  });
});

describe('clientes.service.cambiarEstado (baja lógica)', () => {
  let entorno;
  beforeEach(() => {
    entorno = crearEntorno({ clientes: [cliente(10)] });
  });

  it('el administrador da de baja y reactiva sin eliminar el registro', async () => {
    const baja = await entorno.servicio.cambiarEstado(10, 'inactivo', admin);
    assert.equal(baja.estado, 'inactivo');
    assert.ok(entorno.tabla.has(10), 'el registro se conserva');

    const alta = await entorno.servicio.cambiarEstado(10, 'activo', admin);
    assert.equal(alta.estado, 'activo');
  });

  it('el recepcionista, el entrenador y el cliente no pueden cambiar el estado (403)', async () => {
    for (const actor of [recepcion, entrenador, clienteRol]) {
      await assert.rejects(entorno.servicio.cambiarEstado(10, 'inactivo', actor), { status: 403 });
    }
    assert.equal(entorno.tabla.get(10).estado, 'activo');
  });

  it('responde 404 si el cliente no existe', async () => {
    await assert.rejects(entorno.servicio.cambiarEstado(999, 'inactivo', admin), { status: 404 });
  });
});

describe('clientes.service.obtenerPropio (información propia del cliente, FR-020)', () => {
  const entorno = crearEntorno({
    clientes: [cliente(10, { nombre: 'Propia' }), cliente(11, { nombre: 'Ajena', telefono: '999 999 9999' })],
  });
  const actor = { id_usuario: 4, rol: 'cliente', id_cliente: 10 };

  it('devuelve todos los datos del cliente vinculado a la sesión', async () => {
    const propio = await entorno.servicio.obtenerPropio(actor);
    assert.equal(propio.id_cliente, 10);
    assert.equal(propio.nombre, 'Propia');
    assert.equal(propio.telefono, '555 123 4567');
    assert.equal(propio.correo, 'ana10@example.com');
  });

  it('usa solo el id_cliente de la sesión: nunca devuelve datos de otro cliente', async () => {
    const propio = await entorno.servicio.obtenerPropio({ ...actor, id_cliente: 10 });
    assert.ok(!JSON.stringify(propio).includes('999 999 9999'));
    assert.ok(!JSON.stringify(propio).includes('Ajena'));
  });

  it('solo el rol cliente puede usarlo (403 para el personal)', async () => {
    for (const rol of ['administrador', 'recepcionista', 'entrenador']) {
      await assert.rejects(entorno.servicio.obtenerPropio({ id_usuario: 1, rol, id_cliente: null }), { status: 403 });
    }
  });

  it('responde 404 si el cliente vinculado ya no existe o la sesión no tiene cliente', async () => {
    await assert.rejects(entorno.servicio.obtenerPropio({ ...actor, id_cliente: 999 }), { status: 404 });
    await assert.rejects(entorno.servicio.obtenerPropio({ ...actor, id_cliente: null }), { status: 404 });
  });
});
