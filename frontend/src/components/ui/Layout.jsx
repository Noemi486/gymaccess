import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { menuParaRol, seccionDeRuta } from '../../config/menu.js';
import { CambiarPasswordProvider, useCambiarPassword } from '../CambiarPassword.jsx';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

// Ancho desde el cual el menú es fijo (coincide con el punto de corte del CSS).
const ANCHO_MENU_FIJO = 1024;

function MarcoComun() {
  const { usuario, cerrarSesion } = useAuth();
  const { abrir: abrirCambiarPassword } = useCambiarPassword();
  const { pathname } = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const botonMenu = useRef(null);

  const titulo = seccionDeRuta(pathname)?.etiqueta ?? 'GymAccess';

  // Cierra el menú y, si se pidió, devuelve el foco al botón que lo abre (Escape o fondo oscuro).
  const cerrarMenu = useCallback((devolverFoco = false) => {
    setMenuAbierto(false);
    if (devolverFoco) botonMenu.current?.focus();
  }, []);

  // Cada navegación cierra el menú en pantallas pequeñas.
  useEffect(() => {
    setMenuAbierto(false);
  }, [pathname]);

  // Con el menú abierto: Escape lo cierra y el fondo de la página no se desplaza.
  useEffect(() => {
    if (!menuAbierto) return undefined;
    const alTeclear = (evento) => {
      if (evento.key === 'Escape') cerrarMenu(true);
    };
    document.addEventListener('keydown', alTeclear);
    const overflowOriginal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = overflowOriginal;
    };
  }, [menuAbierto, cerrarMenu]);

  // Si la ventana se agranda hasta el ancho del menú fijo, el panel superpuesto deja de tener sentido.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const consulta = window.matchMedia(`(min-width: ${ANCHO_MENU_FIJO}px)`);
    const alCambiar = (evento) => {
      if (evento.matches) setMenuAbierto(false);
    };
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, []);

  return (
    <div className="app">
      <Sidebar grupos={menuParaRol(usuario.rol)} abierto={menuAbierto} onCerrar={() => cerrarMenu(false)} />
      {menuAbierto && <div className="sidebar-fondo" aria-hidden="true" onClick={() => cerrarMenu(true)} />}
      <div className="app-principal">
        <Topbar
          titulo={titulo}
          usuario={usuario}
          onCerrarSesion={cerrarSesion}
          onCambiarPassword={abrirCambiarPassword}
          onMenu={() => setMenuAbierto((actual) => !actual)}
          menuAbierto={menuAbierto}
          botonMenuRef={botonMenu}
        />
        <main className="contenido">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// Marco común de las pantallas autenticadas: menú lateral por rol + encabezado + contenido.
// El título del encabezado sale de la sección del menú que corresponde a la ruta actual.
// El proveedor de "Cambiar contraseña" permite abrir el diálogo desde el avatar o desde "Mi cuenta".
export default function Layout() {
  return (
    <CambiarPasswordProvider>
      <MarcoComun />
    </CambiarPasswordProvider>
  );
}
