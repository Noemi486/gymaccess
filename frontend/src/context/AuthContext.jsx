import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  guardarSesion,
  limpiarSesion,
  obtenerToken,
  obtenerUsuarioGuardado,
  solicitar,
} from '../api/cliente.js';

// Estado de la sesión: el usuario autenticado y las acciones de entrar y salir.
// El token vive en sessionStorage (lo gestiona api/cliente.js).
// Ocultar opciones según el rol es solo comodidad: los permisos reales los valida el backend.

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => (obtenerToken() ? obtenerUsuarioGuardado() : null));

  // Si hay una sesión guardada, se confirma con el backend (rol y estado vigentes).
  useEffect(() => {
    if (!obtenerToken()) return undefined;
    let activo = true;
    solicitar('/auth/me')
      .then((vigente) => {
        if (!activo) return;
        guardarSesion(obtenerToken(), vigente);
        setUsuario(vigente);
      })
      .catch(() => {
        // Un 401 ya limpia la sesión y redirige a /login (ver api/cliente.js).
      });
    return () => {
      activo = false;
    };
  }, []);

  const iniciarSesion = useCallback(async (correo, password) => {
    const datos = await solicitar('/auth/login', { metodo: 'POST', cuerpo: { correo, password } });
    guardarSesion(datos.token, datos.usuario);
    setUsuario(datos.usuario);
    return datos.usuario;
  }, []);

  const cerrarSesion = useCallback(() => {
    limpiarSesion();
    setUsuario(null);
  }, []);

  const valor = useMemo(
    () => ({ usuario, rol: usuario?.rol ?? null, iniciarSesion, cerrarSesion }),
    [usuario, iniciarSesion, cerrarSesion],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return contexto;
}
