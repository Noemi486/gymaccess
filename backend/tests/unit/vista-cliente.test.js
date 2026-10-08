import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { vistaCliente } from '../../src/utils/vistaCliente.js';
import { crearClientesService } from '../../src/services/clientes.service.js';

const fila = {
  id_cliente: 7,
  nombre: 'Ana',
  apellido: 'Pérez',
  correo: 'ana@example.com',
  telefono: '555 123 4567',
  direccion: 'Calle 1 #2',
  fecha_registro: new Date('2026-10-01T10:00:00Z'),
  estado: 'activo',
  // Una columna que no debe salir nunca aunque llegara en la fila.
  campo_interno: 'no-debe-salir',
};

const TODOS = ['id_cliente', 'nombre', 'apellido', 'correo', 'telefono', 'direccion', 'fecha_registro', 'estado'];
const BASICOS = ['id_cliente', 'nombre', 'apellido', 'estado', 'fecha_registro'];

describe('vistaCliente (qué datos ve cada rol, FR-019)', () => {
  it('el administrador y el recepcionista reciben todos los campos', () => {
    for (const rol of ['administrador', 'recepcionista']) {
      const vista = vistaCliente(fila, rol);
      assert.deepEqual(Object.keys(vista).sort(), [...TODOS].sort(), rol);
      assert.equal(vista.telefono, '555 123 4567');
      assert.equal(vista.correo, 'ana@example.com');
      assert.equal(vista.direccion, 'Calle 1 #2');
    }
  });

  it('el entrenador recibe solo id_cliente, nombre, apellido, estado y fecha_registro', () => {
    const vista = vistaCliente(fila, 'entrenador');
    assert.deepEqual(Object.keys(vista).sort(), [...BASICOS].sort());
    const texto = JSON.stringify(vista);
    assert.ok(!texto.includes('555 123 4567'), 'sin teléfono');
    assert.ok(!texto.includes('ana@example.com'), 'sin correo');
    assert.ok(!texto.includes('Calle 1'), 'sin dirección');
  });

  it('cualquier otro rol o un rol desconocido recibe solo la vista básica (negar por defecto)', () => {
    for (const rol of ['cliente', 'invitado', undefined, null]) {
      assert.deepEqual(Object.keys(vistaCliente(fila, rol)).sort(), [...BASICOS].sort(), String(rol));
    }
  });

  it('no incluye columnas ajenas al contrato', () => {
    for (const rol of ['administrador', 'recepcionista', 'entrenador']) {
      assert.ok(!('campo_interno' in vistaCliente(fila, rol)), rol);
    }
  });

  it('un cliente sin correo ni dirección se muestra con null en la vista completa', () => {
    const vista = vistaCliente({ ...fila, correo: undefined, direccion: undefined }, 'recepcionista');
    assert.equal(vista.correo, null);
    assert.equal(vista.direccion, null);
  });
});

describe('clientes.service.listar y obtener', () => {
  const filas = [
    { ...fila, id_cliente: 1 },
    { ...fila, id_cliente: 2, nombre: 'Beto', correo: null },
    { ...fila, id_cliente: 3, nombre: 'Clara', estado: 'inactivo' },
  ];
  let ultimaConsulta;
  const servicio = crearClientesService({
    modelo: {
      async listar(consulta) {
        ultimaConsulta = consulta;
        return { filas: filas.slice(consulta.offset, consulta.offset + consulta.limit), total: filas.length };
      },
      async buscarPorId(id) {
        return filas.find((f) => f.id_cliente === id) ?? null;
      },
    },
    usuariosModelo: {},
    conTransaccion: async (callback) => callback({}),
  });
  const paginacion = { page: 1, limit: 20, offset: 0 };

  it('lista con la vista completa para recepcionista y administrador', async () => {
    for (const rol of ['recepcionista', 'administrador']) {
      const { data, total, page, limit } = await servicio.listar(paginacion, { rol });
      assert.equal(total, 3);
      assert.equal(page, 1);
      assert.equal(limit, 20);
      assert.ok(data.every((c) => 'telefono' in c && 'correo' in c && 'direccion' in c), rol);
    }
  });

  it('lista con la vista básica para el entrenador, en lista y en detalle', async () => {
    const { data } = await servicio.listar(paginacion, { rol: 'entrenador' });
    assert.ok(data.every((c) => !('telefono' in c) && !('correo' in c) && !('direccion' in c)));
    const detalle = await servicio.obtener(1, { rol: 'entrenador' });
    assert.deepEqual(Object.keys(detalle).sort(), [...BASICOS].sort());
  });

  it('el entrenador no busca por correo (no puede ver ese dato); el personal con acceso completo sí', async () => {
    await servicio.listar({ ...paginacion, q: 'ana@example.com' }, { rol: 'entrenador' });
    assert.equal(ultimaConsulta.buscarEnCorreo, false);
    await servicio.listar({ ...paginacion, q: 'ana@example.com' }, { rol: 'recepcionista' });
    assert.equal(ultimaConsulta.buscarEnCorreo, true);
    await servicio.listar({ ...paginacion, q: 'ana@example.com' }, { rol: 'administrador' });
    assert.equal(ultimaConsulta.buscarEnCorreo, true);
  });

  it('pasa al modelo la búsqueda, el estado y la paginación', async () => {
    await servicio.listar({ q: 'ana', estado: 'inactivo', page: 2, limit: 10, offset: 10 }, { rol: 'administrador' });
    assert.equal(ultimaConsulta.q, 'ana');
    assert.equal(ultimaConsulta.estado, 'inactivo');
    assert.equal(ultimaConsulta.limit, 10);
    assert.equal(ultimaConsulta.offset, 10);
  });

  it('para_cuenta (clientes disponibles para crear una cuenta) es solo del administrador', async () => {
    await servicio.listar({ ...paginacion, paraCuenta: true }, { rol: 'administrador' });
    assert.equal(ultimaConsulta.paraCuenta, true);

    for (const rol of ['recepcionista', 'entrenador']) {
      await assert.rejects(servicio.listar({ ...paginacion, paraCuenta: true }, { rol }), { status: 403 }, rol);
    }
    // Sin el filtro, el personal sigue consultando con normalidad.
    await servicio.listar(paginacion, { rol: 'recepcionista' });
    assert.equal(ultimaConsulta.paraCuenta, false);
  });

  it('obtener responde 404 si el cliente no existe', async () => {
    await assert.rejects(servicio.obtener(999, { rol: 'recepcionista' }), { status: 404 });
  });

  it('el rol cliente no puede listar ni consultar clientes ajenos (403)', async () => {
    const actor = { rol: 'cliente', id_cliente: 1 };
    await assert.rejects(servicio.listar(paginacion, actor), { status: 403 });
    await assert.rejects(servicio.obtener(2, actor), { status: 403 });
  });
});
