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

// API de tipos de membresía (planes) contra la base de pruebas gymaccess_test.

describe('API de tipos de membresía', () => {
  let servidor;
  let admin;
  let recepcion;
  let entrenador;
  let tokenCliente;
  const usuarios = [];
  const clientes = [];
  const tipos = [];
  const sufijo = `${Date.now()}-${process.pid}`;
  let contador = 0;
  const nombreUnico = () => `Plan test API ${sufijo}-${++contador}`;

  const api = (metodo, ruta, token, cuerpo) => solicitar(servidor.url, metodo, ruta, { token, cuerpo });
  const planValido = (extra = {}) => ({ nombre: nombreUnico(), descripcion: 'Acceso libre', duracion: 30, precio: 450, ...extra });
  const crearPlan = async (extra = {}) => {
    const respuesta = await api('POST', '/tipos-membresia', admin.token, planValido(extra));
    if (respuesta.status === 201) tipos.push(respuesta.cuerpo.id_tipo_membresia);
    return respuesta;
  };
  const camposConError = (respuesta) => (respuesta.cuerpo?.error?.details ?? []).map((d) => d.field);

  before(async () => {
    servidor = await iniciarServidor();
    admin = await crearUsuarioConRol('administrador');
    recepcion = await crearUsuarioConRol('recepcionista');
    entrenador = await crearUsuarioConRol('entrenador');
    usuarios.push(admin.id_usuario, recepcion.id_usuario, entrenador.id_usuario);

    // Una cuenta de cliente (necesita un cliente vinculado).
    const cliente = await crearClienteDePrueba();
    clientes.push(cliente.id_cliente);
    const cuenta = await api('POST', '/usuarios', admin.token, {
      nombre: 'Cliente planes',
      correo: cliente.correo,
      password: 'Secreta123',
      rol: 'cliente',
      id_cliente: cliente.id_cliente,
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

  describe('acceso', () => {
    it('sin sesión responde 401', async () => {
      assert.equal((await api('GET', '/tipos-membresia')).status, 401);
      assert.equal((await api('POST', '/tipos-membresia', undefined, planValido())).status, 401);
    });

    it('el entrenador y el cliente reciben 403 en todas las operaciones', async () => {
      const plan = await crearPlan();
      for (const token of [entrenador.token, tokenCliente]) {
        assert.equal((await api('GET', '/tipos-membresia', token)).status, 403);
        assert.equal((await api('GET', `/tipos-membresia/${plan.cuerpo.id_tipo_membresia}`, token)).status, 403);
        assert.equal((await api('POST', '/tipos-membresia', token, planValido())).status, 403);
        assert.equal((await api('PATCH', `/tipos-membresia/${plan.cuerpo.id_tipo_membresia}`, token, { precio: 1 })).status, 403);
        assert.equal((await api('PATCH', `/tipos-membresia/${plan.cuerpo.id_tipo_membresia}/estado`, token, { estado: 'inactivo' })).status, 403);
      }
    });

    it('el recepcionista consulta pero no puede crear, modificar ni cambiar el estado', async () => {
      const plan = await crearPlan();
      const id = plan.cuerpo.id_tipo_membresia;
      assert.equal((await api('GET', '/tipos-membresia', recepcion.token)).status, 200);
      assert.equal((await api('GET', `/tipos-membresia/${id}`, recepcion.token)).status, 200);
      assert.equal((await api('POST', '/tipos-membresia', recepcion.token, planValido())).status, 403);
      assert.equal((await api('PATCH', `/tipos-membresia/${id}`, recepcion.token, { precio: 1 })).status, 403);
      assert.equal((await api('PATCH', `/tipos-membresia/${id}/estado`, recepcion.token, { estado: 'inactivo' })).status, 403);
    });

    it('no existe DELETE ni PUT', async () => {
      const plan = await crearPlan();
      const id = plan.cuerpo.id_tipo_membresia;
      assert.equal((await api('DELETE', `/tipos-membresia/${id}`, admin.token)).status, 404);
      assert.ok([404, 405].includes((await api('PUT', `/tipos-membresia/${id}`, admin.token, planValido())).status));
    });
  });

  describe('alta y consulta (administrador)', () => {
    it('crea un plan (201) activo y devuelve el precio como número', async () => {
      const nombre = nombreUnico();
      const { status, cuerpo } = await crearPlan({ nombre, descripcion: 'Acceso libre', duracion: 30, precio: 450 });
      assert.equal(status, 201);
      assert.deepEqual(Object.keys(cuerpo).sort(), ['descripcion', 'duracion', 'estado', 'id_tipo_membresia', 'nombre', 'precio']);
      assert.equal(cuerpo.nombre, nombre);
      assert.equal(cuerpo.duracion, 30);
      assert.equal(cuerpo.precio, 450);
      assert.equal(cuerpo.estado, 'activo');
      sinBiometria(cuerpo);
    });

    it('acepta la descripción vacía u omitida y recorta espacios del nombre', async () => {
      const nombre = nombreUnico();
      const { status, cuerpo } = await api('POST', '/tipos-membresia', admin.token, { nombre: `  ${nombre}  `, duracion: 7, precio: '99.50' });
      assert.equal(status, 201);
      tipos.push(cuerpo.id_tipo_membresia);
      assert.equal(cuerpo.nombre, nombre);
      assert.equal(cuerpo.descripcion, null);
      assert.equal(cuerpo.precio, 99.5);
    });

    it('acepta los valores límite válidos', async () => {
      const limites = [
        { nombre: 'N'.repeat(80), duracion: 1, precio: 0.01 },
        { nombre: nombreUnico(), duracion: 3650, precio: 99999999.99 },
        { nombre: nombreUnico(), duracion: 365, precio: '1250.5', descripcion: 'd'.repeat(255) },
      ];
      for (const [i, plan] of limites.entries()) {
        // El nombre de 80 caracteres debe ser único entre ejecuciones.
        const cuerpo = i === 0 ? { ...plan, nombre: `${sufijo}-${'N'.repeat(80)}`.slice(0, 80) } : plan;
        const r = await api('POST', '/tipos-membresia', admin.token, cuerpo);
        assert.equal(r.status, 201, JSON.stringify(r.cuerpo));
        tipos.push(r.cuerpo.id_tipo_membresia);
      }
    });

    it('GET /:id devuelve el plan y la cantidad de membresías pendientes de pago', async () => {
      const plan = await crearPlan();
      const { status, cuerpo } = await api('GET', `/tipos-membresia/${plan.cuerpo.id_tipo_membresia}`, admin.token);
      assert.equal(status, 200);
      assert.equal(cuerpo.nombre, plan.cuerpo.nombre);
      assert.equal(cuerpo.membresias_pendientes_de_pago, 0);
    });

    it('GET /:id responde 404 si no existe y 400 si el id no es numérico', async () => {
      assert.equal((await api('GET', '/tipos-membresia/999999999', admin.token)).status, 404);
      assert.equal((await api('GET', '/tipos-membresia/abc', admin.token)).status, 400);
    });

    it('lista con búsqueda por nombre, filtro de estado y paginación', async () => {
      const marca = `Lista${sufijo}`;
      const a = await crearPlan({ nombre: `${marca} A` });
      await crearPlan({ nombre: `${marca} B` });
      await crearPlan({ nombre: `${marca} C` });
      await api('PATCH', `/tipos-membresia/${a.cuerpo.id_tipo_membresia}/estado`, admin.token, { estado: 'inactivo' });

      const todos = await api('GET', `/tipos-membresia?q=${marca}`, admin.token);
      assert.equal(todos.status, 200);
      assert.equal(todos.cuerpo.total, 3);
      assert.deepEqual(todos.cuerpo.data.map((p) => p.nombre), [`${marca} A`, `${marca} B`, `${marca} C`]);

      const activos = await api('GET', `/tipos-membresia?q=${marca}&estado=activo`, admin.token);
      assert.equal(activos.cuerpo.total, 2);
      const inactivos = await api('GET', `/tipos-membresia?q=${marca}&estado=inactivo`, admin.token);
      assert.equal(inactivos.cuerpo.total, 1);

      const pagina = await api('GET', `/tipos-membresia?q=${marca}&limit=2&page=2`, admin.token);
      assert.equal(pagina.cuerpo.data.length, 1);
      assert.equal(pagina.cuerpo.page, 2);
      assert.equal((await api('GET', '/tipos-membresia?estado=otro', admin.token)).status, 400);
    });
  });

  describe('validaciones', () => {
    const casos = [
      ['nombre ausente', { nombre: undefined }, 'nombre'],
      ['nombre vacío', { nombre: '   ' }, 'nombre'],
      ['nombre de 81 caracteres', { nombre: 'x'.repeat(81) }, 'nombre'],
      ['descripción de 256 caracteres', { descripcion: 'd'.repeat(256) }, 'descripcion'],
      ['duración 0', { duracion: 0 }, 'duracion'],
      ['duración negativa', { duracion: -5 }, 'duracion'],
      ['duración 3651', { duracion: 3651 }, 'duracion'],
      ['duración decimal', { duracion: 1.5 }, 'duracion'],
      ['duración como texto', { duracion: 'treinta' }, 'duracion'],
      ['duración ausente', { duracion: undefined }, 'duracion'],
      ['precio 0', { precio: 0 }, 'precio'],
      ['precio negativo', { precio: -1 }, 'precio'],
      ['precio con tres decimales', { precio: 450.123 }, 'precio'],
      ['precio con tres decimales como texto', { precio: '450.123' }, 'precio'],
      ['precio como texto no numérico', { precio: 'abc' }, 'precio'],
      ['precio mayor al máximo', { precio: 100000000 }, 'precio'],
      ['precio ausente', { precio: undefined }, 'precio'],
    ];
    for (const [nombre, cambio, campo] of casos) {
      it(`rechaza (400) ${nombre}, indicando el campo ${campo}`, async () => {
        const r = await api('POST', '/tipos-membresia', admin.token, planValido(cambio));
        assert.equal(r.status, 400);
        assert.ok(camposConError(r).includes(campo), `debió señalar ${campo}: ${JSON.stringify(r.cuerpo)}`);
      });
    }

    it('rechaza campos que no se pueden enviar (estado, id)', async () => {
      assert.equal((await api('POST', '/tipos-membresia', admin.token, planValido({ estado: 'inactivo' }))).status, 400);
      assert.equal((await api('POST', '/tipos-membresia', admin.token, planValido({ id_tipo_membresia: 1 }))).status, 400);
    });

    it('rechaza (409) un nombre repetido señalando el campo nombre, sin distinguir mayúsculas', async () => {
      const original = await crearPlan();
      const repetido = await api('POST', '/tipos-membresia', admin.token, planValido({ nombre: original.cuerpo.nombre.toUpperCase() }));
      assert.equal(repetido.status, 409);
      assert.ok(camposConError(repetido).includes('nombre'));
    });
  });

  describe('modificación y estado', () => {
    it('modifica solo los campos enviados', async () => {
      const plan = await crearPlan({ precio: 450, duracion: 30 });
      const id = plan.cuerpo.id_tipo_membresia;
      const r = await api('PATCH', `/tipos-membresia/${id}`, admin.token, { precio: 500.5 });
      assert.equal(r.status, 200);
      assert.equal(r.cuerpo.precio, 500.5);
      assert.equal(r.cuerpo.duracion, 30);
      assert.equal(r.cuerpo.nombre, plan.cuerpo.nombre);
    });

    it('permite quitar la descripción con null', async () => {
      const plan = await crearPlan({ descripcion: 'algo' });
      const r = await api('PATCH', `/tipos-membresia/${plan.cuerpo.id_tipo_membresia}`, admin.token, { descripcion: null });
      assert.equal(r.status, 200);
      assert.equal(r.cuerpo.descripcion, null);
    });

    it('rechaza un PATCH vacío, valores inválidos y campos que no se pueden cambiar', async () => {
      const plan = await crearPlan();
      const ruta = `/tipos-membresia/${plan.cuerpo.id_tipo_membresia}`;
      assert.equal((await api('PATCH', ruta, admin.token, {})).status, 400);
      assert.equal((await api('PATCH', ruta, admin.token, { precio: 0 })).status, 400);
      assert.equal((await api('PATCH', ruta, admin.token, { duracion: 3651 })).status, 400);
      assert.equal((await api('PATCH', ruta, admin.token, { estado: 'inactivo' })).status, 400);
      assert.equal((await api('PATCH', '/tipos-membresia/999999999', admin.token, { precio: 5 })).status, 404);
    });

    it('rechaza (409) renombrar con el nombre de otro plan', async () => {
      const a = await crearPlan();
      const b = await crearPlan();
      const r = await api('PATCH', `/tipos-membresia/${b.cuerpo.id_tipo_membresia}`, admin.token, { nombre: a.cuerpo.nombre });
      assert.equal(r.status, 409);
      assert.ok(camposConError(r).includes('nombre'));
    });

    it('desactiva y reactiva un plan sin borrarlo', async () => {
      const plan = await crearPlan();
      const id = plan.cuerpo.id_tipo_membresia;
      const apagado = await api('PATCH', `/tipos-membresia/${id}/estado`, admin.token, { estado: 'inactivo' });
      assert.equal(apagado.status, 200);
      assert.equal(apagado.cuerpo.estado, 'inactivo');
      const [[fila]] = await pool.execute('SELECT estado FROM tipos_membresia WHERE id_tipo_membresia = ?', [id]);
      assert.equal(fila.estado, 'inactivo');
      assert.equal((await api('PATCH', `/tipos-membresia/${id}/estado`, admin.token, { estado: 'activo' })).cuerpo.estado, 'activo');
      assert.equal((await api('PATCH', `/tipos-membresia/${id}/estado`, admin.token, { estado: 'borrado' })).status, 400);
    });

    it('cambiar el precio no modifica el monto de los pagos ya registrados', async () => {
      const cliente = await crearClienteDePrueba();
      clientes.push(cliente.id_cliente);
      const tipo = await crearTipoMembresiaDePrueba({ precio: '450.00' });
      tipos.push(tipo.id_tipo_membresia);
      const m = await crearMembresiaDePrueba({
        idCliente: cliente.id_cliente,
        idTipo: tipo.id_tipo_membresia,
        inicio: await fechaRelativa(0),
        fin: await fechaRelativa(29),
        pagada: true,
      });

      const r = await api('PATCH', `/tipos-membresia/${tipo.id_tipo_membresia}`, admin.token, { precio: 600 });
      assert.equal(r.status, 200);
      assert.equal(r.cuerpo.precio, 600);

      const [[pago]] = await pool.execute('SELECT monto FROM pagos WHERE id_pago = ?', [m.id_pago]);
      assert.equal(Number(pago.monto), 450);
    });
  });

  describe('vista del recepcionista', () => {
    it('solo recibe planes activos aunque pida los inactivos', async () => {
      const marca = `Recep${sufijo}`;
      const activo = await crearPlan({ nombre: `${marca} activo` });
      const inactivo = await crearPlan({ nombre: `${marca} inactivo` });
      await api('PATCH', `/tipos-membresia/${inactivo.cuerpo.id_tipo_membresia}/estado`, admin.token, { estado: 'inactivo' });

      for (const consulta of ['', '&estado=inactivo', '&estado=activo']) {
        const r = await api('GET', `/tipos-membresia?q=${marca}${consulta}`, recepcion.token);
        assert.equal(r.status, 200);
        assert.deepEqual(r.cuerpo.data.map((p) => p.id_tipo_membresia), [activo.cuerpo.id_tipo_membresia]);
      }
    });

    it('un plan inactivo no se puede consultar por id (404)', async () => {
      const plan = await crearPlan();
      const id = plan.cuerpo.id_tipo_membresia;
      await api('PATCH', `/tipos-membresia/${id}/estado`, admin.token, { estado: 'inactivo' });
      assert.equal((await api('GET', `/tipos-membresia/${id}`, recepcion.token)).status, 404);
      assert.equal((await api('GET', `/tipos-membresia/${id}`, admin.token)).status, 200);
    });
  });

  describe('membresías pendientes de pago', () => {
    it('cuenta solo las activas, sin pago y que no han vencido', async () => {
      const cliente = await crearClienteDePrueba();
      clientes.push(cliente.id_cliente);
      const tipo = await crearTipoMembresiaDePrueba();
      tipos.push(tipo.id_tipo_membresia);
      const base = { idCliente: cliente.id_cliente, idTipo: tipo.id_tipo_membresia };
      const hoy = await fechaRelativa(0);
      const futuro = await fechaRelativa(20);
      const ayer = await fechaRelativa(-1);
      const hace40 = await fechaRelativa(-40);

      await crearMembresiaDePrueba({ ...base, inicio: hoy, fin: futuro }); // pendiente: cuenta
      await crearMembresiaDePrueba({ ...base, inicio: hoy, fin: futuro, pagada: true }); // pagada: no
      await crearMembresiaDePrueba({ ...base, inicio: hoy, fin: futuro, estado: 'cancelada' }); // cancelada: no
      await crearMembresiaDePrueba({ ...base, inicio: hace40, fin: ayer }); // vencida sin pago: no

      const r = await api('GET', `/tipos-membresia/${tipo.id_tipo_membresia}`, admin.token);
      assert.equal(r.cuerpo.membresias_pendientes_de_pago, 1);
    });
  });
});
