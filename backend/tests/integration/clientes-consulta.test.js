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

// Escenario 13 de quickstart.md contra la base de pruebas gymaccess_test.

const BASICOS = ['apellido', 'estado', 'fecha_registro', 'id_cliente', 'nombre'];
const TODOS = ['apellido', 'correo', 'direccion', 'estado', 'fecha_registro', 'id_cliente', 'nombre', 'telefono'];

describe('API de clientes: consulta por el personal', () => {
  let servidor;
  let tokenAdmin;
  let tokenRecepcion;
  let tokenEntrenador;
  let tokenCliente;
  const usuariosParaLimpiar = [];

  // Marca única de esta ejecución: permite buscar solo los clientes creados aquí.
  const marca = `Busq${Date.now()}`;
  // Nombre único de esta ejecución, para que la búsqueda por nombre no dependa de datos de otras corridas.
  const nombreUnico = `Carla${marca.slice(4)}`;
  const creados = []; // clientes de la marca, en orden de creación
  let correoDelPrimero;
  let inactivo;
  // Para el filtro "disponibles para crear una cuenta" (apellido distinto: no altera los conteos de arriba).
  const marcaCuenta = `Cuenta${Date.now()}`;
  let elegible;

  const api = (metodo, ruta, token, cuerpo) => solicitar(servidor.url, metodo, ruta, { token, cuerpo });

  before(async () => {
    servidor = await iniciarServidor();
    const admin = await crearUsuarioDePrueba({ rol: 'administrador' });
    const recepcionista = await crearUsuarioDePrueba({ rol: 'recepcionista' });
    const entrenador = await crearUsuarioDePrueba({ rol: 'entrenador' });
    usuariosParaLimpiar.push(admin.id_usuario, recepcionista.id_usuario, entrenador.id_usuario);
    tokenAdmin = crearToken(admin.id_usuario);
    tokenRecepcion = crearToken(recepcionista.id_usuario);
    tokenEntrenador = crearToken(entrenador.id_usuario);

    // Cinco clientes con el mismo apellido-marca; los nombres definen el orden esperado.
    correoDelPrimero = correoUnico('test');
    const nombres = ['Ana', 'Beto', nombreUnico, 'Diego', 'Elena'];
    for (const [indice, nombre] of nombres.entries()) {
      const { cuerpo } = await api('POST', '/clientes', tokenRecepcion, {
        nombre,
        apellido: marca,
        telefono: `555-000-${1000 + indice}`,
        correo: indice === 0 ? correoDelPrimero : undefined,
        direccion: `Calle ${indice} #${indice}`,
      });
      creados.push(cuerpo);
    }
    // Un cliente de la marca dado de baja.
    inactivo = creados[4];
    await api('PATCH', `/clientes/${inactivo.id_cliente}/estado`, tokenAdmin, { estado: 'inactivo' });

    // Clientes para el filtro de cuentas: uno elegible (activo, con correo, sin cuenta), uno con cuenta,
    // uno sin correo y uno dado de baja con correo.
    const crearAparte = async (nombre, extra) =>
      (await api('POST', '/clientes', tokenRecepcion, { nombre, apellido: marcaCuenta, telefono: '555-200-3000', ...extra }))
        .cuerpo;
    elegible = await crearAparte('Elegible', { correo: correoUnico('test') });
    const conCuenta = await crearAparte('ConCuenta', { correo: correoUnico('test') });
    await crearAparte('SinCorreo', {});
    const dadoDeBaja = await crearAparte('DeBaja', { correo: correoUnico('test') });
    await api('PATCH', `/clientes/${dadoDeBaja.id_cliente}/estado`, tokenAdmin, { estado: 'inactivo' });
    const cuentaDeOtro = await api('POST', '/usuarios', tokenAdmin, {
      nombre: 'Cuenta Otro',
      correo: conCuenta.correo,
      password: 'Secreta123',
      rol: 'cliente',
      id_cliente: conCuenta.id_cliente,
    });
    usuariosParaLimpiar.push(cuentaDeOtro.cuerpo.id_usuario);

    // Una cuenta de cliente (para comprobar que el rol cliente no consulta a otros).
    const cuentaCliente = await api('POST', '/usuarios', tokenAdmin, {
      nombre: 'Cliente Sesión',
      correo: correoDelPrimero,
      password: 'Secreta123',
      rol: 'cliente',
      id_cliente: creados[0].id_cliente,
    });
    usuariosParaLimpiar.push(cuentaCliente.cuerpo.id_usuario);
    tokenCliente = crearToken(cuentaCliente.cuerpo.id_usuario);
  });

  after(async () => {
    try {
      for (const id of usuariosParaLimpiar) await desactivarUsuarioDePrueba(id);
    } finally {
      await servidor.cerrar();
      await cerrarPool();
    }
  });

  describe('listado, búsqueda y paginación', () => {
    it('el recepcionista lista con todos los datos de contacto', async () => {
      const { status, cuerpo } = await api('GET', `/clientes?q=${marca}`, tokenRecepcion);

      assert.equal(status, 200);
      assert.equal(cuerpo.total, 5);
      assert.equal(cuerpo.page, 1);
      assert.equal(cuerpo.limit, 20);
      assert.equal(cuerpo.data.length, 5);
      for (const cliente of cuerpo.data) assert.deepEqual(Object.keys(cliente).sort(), TODOS);
    });

    it('el administrador también ve todos los datos', async () => {
      const { cuerpo } = await api('GET', `/clientes?q=${marca}`, tokenAdmin);
      assert.deepEqual(Object.keys(cuerpo.data[0]).sort(), TODOS);
      assert.match(cuerpo.data[0].telefono, /^555-000-/);
    });

    it('ordena por apellido y nombre', async () => {
      const { cuerpo } = await api('GET', `/clientes?q=${marca}`, tokenRecepcion);
      assert.deepEqual(
        cuerpo.data.map((c) => c.nombre),
        ['Ana', 'Beto', nombreUnico, 'Diego', 'Elena'],
      );
    });

    it('pagina: 5 resultados en páginas de 2 dan 2, 2 y 1', async () => {
      const largos = [];
      for (const page of [1, 2, 3]) {
        const { cuerpo } = await api('GET', `/clientes?q=${marca}&limit=2&page=${page}`, tokenRecepcion);
        assert.equal(cuerpo.total, 5);
        assert.equal(cuerpo.page, page);
        assert.equal(cuerpo.limit, 2);
        largos.push(cuerpo.data.length);
      }
      assert.deepEqual(largos, [2, 2, 1]);

      const vacia = await api('GET', `/clientes?q=${marca}&limit=2&page=4`, tokenRecepcion);
      assert.equal(vacia.cuerpo.data.length, 0);
    });

    it('un limit mayor a 100 se limita a 100 y valores inválidos usan los predeterminados', async () => {
      const grande = await api('GET', '/clientes?limit=5000', tokenRecepcion);
      assert.equal(grande.cuerpo.limit, 100);
      const raro = await api('GET', '/clientes?page=abc&limit=-3', tokenRecepcion);
      assert.equal(raro.status, 200);
      assert.equal(raro.cuerpo.page, 1);
      assert.equal(raro.cuerpo.limit, 20);
    });

    it('busca por nombre, por apellido, por nombre completo y por correo, sin distinguir mayúsculas', async () => {
      const porNombre = await api('GET', `/clientes?q=${nombreUnico.toLowerCase()}`, tokenRecepcion);
      assert.equal(porNombre.cuerpo.total, 1);
      assert.equal(porNombre.cuerpo.data[0].nombre, nombreUnico);

      const completo = await api('GET', `/clientes?q=${encodeURIComponent(`Diego ${marca}`)}`, tokenRecepcion);
      assert.equal(completo.cuerpo.total, 1);
      assert.equal(completo.cuerpo.data[0].nombre, 'Diego');

      const mayusculas = await api('GET', `/clientes?q=${marca.toUpperCase()}`, tokenRecepcion);
      assert.equal(mayusculas.cuerpo.total, 5);

      const porCorreo = await api('GET', `/clientes?q=${encodeURIComponent(correoDelPrimero)}`, tokenRecepcion);
      assert.equal(porCorreo.cuerpo.total, 1);
      assert.equal(porCorreo.cuerpo.data[0].nombre, 'Ana');
    });

    it('los comodines de LIKE se tratan como texto literal', async () => {
      for (const q of ['%', '_', '%25%25']) {
        const { status, cuerpo } = await api('GET', `/clientes?q=${encodeURIComponent(q)}`, tokenRecepcion);
        assert.equal(status, 200);
        assert.equal(cuerpo.total, 0, `q=${q}`);
      }
    });

    it('filtra por estado', async () => {
      const bajas = await api('GET', `/clientes?q=${marca}&estado=inactivo`, tokenRecepcion);
      assert.equal(bajas.cuerpo.total, 1);
      assert.equal(bajas.cuerpo.data[0].id_cliente, inactivo.id_cliente);
      assert.equal(bajas.cuerpo.data[0].estado, 'inactivo');

      const activos = await api('GET', `/clientes?q=${marca}&estado=activo`, tokenRecepcion);
      assert.equal(activos.cuerpo.total, 4);
    });

    it('rechaza (400) un estado inválido y una búsqueda demasiado larga', async () => {
      assert.equal((await api('GET', '/clientes?estado=borrado', tokenRecepcion)).status, 400);
      assert.equal((await api('GET', `/clientes?q=${'x'.repeat(151)}`, tokenRecepcion)).status, 400);
    });
  });

  describe('clientes disponibles para crear una cuenta (para_cuenta=true)', () => {
    it('el administrador solo recibe clientes activos, con correo y sin cuenta', async () => {
      const { status, cuerpo } = await api('GET', `/clientes?para_cuenta=true&q=${marcaCuenta}`, tokenAdmin);

      assert.equal(status, 200);
      assert.equal(cuerpo.total, 1);
      assert.equal(cuerpo.data[0].id_cliente, elegible.id_cliente);
      assert.equal(cuerpo.data[0].correo, elegible.correo);
    });

    it('sin el filtro, esos mismos clientes aparecen todos', async () => {
      const { cuerpo } = await api('GET', `/clientes?q=${marcaCuenta}`, tokenAdmin);
      assert.equal(cuerpo.total, 4);
    });

    it('un cliente que obtiene cuenta deja de aparecer como disponible', async () => {
      const nuevo = (
        await api('POST', '/clientes', tokenRecepcion, {
          nombre: 'Pronto',
          apellido: marcaCuenta,
          telefono: '555-300-4000',
          correo: correoUnico('test'),
        })
      ).cuerpo;
      const antes = await api('GET', `/clientes?para_cuenta=true&q=${marcaCuenta}`, tokenAdmin);
      assert.equal(antes.cuerpo.total, 2);

      const cuenta = await api('POST', '/usuarios', tokenAdmin, {
        nombre: 'Cuenta Pronto',
        correo: nuevo.correo,
        password: 'Secreta123',
        rol: 'cliente',
        id_cliente: nuevo.id_cliente,
      });
      usuariosParaLimpiar.push(cuenta.cuerpo.id_usuario);
      const despues = await api('GET', `/clientes?para_cuenta=true&q=${marcaCuenta}`, tokenAdmin);
      assert.equal(despues.cuerpo.total, 1);
    });

    it('el recepcionista y el entrenador reciben 403 (no deben deducir quién tiene cuenta)', async () => {
      assert.equal((await api('GET', '/clientes?para_cuenta=true', tokenRecepcion)).status, 403);
      assert.equal((await api('GET', '/clientes?para_cuenta=true', tokenEntrenador)).status, 403);
    });

    it('rechaza (400) un valor que no sea true o false', async () => {
      assert.equal((await api('GET', '/clientes?para_cuenta=si', tokenAdmin)).status, 400);
    });
  });

  describe('detalle', () => {
    it('devuelve el cliente completo al recepcionista y al administrador', async () => {
      for (const token of [tokenRecepcion, tokenAdmin]) {
        const { status, cuerpo } = await api('GET', `/clientes/${creados[1].id_cliente}`, token);
        assert.equal(status, 200);
        assert.deepEqual(Object.keys(cuerpo).sort(), TODOS);
        assert.equal(cuerpo.nombre, 'Beto');
        assert.equal(cuerpo.direccion, 'Calle 1 #1');
      }
    });

    it('responde 404 si no existe y 400 si el id no es numérico', async () => {
      assert.equal((await api('GET', '/clientes/99999999', tokenRecepcion)).status, 404);
      assert.equal((await api('GET', '/clientes/abc', tokenRecepcion)).status, 400);
    });
  });

  describe('el entrenador ve solo la información básica (escenario 13)', () => {
    it('en el listado: nada de teléfono, correo ni dirección', async () => {
      const { status, cuerpo } = await api('GET', `/clientes?q=${marca}`, tokenEntrenador);

      assert.equal(status, 200);
      assert.equal(cuerpo.total, 5);
      for (const cliente of cuerpo.data) assert.deepEqual(Object.keys(cliente).sort(), BASICOS);

      const texto = JSON.stringify(cuerpo);
      assert.ok(!texto.includes('555-000-'), 'sin teléfonos');
      assert.ok(!texto.includes(correoDelPrimero), 'sin correos');
      assert.ok(!texto.includes('Calle '), 'sin direcciones');
    });

    it('en el detalle: solo id, nombre, apellido, estado y fecha de registro', async () => {
      const { status, cuerpo } = await api('GET', `/clientes/${creados[0].id_cliente}`, tokenEntrenador);
      assert.equal(status, 200);
      assert.deepEqual(Object.keys(cuerpo).sort(), BASICOS);
      assert.equal(cuerpo.nombre, 'Ana');
    });

    it('no puede deducir correos buscándolos (la búsqueda por correo no le aplica)', async () => {
      const entrenador = await api('GET', `/clientes?q=${encodeURIComponent(correoDelPrimero)}`, tokenEntrenador);
      assert.equal(entrenador.cuerpo.total, 0);
      const recepcion = await api('GET', `/clientes?q=${encodeURIComponent(correoDelPrimero)}`, tokenRecepcion);
      assert.equal(recepcion.cuerpo.total, 1);
    });

    it('sí puede buscar por nombre y apellido y filtrar por estado', async () => {
      const { cuerpo } = await api('GET', `/clientes?q=${marca}&estado=inactivo`, tokenEntrenador);
      assert.equal(cuerpo.total, 1);
      assert.deepEqual(Object.keys(cuerpo.data[0]).sort(), BASICOS);
    });
  });

  describe('acceso', () => {
    it('sin sesión responde 401', async () => {
      assert.equal((await api('GET', '/clientes')).status, 401);
      assert.equal((await api('GET', `/clientes/${creados[0].id_cliente}`)).status, 401);
    });

    it('el rol cliente recibe 403 al listar y al consultar cualquier cliente, incluido el suyo', async () => {
      assert.equal((await api('GET', '/clientes', tokenCliente)).status, 403);
      assert.equal((await api('GET', `/clientes/${creados[1].id_cliente}`, tokenCliente)).status, 403);
      assert.equal((await api('GET', `/clientes/${creados[0].id_cliente}`, tokenCliente)).status, 403);
    });
  });
});
