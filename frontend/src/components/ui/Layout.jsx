import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { menuParaRol, seccionDeRuta } from '../../config/menu.js';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

// Marco común de las pantallas autenticadas: menú lateral por rol + encabezado + contenido.
// El título del encabezado sale de la sección del menú que corresponde a la ruta actual.
export default function Layout() {
  const { usuario, cerrarSesion } = useAuth();
  const { pathname } = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const titulo = seccionDeRuta(pathname)?.etiqueta ?? 'GymAccess';

  return (
    <div className="app">
      <Sidebar grupos={menuParaRol(usuario.rol)} abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
      <div className="app-principal">
        <Topbar titulo={titulo} usuario={usuario} onCerrarSesion={cerrarSesion} />
        <main className="contenido">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
