import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { Dumbbell } from 'lucide-react';

// Menú lateral. `grupos` es el resultado de menuParaRol(rol): [{ bloque, secciones }].
// La opción activa lleva aria-current="page" y se resalta con fondo suave y barra de acento.
// En pantallas pequeñas es un panel que se abre con `abierto`; al abrirse, el foco pasa a su primera opción.
export default function Sidebar({ grupos, abierto = false, onCerrar }) {
  const nav = useRef(null);

  useEffect(() => {
    if (abierto) nav.current?.querySelector('a')?.focus();
  }, [abierto]);

  return (
    <aside id="menu-lateral" className={`sidebar${abierto ? ' sidebar-abierto' : ''}`}>
      <div className="sidebar-marca">
        <span className="sidebar-logo" aria-hidden="true">
          <Dumbbell size={20} />
        </span>
        <strong>GymAccess</strong>
      </div>
      <nav ref={nav} aria-label="Menú principal" className="sidebar-nav">
        {grupos.map(({ bloque, secciones }) => (
          <div key={bloque.id} className="sidebar-grupo">
            <p className="sidebar-bloque">{bloque.etiqueta}</p>
            <ul>
              {secciones.map((seccion) => {
                const Icono = seccion.icono;
                return (
                  <li key={seccion.id}>
                    <NavLink
                      to={seccion.ruta}
                      end={seccion.ruta === '/'}
                      className="sidebar-enlace"
                      onClick={onCerrar}
                    >
                      <Icono size={18} aria-hidden="true" />
                      <span>{seccion.etiqueta}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
