import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  iniciarServidor,
  solicitar,
  crearToken,
  correoUnico,
  crearUsuarioDePrueba,
  desactivarUsuarioDePrueba,
  cerrarPool,
} from '../helpers.js';

// Escenarios 15 a 17 de quickstart.md contra la base de pruebas gymaccess_test.

const TODOS = ['apellido', 'correo', 'direccion', 'estado', 'fecha_registro', 'id_cliente', 'nombre', 'telefono'];

describe('Cuenta de cliente y consulta de la información propia', () => {
  let servidor;
  let tokenAdmin;
  let tokenRecepcion;
  let tokenEntrenador;
  const usuariosParaLimpiar = [];

  let clienteAna; // con correo y con cuenta
  let clienteOtro; // con correo, sin cuenta
  let clienteSinCorreo;
  let cuentaAna;
  let tokenAna; // sesión iniciada por la vía normal (login)

  const api = (metodo, ruta, token, cuerpo) => solicitar(servidor.url, metodo, ruta, { token, cuerpo });
  const crearCliente = async (extra = {}) => {
    const { status, cuerpo } = await api('POST', '/clientes', tokenRecepcion, {
      nombre: 'Prueba',
      apellido: 'Propio',
      telefono: '555-100-2000',
      ...extra,
    });
    assert.equal(status, 201, JSON.stringify(cuerpo));
    return cuerpo;
  };
  const crearCuenta = (cliente, extra = {}) =>
    api('POST', '/usuarios', tokenAdmin, {
      nombre: `Cuenta ${cliente.nombre}`,
      correo: cliente.correo,
      password: 'Secreta123',
      rol: 'cliente',
      id_cliente: cliente.id_cliente,
      ...extra,
    });

  before(async () => {
    servidor = await iniciarServidor();
    const admin = await crearUsuarioDePrueba({ rol: 'administrador' });
    const recepcionista = await crearUsuarioDePrueba({ rol: 'recepcionista' });
    const entrenador = await crearUsuarioDePrueba({ rol: 'entrenador' });
    usuariosParaLimpiar.push(admin.id_usuario, recepcionista.id_usuario, entrenador.id_usuario);
    tokenAdmin = crearToken(admin.id_usuario);
    tokenRecepcion = crearToken(recepcionista.id_usuario);
    tokenEntrenador = crearToken(entrenador.id_usuario);

    clienteAna = await crearCliente({ nombre: 'Ana', correo: correoUnico('test'), direccion: 'Calle Propia 10' });
    clienteOtro = await crearCliente({ nombre: 'Otro', correo: correoUnico('test'), telefono: '555-999-0000' });
    clienteSinCorreo = await crearCliente({ nombre: 'SinCorreo' });

    const respuesta = await crearCuenta(clienteAna);
    assert.equal(respuesta.status, 201, JSON.stringify(respuesta.cuerpo));
    cuentaAna = respuesta.cuerpo;
    usuariosParaLimpiar.push(cuentaAna.id_usuario);

    const login = await api('POST', '/auth/login', undefined, { correo: clienteAna.correo, password: 'Secreta123' });
    tokenAna = login.cuerpo.token;
  });

  after(async () => {
    try {
      for (const id of usuariosParaLimpiar) await desactivarUsuarioDePrueba(id);
    } finally {
      await servidor.cerrar();
      await cerrarPool();
    }
  });

  describe('creación de la cuenta de un cliente (escenarios 15 y 16)', () => {
    it('el administrador crea la cuenta de un cliente con correo; usa el correo del cliente (201)', async () => {
      assert.equal(cuentaAna.rol, 'cliente');
      assert.equal(cuentaAna.id_cliente, clienteAna.id_cliente);
      assert.equal(cuentaAna.correo, clienteAna.correo);
      assert.equal('password' in cuentaAna, false);
    });

    it('rechaza (409) crear la cuenta de un cliente sin correo', async () => {
      const { status, cuerpo } = await crearCuenta(clienteSinCorreo, { correo: correoUnico('test') });
      assert.equal(status, 409);
      assert.equal(cuerpo.error.code, 'CONFLICT');
    });

    it('rechaza (409) una segunda cuenta para el mismo cliente', async () => {
      const { status } = await crearCuenta(clienteAna);
      assert.equal(status, 409);
    });

    it('rechaza (409) una cuenta con un correo distinto al del cliente', async () => {
      const { status, cuerpo } = await crearCuenta(clienteOtro, { correo: correoUnico('test') });
      assert.equal(status, 409);
      assert.equal(cuerpo.error.details[0].field, 'correo');
    });

    it('rechaza (404) una cuenta para un cliente que no existe', async () => {
      const { status } = await crearCuenta({ nombre: 'X', correo: correoUnico('test'), id_cliente: 99999999 });
      assert.equal(status, 404);
    });

    it('solo el administrador puede crear cuentas: el recepcionista recibe 403', async () => {
      const { status } = await api('POST', '/usuarios', tokenRecepcion, {
        nombre: 'Intento',
        correo: clienteOtro.correo,
        password: 'Secreta123',
        rol: 'cliente',
        id_cliente: clienteOtro.id_cliente,
      });
      assert.equal(status, 403);
    });

    it('la cuenta del cliente puede iniciar sesión y se identifica con el rol cliente', async () => {
      const yo = await api('GET', '/auth/me', tokenAna);
      assert.equal(yo.status, 200);
      assert.equal(yo.cuerpo.rol, 'cliente');
      assert.equal(yo.cuerpo.id_cliente, clienteAna.id_cliente);
    });
  });

  describe('GET /clientes/me (escenario 17)', () => {
    it('devuelve todos los datos del propio cliente', async () => {
      const { status, cuerpo } = await api('GET', '/clientes/me', tokenAna);

      assert.equal(status, 200);
      assert.deepEqual(Object.keys(cuerpo).sort(), TODOS);
      assert.equal(cuerpo.id_cliente, clienteAna.id_cliente);
      assert.equal(cuerpo.nombre, 'Ana');
      assert.equal(cuerpo.telefono, '555-100-2000');
      assert.equal(cuerpo.correo, clienteAna.correo);
      assert.equal(cuerpo.direccion, 'Calle Propia 10');
      assert.equal(cuerpo.estado, 'activo');
      assert.ok(cuerpo.fecha_registro);
    });

    it('no incluye datos de otros clientes', async () => {
      const { cuerpo } = await api('GET', '/clientes/me', tokenAna);
      const texto = JSON.stringify(cuerpo);
      assert.ok(!texto.includes(clienteOtro.correo));
      assert.ok(!texto.includes('555-999-0000'));
      assert.ok(!Array.isArray(cuerpo), 'devuelve un objeto, no una lista');
    });

    it('ignora cualquier id que intente enviar el cliente: siempre responde con el suyo', async () => {
      const porConsulta = await api('GET', `/clientes/me?id_cliente=${clienteOtro.id_cliente}&id=${clienteOtro.id_cliente}`, tokenAna);
      assert.equal(porConsulta.status, 200);
      assert.equal(porConsulta.cuerpo.id_cliente, clienteAna.id_cliente);
    });

    it('refleja los cambios que el personal hace al cliente', async () => {
      const cambio = await api('PATCH', `/clientes/${clienteAna.id_cliente}`, tokenRecepcion, {
        telefono: '555-777-6666',
      });
      assert.equal(cambio.status, 200);

      const { cuerpo } = await api('GET', '/clientes/me', tokenAna);
      assert.equal(cuerpo.telefono, '555-777-6666');
    });

    it('sin sesión responde 401', async () => {
      assert.equal((await api('GET', '/clientes/me')).status, 401);
    });

    it('el personal (administrador, recepcionista, entrenador) recibe 403: /me es solo para clientes', async () => {
      for (const token of [tokenAdmin, tokenRecepcion, tokenEntrenador]) {
        assert.equal((await api('GET', '/clientes/me', token)).status, 403);
      }
    });
  });

  describe('el cliente no puede ver información de otros', () => {
    it('GET /clientes/{otro id} responde 403', async () => {
      const { status } = await api('GET', `/clientes/${clienteOtro.id_cliente}`, tokenAna);
      assert.equal(status, 403);
    });

    it('tampoco puede listar clientes ni consultar el suyo por la ruta del personal', async () => {
      assert.equal((await api('GET', '/clientes', tokenAna)).status, 403);
      assert.equal((await api('GET', `/clientes/${clienteAna.id_cliente}`, tokenAna)).status, 403);
    });

    it('no puede gestionar usuarios ni modificar clientes', async () => {
      assert.equal((await api('GET', '/usuarios', tokenAna)).status, 403);
      assert.equal((await api('PATCH', `/clientes/${clienteAna.id_cliente}`, tokenAna, { nombre: 'X' })).status, 403);
      assert.equal(
        (await api('PATCH', `/clientes/${clienteOtro.id_cliente}/estado`, tokenAna, { estado: 'inactivo' })).status,
        403,
      );
    });
  });

  describe('estado del cliente y de su cuenta', () => {
    it('un cliente dado de baja no inicia sesión ni usa su sesión abierta; al reactivarlo recupera el acceso (FR-003b)', async () => {
      const cliente = await crearCliente({ nombre: 'DeBaja', correo: correoUnico('test') });
      const cuenta = await crearCuenta(cliente);
      assert.equal(cuenta.status, 201);
      usuariosParaLimpiar.push(cuenta.cuerpo.id_usuario);
      const credenciales = { correo: cliente.correo, password: 'Secreta123' };

      const login = await api('POST', '/auth/login', undefined, credenciales);
      assert.equal(login.status, 200);
      assert.equal((await api('GET', '/clientes/me', login.cuerpo.token)).status, 200);

      // El administrador da de baja al cliente: la cuenta sigue activa, pero el acceso se corta.
      const baja = await api('PATCH', `/clientes/${cliente.id_cliente}/estado`, tokenAdmin, { estado: 'inactivo' });
      assert.equal(baja.status, 200);
      const cuentaActiva = await api('GET', `/usuarios/${cuenta.cuerpo.id_usuario}`, tokenAdmin);
      assert.equal(cuentaActiva.cuerpo.estado, 'activo', 'la cuenta no se desactiva, solo se bloquea el acceso');

      // La sesión abierta deja de servir de inmediato.
      assert.equal((await api('GET', '/clientes/me', login.cuerpo.token)).status, 401);
      assert.equal((await api('GET', '/auth/me', login.cuerpo.token)).status, 401);

      // Y no puede iniciar sesión, con el mismo mensaje genérico que una contraseña errónea.
      const intento = await api('POST', '/auth/login', undefined, credenciales);
      const erronea = await api('POST', '/auth/login', undefined, { ...credenciales, password: 'Incorrecta999' });
      assert.equal(intento.status, 401);
      assert.equal(intento.cuerpo.error.message, erronea.cuerpo.error.message);

      // Al reactivar al cliente, la misma cuenta vuelve a funcionar.
      const alta = await api('PATCH', `/clientes/${cliente.id_cliente}/estado`, tokenAdmin, { estado: 'activo' });
      assert.equal(alta.status, 200);
      const denuevo = await api('POST', '/auth/login', undefined, credenciales);
      assert.equal(denuevo.status, 200);
      const { status, cuerpo } = await api('GET', '/clientes/me', denuevo.cuerpo.token);
      assert.equal(status, 200);
      assert.equal(cuerpo.id_cliente, cliente.id_cliente);
    });

    it('dar de baja a un cliente no afecta a las cuentas del personal', async () => {
      const cliente = await crearCliente({ nombre: 'Aparte' });
      await api('PATCH', `/clientes/${cliente.id_cliente}/estado`, tokenAdmin, { estado: 'inactivo' });
      assert.equal((await api('GET', '/auth/me', tokenRecepcion)).status, 200);
      assert.equal((await api('GET', '/auth/me', tokenAdmin)).status, 200);
    });

    it('si el administrador desactiva la cuenta, el cliente pierde el acceso de inmediato', async () => {
      const baja = await api('PATCH', `/usuarios/${cuentaAna.id_usuario}`, tokenAdmin, { estado: 'inactivo' });
      assert.equal(baja.status, 200);
      assert.equal((await api('GET', '/clientes/me', tokenAna)).status, 401);

      await api('PATCH', `/usuarios/${cuentaAna.id_usuario}`, tokenAdmin, { estado: 'activo' });
      assert.equal((await api('GET', '/clientes/me', tokenAna)).status, 200);
    });
  });
});
