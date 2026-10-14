import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { menuParaRol, seccionDeRuta } from '../../config/menu.js';
import { CambiarPasswordProvider, useCambiarPassword } from '../CambiarPassword.jsx';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

function MarcoComun() {
  const { usuario, cerrarSesion } = useAuth();
  const { abrir: abrirCambiarPassword } = useCambiarPassword();
  const { pathname } = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const titulo = seccionDeRuta(pathname)?.etiqueta ?? 'GymAccess';

  return (
    <div className="app">
      <Sidebar grupos={menuParaRol(usuario.rol)} abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
      <div className="app-principal">
        <Topbar
          titulo={titulo}
          usuario={usuario}
          onCerrarSesion={cerrarSesion}
          onCambiarPassword={abrirCambiarPassword}
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
