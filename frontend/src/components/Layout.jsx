const ETIQUETAS_ROL = {
  administrador: 'Administrador',
  recepcionista: 'Recepcionista',
  entrenador: 'Entrenador',
  cliente: 'Cliente',
};

// Marco común de las pantallas: encabezado con el usuario y su rol, y botón para cerrar sesión.
// `navegacion` es un nodo opcional (enlaces del menú según el rol).
export default function Layout({ usuario, onCerrarSesion, navegacion, children }) {
  return (
    <div className="layout">
      <header className="encabezado">
        <strong className="marca">GymAccess</strong>
        {navegacion}
        {usuario && (
          <div className="sesion">
            <span>
              {usuario.nombre} · {ETIQUETAS_ROL[usuario.rol] ?? usuario.rol}
            </span>
            <button type="button" className="boton boton-secundario" onClick={onCerrarSesion}>
              Cerrar sesión
            </button>
          </div>
        )}
      </header>
      <main className="contenido">{children}</main>
    </div>
  );
}
