import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearUsuariosService } from '../../src/services/usuarios.service.js';

// Modelos simulados en memoria: la prueba no toca la base de datos.
function crearEntorno({ usuarios = [], clientes = [] } = {}) {
  const tablaUsuarios = new Map(usuarios.map((u) => [u.id_usuario, { ...u }]));
  const tablaClientes = new Map(clientes.map((c) => [c.id_cliente, { ...c }]));
  let siguienteId = 100;

  const modelo = {
    async listar({ rol, estado, limit, offset }) {
      let filas = [...tablaUsuarios.values()];
      if (rol) filas = filas.filter((u) => u.rol === rol);
      if (estado) filas = filas.filter((u) => u.estado === estado);
      return { filas: filas.slice(offset, offset + limit), total: filas.length };
    },
    async buscarPorId(id) {
      return tablaUsuarios.get(id) ?? null;
    },
    async buscarPorCorreo(correo) {
      return [...tablaUsuarios.values()].find((u) => u.correo === correo) ?? null;
    },
    async buscarPorIdCliente(idCliente) {
      return [...tablaUsuarios.values()].find((u) => u.id_cliente === idCliente) ?? null;
    },
    async crear(datos) {
      siguienteId += 1;
      tablaUsuarios.set(siguienteId, {
        id_usuario: siguienteId,
        estado: 'activo',
        fecha_registro: new Date('2026-10-07T10:00:00Z'),
        ...datos,
      });
      return siguienteId;
    },
    async actualizar(id, campos) {
      // Igual que el modelo real: los campos undefined no se tocan.
      for (const [clave, valor] of Object.entries(campos)) {
        if (valor !== undefined) tablaUsuarios.get(id)[clave] = valor;
      }
    },
    async contarAdministradoresActivos() {
      return [...tablaUsuarios.values()].filter((u) => u.rol === 'administrador' && u.estado === 'activo').length;
    },
  };

  const servicio = crearUsuariosService({
    modelo,
    clientesModelo: { buscarPorId: async (id) => tablaClientes.get(id) ?? null },
    conTransaccion: async (callback) => callback({}),
    hashear: async (password) => `hash:${password}`,
  });

  return { servicio, tablaUsuarios };
}

const usuario = (id, extra = {}) => ({
  id_usuario: id,
  nombre: `Usuario ${id}`,
  correo: `u${id}@example.com`,
  password: 'hash:Existente123',
  rol: 'recepcionista',
  estado: 'activo',
  id_cliente: null,
  fecha_registro: new Date('2026-10-01T10:00:00Z'),
  ...extra,
});

const nuevo = (extra = {}) => ({
  nombre: 'Nueva Persona',
  correo: 'nueva@example.com',
  password: 'Secreta123',
  rol: 'recepcionista',
  ...extra,
});

describe('usuarios.service.crear', () => {
  let entorno;
  beforeEach(() => {
    entorno = crearEntorno({
      usuarios: [usuario(1, { rol: 'administrador' }), usuario(2, { correo: 'ocupado@example.com' })],
      clientes: [
        { id_cliente: 10, correo: 'cli10@example.com' },
        { id_cliente: 11, correo: null },
        { id_cliente: 12, correo: 'cli12@example.com' },
      ],
    });
  });

  it('crea el usuario con la contraseña hasheada y no devuelve password', async () => {
    const creado = await entorno.servicio.crear(nuevo());

    assert.equal(creado.rol, 'recepcionista');
    assert.equal(creado.correo, 'nueva@example.com');
    assert.equal('password' in creado, false);
    assert.equal(entorno.tablaUsuarios.get(creado.id_usuario).password, 'hash:Secreta123');
  });

  it('rechaza un correo ya en uso con 409 indicando el campo correo', async () => {
    await assert.rejects(entorno.servicio.crear(nuevo({ correo: 'ocupado@example.com' })), (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.details[0].field, 'correo');
      return true;
    });
  });

  it('rechaza contraseñas que no cumplen la política (400, campo password)', async () => {
    for (const password of ['Corta1', 'SoloLetrasAqui', '123456789']) {
      await assert.rejects(entorno.servicio.crear(nuevo({ password })), (error) => {
        assert.equal(error.status, 400);
        assert.equal(error.details[0].field, 'password');
        return true;
      });
    }
  });

  it('el rol cliente exige id_cliente (400)', async () => {
    await assert.rejects(entorno.servicio.crear(nuevo({ rol: 'cliente' })), { status: 400 });
  });

  it('los demás roles prohíben id_cliente (400)', async () => {
    await assert.rejects(entorno.servicio.crear(nuevo({ id_cliente: 10 })), { status: 400 });
  });

  it('el rol cliente con un cliente inexistente responde 404', async () => {
    await assert.rejects(
      entorno.servicio.crear(nuevo({ rol: 'cliente', id_cliente: 999, correo: 'x@example.com' })),
      { status: 404 },
    );
  });

  it('el rol cliente con un cliente sin correo responde 409', async () => {
    await assert.rejects(
      entorno.servicio.crear(nuevo({ rol: 'cliente', id_cliente: 11, correo: 'x@example.com' })),
      { status: 409 },
    );
  });

  it('el rol cliente exige usar el mismo correo del cliente (409)', async () => {
    await assert.rejects(
      entorno.servicio.crear(nuevo({ rol: 'cliente', id_cliente: 10, correo: 'otro@example.com' })),
      { status: 409 },
    );
  });

  it('un cliente solo puede tener una cuenta (409)', async () => {
    await entorno.servicio.crear(nuevo({ rol: 'cliente', id_cliente: 10, correo: 'cli10@example.com' }));
    await assert.rejects(
      entorno.servicio.crear(nuevo({ rol: 'cliente', id_cliente: 10, correo: 'cli10@example.com' })),
      { status: 409 },
    );
  });

  it('crea la cuenta de un cliente con correo y el mismo correo', async () => {
    const creado = await entorno.servicio.crear(
      nuevo({ rol: 'cliente', id_cliente: 12, correo: 'cli12@example.com' }),
    );
    assert.equal(creado.rol, 'cliente');
    assert.equal(creado.id_cliente, 12);
  });
});

describe('usuarios.service.actualizar', () => {
  let entorno;
  beforeEach(() => {
    entorno = crearEntorno({
      usuarios: [
        usuario(1, { rol: 'administrador' }),
        usuario(2, { rol: 'administrador' }),
        usuario(3, { rol: 'recepcionista' }),
        usuario(4, { rol: 'cliente', id_cliente: 10, correo: 'cli10@example.com' }),
      ],
    });
  });

  it('cambia el rol de un usuario', async () => {
    const actualizado = await entorno.servicio.actualizar(3, { rol: 'entrenador' });
    assert.equal(actualizado.rol, 'entrenador');
  });

  it('responde 404 si el usuario no existe', async () => {
    await assert.rejects(entorno.servicio.actualizar(999, { nombre: 'X' }), { status: 404 });
  });

  it('permite desactivar a un administrador si queda otro activo', async () => {
    const actualizado = await entorno.servicio.actualizar(1, { estado: 'inactivo' });
    assert.equal(actualizado.estado, 'inactivo');
  });

  it('no permite desactivar al último administrador activo (409)', async () => {
    await entorno.servicio.actualizar(1, { estado: 'inactivo' });
    await assert.rejects(entorno.servicio.actualizar(2, { estado: 'inactivo' }), { status: 409 });
    assert.equal(entorno.tablaUsuarios.get(2).estado, 'activo');
  });

  it('no permite quitar el rol al último administrador activo (409)', async () => {
    await entorno.servicio.actualizar(1, { estado: 'inactivo' });
    await assert.rejects(entorno.servicio.actualizar(2, { rol: 'recepcionista' }), { status: 409 });
    assert.equal(entorno.tablaUsuarios.get(2).rol, 'administrador');
  });

  it('un administrador inactivo se puede reactivar y su rol cambiar sin esa restricción', async () => {
    await entorno.servicio.actualizar(1, { estado: 'inactivo' });
    const reactivado = await entorno.servicio.actualizar(1, { estado: 'activo' });
    assert.equal(reactivado.estado, 'activo');
    // Al haber de nuevo dos administradores activos, ya se puede bajar uno.
    const bajado = await entorno.servicio.actualizar(2, { rol: 'entrenador' });
    assert.equal(bajado.rol, 'entrenador');
  });

  it('no permite cambiar hacia el rol cliente (409)', async () => {
    await assert.rejects(entorno.servicio.actualizar(3, { rol: 'cliente' }), { status: 409 });
  });

  it('no permite cambiar desde el rol cliente (409)', async () => {
    await assert.rejects(entorno.servicio.actualizar(4, { rol: 'recepcionista' }), { status: 409 });
  });

  it('no permite cambiar el correo de una cuenta de cliente (409)', async () => {
    await assert.rejects(entorno.servicio.actualizar(4, { correo: 'otro@example.com' }), { status: 409 });
  });

  it('rechaza un correo que ya usa otro usuario (409) pero acepta repetir el propio', async () => {
    await assert.rejects(entorno.servicio.actualizar(3, { correo: 'u1@example.com' }), (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.details[0].field, 'correo');
      return true;
    });
    const mismo = await entorno.servicio.actualizar(3, { correo: 'u3@example.com' });
    assert.equal(mismo.correo, 'u3@example.com');
  });

  it('hashea la nueva contraseña y valida la política', async () => {
    await entorno.servicio.actualizar(3, { password: 'NuevaClave456' });
    assert.equal(entorno.tablaUsuarios.get(3).password, 'hash:NuevaClave456');

    await assert.rejects(entorno.servicio.actualizar(3, { password: 'corta' }), { status: 400 });
  });
});

describe('usuarios.service.listar y obtener', () => {
  it('lista sin exponer password y con la paginación solicitada', async () => {
    const { servicio } = crearEntorno({ usuarios: [usuario(1), usuario(2), usuario(3)] });
    const pagina = await servicio.listar({ page: 1, limit: 2, offset: 0 });

    assert.equal(pagina.total, 3);
    assert.equal(pagina.data.length, 2);
    assert.equal(pagina.page, 1);
    assert.equal(pagina.limit, 2);
    assert.ok(pagina.data.every((u) => !('password' in u)));
  });

  it('filtra por rol', async () => {
    const { servicio } = crearEntorno({
      usuarios: [usuario(1, { rol: 'entrenador' }), usuario(2), usuario(3)],
    });
    const pagina = await servicio.listar({ page: 1, limit: 20, offset: 0, rol: 'entrenador' });
    assert.equal(pagina.total, 1);
  });

  it('obtener devuelve el usuario público o 404', async () => {
    const { servicio } = crearEntorno({ usuarios: [usuario(1)] });
    const encontrado = await servicio.obtener(1);
    assert.equal('password' in encontrado, false);
    await assert.rejects(servicio.obtener(99), { status: 404 });
  });
});
