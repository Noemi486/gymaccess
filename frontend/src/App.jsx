import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './components/ui/Toast.jsx';
import Layout from './components/ui/Layout.jsx';
import RutaProtegida from './components/RutaProtegida.jsx';
import ClienteDetalle from './pages/ClienteDetalle.jsx';
import ClienteForm from './pages/ClienteForm.jsx';
import Clientes from './pages/Clientes.jsx';
import Inicio from './pages/Inicio.jsx';
import Login from './pages/Login.jsx';
import NoEncontrado from './pages/NoEncontrado.jsx';
import SinPermiso from './pages/SinPermiso.jsx';
import MiPerfil from './pages/MiPerfil.jsx';
import UsuarioForm from './pages/UsuarioForm.jsx';
import Usuarios from './pages/Usuarios.jsx';

const PERSONAL = ['administrador', 'recepcionista', 'entrenador'];
const ESCRITURA_CLIENTES = ['administrador', 'recepcionista'];

// Pantalla que exige ciertos roles (la seguridad real la valida siempre el backend).
function Con({ roles, children }) {
  return <RutaProtegida roles={roles}>{children}</RutaProtegida>;
}

function Rutas() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Todas las pantallas autenticadas comparten el mismo marco: menú lateral + barra superior */}
      <Route
        element={
          <RutaProtegida>
            <Layout />
          </RutaProtegida>
        }
      >
        <Route path="/" element={<Inicio />} />
        <Route
          path="/usuarios"
          element={
            <Con roles={['administrador']}>
              <Usuarios />
            </Con>
          }
        />
        <Route
          path="/usuarios/nuevo"
          element={
            <Con roles={['administrador']}>
              <UsuarioForm />
            </Con>
          }
        />
        <Route
          path="/usuarios/:id/editar"
          element={
            <Con roles={['administrador']}>
              <UsuarioForm />
            </Con>
          }
        />
        <Route
          path="/mi-perfil"
          element={
            <Con roles={['cliente']}>
              <MiPerfil />
            </Con>
          }
        />
        <Route
          path="/clientes"
          element={
            <Con roles={PERSONAL}>
              <Clientes />
            </Con>
          }
        />
        <Route
          path="/clientes/:id"
          element={
            <Con roles={PERSONAL}>
              <ClienteDetalle />
            </Con>
          }
        />
        <Route
          path="/clientes/nuevo"
          element={
            <Con roles={ESCRITURA_CLIENTES}>
              <ClienteForm />
            </Con>
          }
        />
        <Route
          path="/clientes/:id/editar"
          element={
            <Con roles={ESCRITURA_CLIENTES}>
              <ClienteForm />
            </Con>
          }
        />

        <Route path="/sin-permiso" element={<SinPermiso />} />
        {/* Cualquier otra dirección: con sesión muestra "No encontrado"; sin sesión lleva a /login */}
        <Route path="*" element={<NoEncontrado />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Rutas />
      </AuthProvider>
    </ToastProvider>
  );
}
