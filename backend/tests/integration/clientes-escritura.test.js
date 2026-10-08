import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/config/db.js';
import {
  iniciarServidor,
  solicitar,
  crearToken,
  correoUnico,
  crearUsuarioDePrueba,
  desactivarUsuarioDePrueba,
  cerrarPool,
} from '../helpers.js';

// Escenarios 8 a 12 y 14 de quickstart.md contra la base de pruebas gymaccess_test.

describe('API de clientes: registro, modificación y baja', () => {
  let servidor;
  let admin;
  let recepcionista;
  let entrenador;
  let tokenAdmin;
  let tokenRecepcion;
  let tokenEntrenador;
  const usuariosParaLimpiar = [];

  const api = (metodo, ruta, token, cuerpo) => solicitar(servidor.url, metodo, ruta, { token, cuerpo });
  const nuevoCliente = (extra = {}) => ({
    nombre: 'Clara',
    apellido: 'Prueba',
    telefono: '+52 (555) 123-4567',
    ...extra,
  });
  const registrar = (extra, token = tokenRecepcion) => api('POST', '/clientes', token, nuevoCliente(extra));

  before(async () => {
    servidor = await iniciarServidor();
    admin = await crearUsuarioDePrueba({ rol: 'administrador' });
    recepcionista = await crearUsuarioDePrueba({ rol: 'recepcionista' });
    entrenador = await crearUsuarioDePrueba({ rol: 'entrenador' });
    usuariosParaLimpiar.push(admin.id_usuario, recepcionista.id_usuario, entrenador.id_usuario);
    tokenAdmin = crearToken(admin.id_usuario);
    tokenRecepcion = crearToken(recepcionista.id_usuario);
    tokenEntrenador = crearToken(entrenador.id_usuario);
  });

  after(async () => {
    try {
      for (const id of usuariosParaLimpiar) await desactivarUsuarioDePrueba(id);
    } finally {
      await servidor.cerrar();
      await cerrarPool();
    }
  });

  describe('registro (escenarios 8 y 9)', () => {
    it('el recepcionista registra un cliente solo con nombre, apellido y teléfono (201)', async () => {
      const { status, cuerpo } = await registrar();

      assert.equal(status, 201);
      assert.equal(typeof cuerpo.id_cliente, 'number');
      assert.equal(cuerpo.nombre, 'Clara');
      assert.equal(cuerpo.apellido, 'Prueba');
      assert.equal(cuerpo.telefono, '+52 (555) 123-4567');
      assert.equal(cuerpo.correo, null);
      assert.equal(cuerpo.direccion, null);
      assert.equal(cuerpo.estado, 'activo');
      assert.ok(cuerpo.fecha_registro);
    });

    it('el administrador también puede registrar, con todos los campos y el correo normalizado', async () => {
      const correo = correoUnico('test');
      const { status, cuerpo } = await registrar(
        { nombre: '  Beto  ', correo: `  ${correo.toUpperCase()} `, direccion: ' Calle 5 #10 ' },
        tokenAdmin,
      );

      assert.equal(status, 201);
      assert.equal(cuerpo.nombre, 'Beto');
      assert.equal(cuerpo.correo, correo);
      assert.equal(cuerpo.direccion, 'Calle 5 #10');
    });

    it('rechaza (400) un cliente sin teléfono indicando el campo', async () => {
      const { status, cuerpo } = await api('POST', '/clientes', tokenRecepcion, { nombre: 'Sin', apellido: 'Teléfono' });

      assert.equal(status, 400);
      assert.equal(cuerpo.error.code, 'VALIDATION_ERROR');
      assert.deepEqual(
        cuerpo.error.details.map((d) => d.field),
        ['telefono'],
      );
    });

    it('rechaza (400) campos obligatorios ausentes o en blanco', async () => {
      const vacio = await api('POST', '/clientes', tokenRecepcion, {});
      assert.deepEqual(vacio.cuerpo.error.details.map((d) => d.field).sort(), ['apellido', 'nombre', 'telefono']);

      for (const campo of ['nombre', 'apellido', 'telefono']) {
        const { status, cuerpo } = await registrar({ [campo]: '   ' });
        assert.equal(status, 400);
        assert.equal(cuerpo.error.details[0].field, campo);
      }
    });

    it('rechaza (400) teléfonos con letras, nombres demasiado largos y correos inválidos', async () => {
      const telefono = await registrar({ telefono: 'llamar-a-ana' });
      assert.equal(telefono.status, 400);
      assert.equal(telefono.cuerpo.error.details[0].field, 'telefono');

      const largo = await registrar({ nombre: 'N'.repeat(81) });
      assert.equal(largo.status, 400);
      assert.equal(largo.cuerpo.error.details[0].field, 'nombre');

      const telLargo = await registrar({ telefono: '1'.repeat(21) });
      assert.equal(telLargo.status, 400);

      const correo = await registrar({ correo: 'no-es-un-correo' });
      assert.equal(correo.status, 400);
      assert.equal(correo.cuerpo.error.details[0].field, 'correo');
    });

    it('rechaza (400) campos que no se pueden enviar: estado, id_cliente y fecha_registro', async () => {
      for (const extra of [{ estado: 'inactivo' }, { id_cliente: 1 }, { fecha_registro: '2020-01-01' }]) {
        const { status } = await registrar(extra);
        assert.equal(status, 400, JSON.stringify(extra));
      }
    });

    it('rechaza (409) un correo ya registrado en otro cliente, sin distinguir mayúsculas', async () => {
      const correo = correoUnico('test');
      assert.equal((await registrar({ correo })).status, 201);

      const repetido = await registrar({ correo: correo.toUpperCase() });
      assert.equal(repetido.status, 409);
      assert.equal(repetido.cuerpo.error.code, 'CONFLICT');
      assert.equal(repetido.cuerpo.error.details[0].field, 'correo');
    });

    it('permite varios clientes sin correo (correo vacío o en blanco queda null)', async () => {
      const a = await registrar({ correo: '' });
      const b = await registrar({ correo: '   ' });
      const c = await registrar({ correo: null });
      for (const respuesta of [a, b, c]) {
        assert.equal(respuesta.status, 201);
        assert.equal(respuesta.cuerpo.correo, null);
      }
    });
  });

  describe('modificación (escenario 10)', () => {
    it('modifica el teléfono y deja el resto intacto', async () => {
      const correo = correoUnico('test');
      const creado = (await registrar({ correo, direccion: 'Av. Central 1' })).cuerpo;

      const { status, cuerpo } = await api('PATCH', `/clientes/${creado.id_cliente}`, tokenRecepcion, {
        telefono: '555 999 8888',
      });

      assert.equal(status, 200);
      assert.equal(cuerpo.telefono, '555 999 8888');
      assert.equal(cuerpo.nombre, creado.nombre);
      assert.equal(cuerpo.correo, correo);
      assert.equal(cuerpo.direccion, 'Av. Central 1');
      assert.equal(cuerpo.fecha_registro, creado.fecha_registro);
    });

    it('permite quitar correo y dirección (null) a un cliente sin cuenta', async () => {
      const creado = (await registrar({ correo: correoUnico('test'), direccion: 'Calle 9' })).cuerpo;
      const { status, cuerpo } = await api('PATCH', `/clientes/${creado.id_cliente}`, tokenAdmin, {
        correo: null,
        direccion: '',
      });
      assert.equal(status, 200);
      assert.equal(cuerpo.correo, null);
      assert.equal(cuerpo.direccion, null);
    });

    it('rechaza un PATCH vacío (400), un id inexistente (404) y un id no numérico (400)', async () => {
      const creado = (await registrar()).cuerpo;
      assert.equal((await api('PATCH', `/clientes/${creado.id_cliente}`, tokenRecepcion, {})).status, 400);
      assert.equal((await api('PATCH', '/clientes/99999999', tokenRecepcion, { nombre: 'X' })).status, 404);
      assert.equal((await api('PATCH', '/clientes/abc', tokenRecepcion, { nombre: 'X' })).status, 400);
    });

    it('rechaza modificar con un teléfono en blanco o un correo de otro cliente', async () => {
      const otro = (await registrar({ correo: correoUnico('test') })).cuerpo;
      const creado = (await registrar()).cuerpo;

      const blanco = await api('PATCH', `/clientes/${creado.id_cliente}`, tokenRecepcion, { telefono: '  ' });
      assert.equal(blanco.status, 400);

      const duplicado = await api('PATCH', `/clientes/${creado.id_cliente}`, tokenRecepcion, { correo: otro.correo });
      assert.equal(duplicado.status, 409);
    });

    it('no se puede cambiar ni quitar el correo de un cliente que ya tiene cuenta (409)', async () => {
      const correo = correoUnico('test');
      const creado = (await registrar({ correo })).cuerpo;
      const cuenta = await api('POST', '/usuarios', tokenAdmin, {
        nombre: 'Cuenta Cliente',
        correo,
        password: 'Secreta123',
        rol: 'cliente',
        id_cliente: creado.id_cliente,
      });
      assert.equal(cuenta.status, 201);
      usuariosParaLimpiar.push(cuenta.cuerpo.id_usuario);

      const cambiar = await api('PATCH', `/clientes/${creado.id_cliente}`, tokenRecepcion, {
        correo: correoUnico('test'),
      });
      assert.equal(cambiar.status, 409);
      assert.equal(cambiar.cuerpo.error.details[0].field, 'correo');

      const quitar = await api('PATCH', `/clientes/${creado.id_cliente}`, tokenRecepcion, { correo: null });
      assert.equal(quitar.status, 409);

      // Repetir el mismo correo u otros datos sí está permitido.
      const mismo = await api('PATCH', `/clientes/${creado.id_cliente}`, tokenRecepcion, {
        correo: correo.toUpperCase(),
        telefono: '555 000 9999',
      });
      assert.equal(mismo.status, 200);
      assert.equal(mismo.cuerpo.correo, correo);
    });
  });

  describe('baja lógica (escenarios 11 y 12)', () => {
    it('el recepcionista recibe 403 al dar de baja y el cliente sigue activo', async () => {
      const creado = (await registrar()).cuerpo;
      const { status } = await api('PATCH', `/clientes/${creado.id_cliente}/estado`, tokenRecepcion, {
        estado: 'inactivo',
      });
      assert.equal(status, 403);

      const [filas] = await pool.execute('SELECT estado FROM clientes WHERE id_cliente = ?', [creado.id_cliente]);
      assert.equal(filas[0].estado, 'activo');
    });

    it('el administrador da de baja y reactiva; el registro se conserva', async () => {
      const creado = (await registrar()).cuerpo;
      const ruta = `/clientes/${creado.id_cliente}/estado`;

      const baja = await api('PATCH', ruta, tokenAdmin, { estado: 'inactivo' });
      assert.equal(baja.status, 200);
      assert.equal(baja.cuerpo.estado, 'inactivo');

      const [filas] = await pool.execute('SELECT estado, nombre FROM clientes WHERE id_cliente = ?', [
        creado.id_cliente,
      ]);
      assert.equal(filas.length, 1, 'el registro no se elimina');
      assert.equal(filas[0].estado, 'inactivo');

      const alta = await api('PATCH', ruta, tokenAdmin, { estado: 'activo' });
      assert.equal(alta.status, 200);
      assert.equal(alta.cuerpo.estado, 'activo');
    });

    it('rechaza un estado inválido (400), un cliente inexistente (404) y campos extra (400)', async () => {
      const creado = (await registrar()).cuerpo;
      const ruta = `/clientes/${creado.id_cliente}/estado`;
      assert.equal((await api('PATCH', ruta, tokenAdmin, { estado: 'borrado' })).status, 400);
      assert.equal((await api('PATCH', ruta, tokenAdmin, {})).status, 400);
      assert.equal((await api('PATCH', ruta, tokenAdmin, { estado: 'inactivo', nombre: 'X' })).status, 400);
      assert.equal((await api('PATCH', '/clientes/99999999/estado', tokenAdmin, { estado: 'inactivo' })).status, 404);
    });

    it('no existe ninguna ruta para eliminar clientes', async () => {
      const creado = (await registrar()).cuerpo;
      const { status } = await api('DELETE', `/clientes/${creado.id_cliente}`, tokenAdmin);
      assert.equal(status, 404);
      const [filas] = await pool.execute('SELECT id_cliente FROM clientes WHERE id_cliente = ?', [creado.id_cliente]);
      assert.equal(filas.length, 1);
    });
  });

  describe('permisos (escenario 14)', () => {
    it('sin sesión responde 401', async () => {
      assert.equal((await api('POST', '/clientes', undefined, nuevoCliente())).status, 401);
      assert.equal((await api('PATCH', '/clientes/1', undefined, { nombre: 'X' })).status, 401);
      assert.equal((await api('PATCH', '/clientes/1/estado', undefined, { estado: 'inactivo' })).status, 401);
    });

    it('el entrenador recibe 403 al registrar, modificar y cambiar el estado', async () => {
      const creado = (await registrar()).cuerpo;
      assert.equal((await api('POST', '/clientes', tokenEntrenador, nuevoCliente())).status, 403);
      assert.equal((await api('PATCH', `/clientes/${creado.id_cliente}`, tokenEntrenador, { nombre: 'X' })).status, 403);
      assert.equal(
        (await api('PATCH', `/clientes/${creado.id_cliente}/estado`, tokenEntrenador, { estado: 'inactivo' })).status,
        403,
      );
    });

    it('un cliente con sesión recibe 403 al intentar registrar o modificar clientes', async () => {
      const correo = correoUnico('test');
      const creado = (await registrar({ correo })).cuerpo;
      const cuenta = await api('POST', '/usuarios', tokenAdmin, {
        nombre: 'Cliente Sesión',
        correo,
        password: 'Secreta123',
        rol: 'cliente',
        id_cliente: creado.id_cliente,
      });
      usuariosParaLimpiar.push(cuenta.cuerpo.id_usuario);
      const tokenCliente = crearToken(cuenta.cuerpo.id_usuario);

      assert.equal((await api('POST', '/clientes', tokenCliente, nuevoCliente())).status, 403);
      assert.equal((await api('PATCH', `/clientes/${creado.id_cliente}`, tokenCliente, { nombre: 'X' })).status, 403);
      assert.equal(
        (await api('PATCH', `/clientes/${creado.id_cliente}/estado`, tokenCliente, { estado: 'inactivo' })).status,
        403,
      );
    });
  });
});
