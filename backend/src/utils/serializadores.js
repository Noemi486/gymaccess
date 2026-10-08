// Vista completa de un cliente (administrador, recepcionista y el propio cliente).
// La vista reducida del entrenador se arma aparte (utils/vistaCliente.js, historia US4).
export function clientePublico(fila) {
  return {
    id_cliente: fila.id_cliente,
    nombre: fila.nombre,
    apellido: fila.apellido,
    correo: fila.correo ?? null,
    telefono: fila.telefono,
    direccion: fila.direccion ?? null,
    fecha_registro: fila.fecha_registro,
    estado: fila.estado,
  };
}

// Forma pública de un usuario: NUNCA incluye `password` (el hash) ni ningún otro campo extra.
export function usuarioPublico(fila) {
  return {
    id_usuario: fila.id_usuario,
    nombre: fila.nombre,
    correo: fila.correo,
    rol: fila.rol,
    estado: fila.estado,
    id_cliente: fila.id_cliente ?? null,
    fecha_registro: fila.fecha_registro,
  };
}
