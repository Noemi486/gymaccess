// Cliente HTTP del frontend. Toda la información pasa por la API REST del backend:
// el frontend nunca se conecta a MySQL.

const BASE = '/api';
const CLAVE_TOKEN = 'gym_token';
const CLAVE_USUARIO = 'gym_usuario';

// sessionStorage puede fallar (modo privado, datos bloqueados): todo va con try/catch.
export function obtenerToken() {
  try {
    return sessionStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

export function obtenerUsuarioGuardado() {
  try {
    const texto = sessionStorage.getItem(CLAVE_USUARIO);
    return texto ? JSON.parse(texto) : null;
  } catch {
    return null;
  }
}

export function guardarSesion(token, usuario) {
  try {
    sessionStorage.setItem(CLAVE_TOKEN, token);
    sessionStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
  } catch {
    // Sin almacenamiento la sesión solo dura mientras la página siga abierta.
  }
}

export function limpiarSesion() {
  try {
    sessionStorage.removeItem(CLAVE_TOKEN);
    sessionStorage.removeItem(CLAVE_USUARIO);
  } catch {
    // Nada que limpiar.
  }
}

// Error de la API: conserva el estado HTTP, el código y los detalles por campo.
export class ErrorApi extends Error {
  constructor(status, code, message, detalles = []) {
    super(message);
    this.name = 'ErrorApi';
    this.status = status;
    this.code = code;
    this.detalles = detalles;
  }

  // Mensaje de un campo concreto (para mostrarlo junto al input), o undefined.
  mensajeDeCampo(campo) {
    return this.detalles.find((detalle) => detalle.field === campo)?.message;
  }
}

// solicitar('/clientes?page=1', { metodo: 'GET' }) o { metodo: 'POST', cuerpo: {...} }
export async function solicitar(ruta, { metodo = 'GET', cuerpo } = {}) {
  const token = obtenerToken();
  const cabeceras = { Accept: 'application/json' };
  if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
  if (token) cabeceras.Authorization = `Bearer ${token}`;

  let respuesta;
  try {
    respuesta = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi(0, 'NETWORK_ERROR', 'No se pudo conectar con el servidor. Inténtalo de nuevo.');
  }

  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    datos = null;
  }

  if (!respuesta.ok) {
    // Con una sesión abierta, un 401 significa que venció o fue desactivada.
    // (El 401 de un login fallido no redirige porque aún no hay token.)
    if (respuesta.status === 401 && token) {
      limpiarSesion();
      window.location.assign('/login');
    }
    const error = datos?.error;
    throw new ErrorApi(
      respuesta.status,
      error?.code ?? 'ERROR',
      error?.message ?? 'Ocurrió un error inesperado. Inténtalo de nuevo más tarde.',
      error?.details ?? [],
    );
  }

  return datos;
}
