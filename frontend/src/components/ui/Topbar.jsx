import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import Avatar, { iniciales } from './Avatar.jsx';

export const ETIQUETAS_ROL = {
  administrador: 'Administrador',
  recepcionista: 'Recepcionista',
  entrenador: 'Entrenador',
  cliente: 'Cliente',
};

export { iniciales };

// Encabezado: título de la sección a la izquierda y menú de usuario (avatar con iniciales) a la derecha.
// El menú de usuario se cierra con Escape, al pulsar fuera o al elegir una opción.
export default function Topbar({ titulo, usuario, onCerrarSesion }) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef(null);
  const boton = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const alPulsar = (evento) => {
      if (contenedor.current && !contenedor.current.contains(evento.target)) setAbierto(false);
    };
    const alTeclear = (evento) => {
      if (evento.key === 'Escape') {
        setAbierto(false);
        boton.current?.focus();
      }
    };
    document.addEventListener('mousedown', alPulsar);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('mousedown', alPulsar);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [abierto]);

  const rol = ETIQUETAS_ROL[usuario.rol] ?? usuario.rol;

  return (
    <header className="topbar">
      <p className="topbar-titulo">{titulo}</p>

      <div className="menu-usuario" ref={contenedor}>
        <button
          ref={boton}
          type="button"
          className="menu-usuario-boton"
          aria-haspopup="menu"
          aria-expanded={abierto}
          aria-label={`Menú de usuario: ${usuario.nombre}, ${rol}`}
          onClick={() => setAbierto((actual) => !actual)}
        >
          <Avatar nombre={usuario.nombre} />
          <span className="menu-usuario-datos" aria-hidden="true">
            <span className="menu-usuario-nombre">{usuario.nombre}</span>
            <span className="menu-usuario-rol">{rol}</span>
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>

        {abierto && (
          <div className="menu-usuario-panel" role="menu">
            <div className="menu-usuario-cabecera">
              <strong>{usuario.nombre}</strong>
              <span>{rol}</span>
            </div>
            <button
              type="button"
              role="menuitem"
              className="menu-usuario-opcion"
              onClick={() => {
                setAbierto(false);
                onCerrarSesion();
              }}
            >
              <LogOut size={16} aria-hidden="true" />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
