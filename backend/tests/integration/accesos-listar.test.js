import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/config/db.js';
import {
  iniciarServidor,
  solicitar,
  crearToken,
  crearUsuarioConRol,
  crearClienteDePrueba,
  limpiarDatosDePrueba,
  cerrarPool,
} from '../helpers.js';

// Consulta de accesos (gymaccess_test). Las filas de prueba usan fechas de marzo de 2001 para no mezclarse
// con los accesos que generan otras pruebas, y se retiran al terminar (esta base es solo de pruebas).

describe('GET /accesos', () => {
  let servidor;
  let admin;
  let recepcion;
  let entrenador;
  let tokenCliente;
  let ana;
  let beto;
  const usuarios = [];
  const clientes = [];
  const idsAcceso = [];
  const marca = `Lst${process.pid}${Date.now() % 100000}`;
  const RANGO = 'desde=2001-03-05&hasta=2001-03-07';

  const api = (metodo, ruta, token, cuerpo) => solicitar(servidor.url, metodo, ruta, { token, cuerpo });
  const listar = (consulta = '', token = admin.token) => api('GET', `/accesos?${RANGO}${consulta ? `&${consulta}` : ''}`, token);
  const insertar = async (idCliente, fecha, hora, resultado, motivo = null) => {
    const [r] = await pool.execute(
      "INSERT INTO accesos (id_cliente, fecha, hora, tipo, resultado, motivo_rechazo) VALUES (?, ?, ?, 'entrada', ?, ?)",
      [idCliente, fecha, hora, resultado, motivo],
    );
    idsAcceso.push(r.insertId);
    return r.insertId;
  };
  const ids = (r) => r.cuerpo.data.map((a) => a.id_acceso);

  before(async () => {
    servidor = await iniciarServidor();
    admin = await crearUsuarioConRol('administrador');
    recepcion = await crearUsuarioConRol('recepcionista');
    entrenador = await crearUsuarioConRol('entrenador');
    usuarios.push(admin.id_usuario, recepcion.id_usuario, entrenador.id_usuario);

    ana = await crearClienteDePrueba({ nombre: 'Ana', apellido: `${marca}Alfa` });
    beto = await crearClienteDePrueba({ nombre: 'Beto', apellido: `${marca}Beta` });
    clientes.push(ana.id_cliente, beto.id_cliente);
    const cuenta = await api('POST', '/usuarios', admin.token, {
      nombre: 'Cliente lista accesos',
      correo: ana.correo,
      password: 'Secreta123',
      rol: 'cliente',
      id_cliente: ana.id_cliente,
    });
    usuarios.push(cuenta.cuerpo.id_usuario);
    tokenCliente = crearToken(cuenta.cuerpo.id_usuario);

    // Del más antiguo al más reciente: a1 < a2 < b1 < desconocido.
    ids.a1 = await insertar(ana.id_cliente, '2001-03-05', '10:00:00', 'autorizado');
    ids.a2 = await insertar(ana.id_cliente, '2001-03-05', '11:30:00', 'rechazado', 'Membresía vencida');
    ids.b1 = await insertar(beto.id_cliente, '2001-03-06', '09:00:00', 'autorizado');
    ids.x1 = await insertar(null, '2001-03-07', '08:00:00', 'rechazado', 'Rostro no reconocido');
  });

  after(async () => {
    try {
      for (const id of idsAcceso) await pool.execute('DELETE FROM accesos WHERE id_acceso = ?', [id]);
      await limpiarDatosDePrueba({ usuarios, clientes });
    } finally {
      await servidor.cerrar();
      await cerrarPool();
    }
  });

  describe('listado', () => {
    it('del más reciente al más antiguo, con fecha, hora, tipo, resultado, motivo y cliente', async () => {
      const r = await listar();
      assert.equal(r.status, 200);
      assert.equal(r.cuerpo.total, 4);
      assert.deepEqual(r.cuerpo.data.map((a) => a.id_acceso), [ids.x1, ids.b1, ids.a2, ids.a1]);

      const rechazado = r.cuerpo.data.find((a) => a.id_acceso === ids.a2);
      assert.equal(rechazado.fecha, '2001-03-05');
      assert.equal(rechazado.hora, '11:30:00');
      assert.equal(rechazado.tipo, 'entrada');
      assert.equal(rechazado.resultado, 'rechazado');
      assert.equal(rechazado.motivo_rechazo, 'Membresía vencida');
      assert.deepEqual(rechazado.cliente, { id_cliente: ana.id_cliente, nombre: 'Ana', apellido: `${marca}Alfa` });

      const autorizado = r.cuerpo.data.find((a) => a.id_acceso === ids.a1);
      assert.equal(autorizado.motivo_rechazo, null);
    });

    it('un intento sin cliente identificado trae cliente null', async () => {
      const r = await listar();
      const desconocido = r.cuerpo.data.find((a) => a.id_acceso === ids.x1);
      assert.equal(desconocido.cliente, null);
      assert.equal(desconocido.motivo_rechazo, 'Rostro no reconocido');
    });

    it('pagina con page y limit (page, limit y total en la respuesta)', async () => {
      const primera = await listar('page=1&limit=3');
      assert.equal(primera.cuerpo.page, 1);
      assert.equal(primera.cuerpo.limit, 3);
      assert.equal(primera.cuerpo.total, 4);
      assert.deepEqual(ids(primera), [ids.x1, ids.b1, ids.a2]);
      const segunda = await listar('page=2&limit=3');
      assert.deepEqual(ids(segunda), [ids.a1]);
    });
  });

  describe('filtros', () => {
    it('por fecha: un día o un rango', async () => {
      const dia = await api('GET', '/accesos?desde=2001-03-05&hasta=2001-03-05', admin.token);
      assert.deepEqual(ids(dia), [ids.a2, ids.a1]);
      const desde = await api('GET', '/accesos?desde=2001-03-06&hasta=2001-03-07', admin.token);
      assert.deepEqual(ids(desde), [ids.x1, ids.b1]);
      const vacio = await api('GET', '/accesos?desde=2001-04-01&hasta=2001-04-02', admin.token);
      assert.equal(vacio.cuerpo.total, 0);
      assert.deepEqual(vacio.cuerpo.data, []);
    });

    it('por resultado', async () => {
      const rechazados = await listar('resultado=rechazado');
      assert.deepEqual(ids(rechazados), [ids.x1, ids.a2]);
      const autorizados = await listar('resultado=autorizado');
      assert.deepEqual(ids(autorizados), [ids.b1, ids.a1]);
    });

    it('por nombre o apellido del cliente (los no identificados no coinciden)', async () => {
      assert.deepEqual(ids(await listar(`q=${marca}Alfa`)), [ids.a2, ids.a1]);
      assert.deepEqual(ids(await listar('q=beto')), [ids.b1]);
      assert.deepEqual(ids(await listar(`q=${encodeURIComponent(`Ana ${marca}Alfa`)}`)), [ids.a2, ids.a1]);
      assert.equal((await listar('q=zzzNoExiste')).cuerpo.total, 0);
    });

    it('trata % y _ del texto buscado como texto, no como comodines', async () => {
      assert.equal((await listar('q=%25')).cuerpo.total, 0);
      assert.equal((await listar('q=_')).cuerpo.total, 0);
    });

    it('combina varios filtros', async () => {
      assert.deepEqual(ids(await listar(`q=${marca}Alfa&resultado=rechazado`)), [ids.a2]);
    });

    it('rechaza fechas, rangos y resultados inválidos con 400', async () => {
      const campos = (r) => (r.cuerpo?.error?.details ?? []).map((d) => d.field);
      const malaFecha = await api('GET', '/accesos?desde=2001-13-45', admin.token);
      assert.equal(malaFecha.status, 400);
      assert.ok(campos(malaFecha).includes('desde'));
      assert.equal((await api('GET', '/accesos?hasta=ayer', admin.token)).status, 400);
      const invertido = await api('GET', '/accesos?desde=2001-03-07&hasta=2001-03-05', admin.token);
      assert.equal(invertido.status, 400);
      assert.ok(campos(invertido).includes('hasta'));
      assert.equal((await listar('resultado=quizas')).status, 400);
    });
  });

  describe('permisos y proyección por rol', () => {
    it('administrador y recepcionista reciben el detalle completo', async () => {
      for (const token of [admin.token, recepcion.token]) {
        const r = await listar('', token);
        assert.equal(r.status, 200);
        const fila = r.cuerpo.data.find((a) => a.id_acceso === ids.a2);
        assert.equal(fila.tipo, 'entrada');
        assert.equal(fila.motivo_rechazo, 'Membresía vencida');
      }
    });

    it('el entrenador recibe SOLO nombre, fecha, hora y resultado', async () => {
      const r = await listar('', entrenador.token);
      assert.equal(r.status, 200);
      assert.equal(r.cuerpo.total, 4);
      for (const fila of r.cuerpo.data) {
        assert.deepEqual(Object.keys(fila).sort(), ['cliente', 'fecha', 'hora', 'id_acceso', 'resultado']);
        if (fila.cliente) assert.deepEqual(Object.keys(fila.cliente).sort(), ['apellido', 'id_cliente', 'nombre']);
      }
      const texto = JSON.stringify(r.cuerpo);
      assert.ok(!/motivo_rechazo|"tipo"|telefono|correo|direccion|Membresía vencida/.test(texto));
    });

    it('el rol cliente recibe 403 y sin sesión 401', async () => {
      assert.equal((await listar('', tokenCliente)).status, 403);
      assert.equal((await listar('', null)).status, 401);
    });

    it('los accesos no se pueden editar ni eliminar: no existen PUT, PATCH ni DELETE', async () => {
      for (const metodo of ['PUT', 'PATCH', 'DELETE']) {
        for (const ruta of ['/accesos', `/accesos/${ids.a1}`]) {
          const r = await api(metodo, ruta, admin.token, metodo === 'DELETE' ? undefined : { resultado: 'autorizado' });
          assert.equal(r.status, 404, `${metodo} ${ruta}`);
        }
      }
      const [[fila]] = await pool.execute('SELECT resultado FROM accesos WHERE id_acceso = ?', [ids.a1]);
      assert.equal(fila.resultado, 'autorizado');
    });
  });
});
