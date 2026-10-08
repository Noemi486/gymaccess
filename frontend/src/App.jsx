import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import RutaProtegida from './components/RutaProtegida.jsx';
import ClienteDetalle from './pages/ClienteDetalle.jsx';
import ClienteForm from './pages/ClienteForm.jsx';
import Clientes from './pages/Clientes.jsx';
import Inicio from './pages/Inicio.jsx';
import Login from './pages/Login.jsx';
import MiPerfil from './pages/MiPerfil.jsx';
import UsuarioForm from './pages/UsuarioForm.jsx';
import Usuarios from './pages/Usuarios.jsx';

// Pantalla privada: exige sesión (y opcionalmente ciertos roles) y la envuelve con el marco común.
function Privada({ roles, children }) {
  const { usuario, cerrarSesion } = useAuth();
  return (
    <RutaProtegida roles={roles}>
      <Layout usuario={usuario} onCerrarSesion={cerrarSesion}>
        {children}
      </Layout>
    </RutaProtegida>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <Privada>
              <Inicio />
            </Privada>
          }
        />
        <Route
          path="/usuarios"
          element={
            <Privada roles={['administrador']}>
              <Usuarios />
            </Privada>
          }
        />
        <Route
          path="/usuarios/nuevo"
          element={
            <Privada roles={['administrador']}>
              <UsuarioForm />
            </Privada>
          }
        />
        <Route
          path="/usuarios/:id/editar"
          element={
            <Privada roles={['administrador']}>
              <UsuarioForm />
            </Privada>
          }
        />
        <Route
          path="/mi-perfil"
          element={
            <Privada roles={['cliente']}>
              <MiPerfil />
            </Privada>
          }
        />
        <Route
          path="/clientes"
          element={
            <Privada roles={['administrador', 'recepcionista', 'entrenador']}>
              <Clientes />
            </Privada>
          }
        />
        <Route
          path="/clientes/:id"
          element={
            <Privada roles={['administrador', 'recepcionista', 'entrenador']}>
              <ClienteDetalle />
            </Privada>
          }
        />
        <Route
          path="/clientes/nuevo"
          element={
            <Privada roles={['administrador', 'recepcionista']}>
              <ClienteForm />
            </Privada>
          }
        />
        <Route
          path="/clientes/:id/editar"
          element={
            <Privada roles={['administrador', 'recepcionista']}>
              <ClienteForm />
            </Privada>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
