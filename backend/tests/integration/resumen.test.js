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

// GET /api/resumen: resumen del inicio por rol. Solo lectura, contra la base de pruebas gymaccess_test.
// Las pruebas corren en paralelo con otras que crean clientes, así que las cifras globales se
// comparan con tolerancia (estabilidad entre dos lecturas) y no con valores fijos.

const ROLES = ['administrador', 'recepcionista', 'entrenador', 'cliente'];
const COMPLETOS = ['apellido', 'correo', 'direccion', 'estado', 'fecha_registro', 'id_cliente', 'nombre', 'telefono'];

describe('API de resumen del inicio', () => {
  let servidor;
  let tokenAdmin;
  let tokenRecepcion;
  let tokenEntrenador;
  let tokenCliente;
  const usuariosParaLimpiar = [];
  const marca = `Resumen${Date.now()}`;

  const api = (metodo, ruta, token, cuerpo) => solicitar(servidor.url, metodo, ruta, { token, cuerpo });

  async function crearCliente(nombre, extra = {}) {
    const { status, cuerpo } = await api('POST', '/clientes', tokenRecepcion, {
      nombre,
      apellido: marca,
      telefono: '555-300-4000',
      ...extra,
    });
    assert.equal(status, 201);
    return cuerpo;
  }

  // Repite la lectura hasta que dos consultas seguidas coinciden (otras pruebas pueden escribir en paralelo).
  async function leerEstable(token, leer) {
    let anterior = JSON.stringify(await leer(token));
    for (let intento = 0; intento < 5; intento += 1) {
      const actual = JSON.stringify(await leer(token));
      if (actual === anterior) return JSON.parse(actual);
      anterior = actual;
    }
    return JSON.parse(anterior);
  }

  before(async () => {
    servidor = await iniciarServidor();
    const admin = await crearUsuarioDePrueba({ rol: 'administrador' });
    const recepcionista = await crearUsuarioDePrueba({ rol: 'recepcionista' });
    const entrenador = await crearUsuarioDePrueba({ rol: 'entrenador' });
    usuariosParaLimpiar.push(admin.id_usuario, recepcionista.id_usuario, entrenador.id_usuario);
    tokenAdmin = crearToken(admin.id_usuario);
    tokenRecepcion = crearToken(recepcionista.id_usuario);
    tokenEntrenador = crearToken(entrenador.id_usuario);

    const clienteCuenta = await crearCliente('ConCuenta', { correo: correoUnico('test') });
    const cuenta = await api('POST', '/usuarios', tokenAdmin, {
      nombre: 'Cliente Resumen',
      correo: clienteCuenta.correo,
      password: 'Secreta123',
      rol: 'cliente',
      id_cliente: clienteCuenta.id_cliente,
    });
    usuariosParaLimpiar.push(cuenta.cuerpo.id_usuario);
    tokenCliente = crearToken(cuenta.cuerpo.id_usuario);
  });

  after(async () => {
    try {
      for (const id of usuariosParaLimpiar) await desactivarUsuarioDePrueba(id);
    } finally {
      await servidor.cerrar();
      await cerrarPool();
    }
  });

  describe('acceso', () => {
    it('sin sesión responde 401', async () => {
      assert.equal((await api('GET', '/resumen')).status, 401);
    });

    it('el rol cliente recibe 403', async () => {
      assert.equal((await api('GET', '/resumen', tokenCliente)).status, 403);
    });

    it('solo admite lectura: POST, PATCH y DELETE no existen', async () => {
      for (const metodo of ['POST', 'PATCH', 'PUT', 'DELETE']) {
        const { status } = await api(metodo, '/resumen', tokenAdmin, {});
        assert.ok([404, 405].includes(status), `${metodo} respondió ${status}`);
      }
    });
  });

  describe('administrador', () => {
    it('recibe cifras de clientes, usuarios por rol y los últimos 5 clientes', async () => {
      await crearCliente('Uno');
      const { status, cuerpo } = await api('GET', '/resumen', tokenAdmin);

      assert.equal(status, 200);
      assert.deepEqual(Object.keys(cuerpo).sort(), ['clientes', 'ultimos_clientes', 'usuarios']);
      assert.deepEqual(Object.keys(cuerpo.clientes).sort(), ['activos', 'inactivos', 'registrados_mes']);
      for (const valor of Object.values(cuerpo.clientes)) assert.ok(Number.isInteger(valor) && valor >= 0);
      assert.ok(cuerpo.clientes.registrados_mes >= 1);
      assert.deepEqual(Object.keys(cuerpo.usuarios).sort(), ['por_rol', 'total']);
      assert.deepEqual(Object.keys(cuerpo.usuarios.por_rol).sort(), [...ROLES].sort());
      const suma = Object.values(cuerpo.usuarios.por_rol).reduce((a, b) => a + b, 0);
      assert.equal(suma, cuerpo.usuarios.total);
      assert.ok(cuerpo.usuarios.por_rol.administrador >= 1);
      assert.ok(cuerpo.usuarios.por_rol.cliente >= 1);
    });

    it('las cifras coinciden con las listas de clientes y de usuarios', async () => {
      const leer = async (token) => {
        const [resumen, activos, inactivos, usuarios] = await Promise.all([
          api('GET', '/resumen', token),
          api('GET', '/clientes?estado=activo&limit=1', token),
          api('GET', '/clientes?estado=inactivo&limit=1', token),
          api('GET', '/usuarios?limit=1', token),
        ]);
        return {
          resumen: [resumen.cuerpo.clientes.activos, resumen.cuerpo.clientes.inactivos, resumen.cuerpo.usuarios.total],
          listas: [activos.cuerpo.total, inactivos.cuerpo.total, usuarios.cuerpo.total],
        };
      };
      const { resumen, listas } = await leerEstable(tokenAdmin, leer);
      assert.deepEqual(resumen, listas);
    });

    it('los últimos 5 clientes vienen del más reciente al más antiguo, con todos los datos', async () => {
      const nuevo = await crearCliente('Reciente');
      const { cuerpo } = await api('GET', '/resumen', tokenAdmin);

      assert.ok(cuerpo.ultimos_clientes.length <= 5);
      assert.ok(cuerpo.ultimos_clientes.length >= 1);
      for (const cliente of cuerpo.ultimos_clientes) assert.deepEqual(Object.keys(cliente).sort(), COMPLETOS);
      const claves = cuerpo.ultimos_clientes.map((c) => [new Date(c.fecha_registro).getTime(), c.id_cliente]);
      const ordenadas = [...claves].sort((a, b) => b[0] - a[0] || b[1] - a[1]);
      assert.deepEqual(claves, ordenadas);
      // El cliente recién creado es el más reciente, salvo que otra prueba en paralelo haya creado uno después.
      const ids = cuerpo.ultimos_clientes.map((c) => c.id_cliente);
      assert.ok(ids[0] >= nuevo.id_cliente || ids.includes(nuevo.id_cliente));
    });
  });

  describe('recepcionista', () => {
    it('recibe activos, registrados hoy y últimos 5, sin cifras de usuarios', async () => {
      await crearCliente('Hoy');
      const { status, cuerpo } = await api('GET', '/resumen', tokenRecepcion);

      assert.equal(status, 200);
      assert.deepEqual(Object.keys(cuerpo).sort(), ['clientes', 'ultimos_clientes']);
      assert.deepEqual(Object.keys(cuerpo.clientes).sort(), ['activos', 'registrados_hoy']);
      assert.ok(cuerpo.clientes.registrados_hoy >= 1);
      assert.ok(cuerpo.clientes.activos >= 1);
      assert.ok(cuerpo.ultimos_clientes.length >= 1 && cuerpo.ultimos_clientes.length <= 5);
      for (const cliente of cuerpo.ultimos_clientes) assert.deepEqual(Object.keys(cliente).sort(), COMPLETOS);
    });

    it('el conteo de activos coincide con la lista de clientes', async () => {
      const leer = async (token) => {
        const [resumen, lista] = await Promise.all([
          api('GET', '/resumen', token),
          api('GET', '/clientes?estado=activo&limit=1', token),
        ]);
        return [resumen.cuerpo.clientes.activos, lista.cuerpo.total];
      };
      const [delResumen, delListado] = await leerEstable(tokenRecepcion, leer);
      assert.equal(delResumen, delListado);
    });
  });

  describe('entrenador', () => {
    it('recibe solo el número de clientes activos: sin contacto ni cifras de usuarios', async () => {
      const { status, cuerpo } = await api('GET', '/resumen', tokenEntrenador);

      assert.equal(status, 200);
      assert.deepEqual(Object.keys(cuerpo), ['clientes']);
      assert.deepEqual(Object.keys(cuerpo.clientes), ['activos']);
      assert.ok(Number.isInteger(cuerpo.clientes.activos) && cuerpo.clientes.activos >= 1);
      const texto = JSON.stringify(cuerpo);
      assert.ok(!texto.includes('telefono') && !texto.includes('correo') && !texto.includes('usuarios'));
    });
  });

  describe('solo lectura', () => {
    it('consultar el resumen no cambia el número de clientes ni de usuarios', async () => {
      const total = async () => ({
        clientes: (await api('GET', '/clientes?limit=1', tokenAdmin)).cuerpo.total,
        usuarios: (await api('GET', '/usuarios?limit=1', tokenAdmin)).cuerpo.total,
      });
      const antes = await total();
      for (let i = 0; i < 3; i += 1) await api('GET', '/resumen', tokenAdmin);
      const despues = await total();
      // Otras pruebas pueden crear registros en paralelo, pero nunca disminuyen.
      assert.ok(despues.clientes >= antes.clientes);
      assert.ok(despues.usuarios >= antes.usuarios);
    });
  });
});
