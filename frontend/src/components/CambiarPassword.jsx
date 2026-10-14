import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorApi, solicitar } from '../api/cliente.js';
import Button from './ui/Button.jsx';
import FormField from './ui/FormField.jsx';
import Input from './ui/Input.jsx';
import { useToast } from './ui/Toast.jsx';

const ContextoCambiarPassword = createContext(null);

const CAMPOS = ['password_actual', 'password_nueva', 'password_confirmacion'];
const VACIO = { password_actual: '', password_nueva: '', password_confirmacion: '' };

// Diálogo para cambiar la contraseña de la cuenta en sesión. Se monta solo mientras está abierto,
// así que cada vez que se abre empieza con los campos vacíos.
function CambiarPasswordDialog({ onCerrar }) {
  const { mostrar } = useToast();
  const [valores, setValores] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const primerCampo = useRef(null);

  useEffect(() => {
    primerCampo.current?.focus();
    const alTeclear = (evento) => {
      if (evento.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  const cambiar = (campo) => (evento) => setValores((actual) => ({ ...actual, [campo]: evento.target.value }));

  async function enviar(evento) {
    evento.preventDefault();
    setErrorGeneral(null);

    // Comprobaciones previas para no enviar datos que se sabe que el servidor rechazará.
    const previos = {};
    if (!valores.password_actual) previos.password_actual = 'Escribe tu contraseña actual.';
    if (!valores.password_nueva) previos.password_nueva = 'Escribe la nueva contraseña.';
    if (!valores.password_confirmacion) previos.password_confirmacion = 'Confirma la nueva contraseña.';
    else if (valores.password_nueva !== valores.password_confirmacion) {
      previos.password_confirmacion = 'Las contraseñas no coinciden.';
    }
    setErrores(previos);
    if (Object.keys(previos).length > 0) return;

    setEnviando(true);
    try {
      const respuesta = await solicitar('/auth/password', { metodo: 'PATCH', cuerpo: valores });
      mostrar({ tipo: 'exito', texto: respuesta?.message ?? 'Contraseña actualizada correctamente.' });
      onCerrar();
    } catch (e) {
      if (!(e instanceof ErrorApi)) {
        setErrorGeneral('No se pudo cambiar la contraseña. Inténtalo de nuevo.');
      } else {
        const delServidor = Object.fromEntries(
          CAMPOS.map((campo) => [campo, e.mensajeDeCampo(campo)]).filter(([, mensaje]) => mensaje),
        );
        setErrores(delServidor);
        // Sin detalles por campo (por ejemplo, el bloqueo temporal) se muestra el mensaje general.
        if (Object.keys(delServidor).length === 0) setErrorGeneral(e.message);
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fondo-modal" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-cambiar-password">
        <h2 id="titulo-cambiar-password">Cambiar contraseña</h2>
        <form onSubmit={enviar} noValidate>
          {errorGeneral && (
            <div className="mensaje mensaje-error" role="alert">
              {errorGeneral}
            </div>
          )}
          <FormField id="password_actual" etiqueta="Contraseña actual" error={errores.password_actual}>
            <Input
              ref={primerCampo}
              type="password"
              autoComplete="current-password"
              value={valores.password_actual}
              onChange={cambiar('password_actual')}
              maxLength={200}
            />
          </FormField>
          <FormField
            id="password_nueva"
            etiqueta="Nueva contraseña"
            ayuda="De 8 a 72 caracteres, con al menos una letra y un número."
            error={errores.password_nueva}
          >
            <Input
              type="password"
              autoComplete="new-password"
              value={valores.password_nueva}
              onChange={cambiar('password_nueva')}
              maxLength={200}
            />
          </FormField>
          <FormField id="password_confirmacion" etiqueta="Confirmar nueva contraseña" error={errores.password_confirmacion}>
            <Input
              type="password"
              autoComplete="new-password"
              value={valores.password_confirmacion}
              onChange={cambiar('password_confirmacion')}
              maxLength={200}
            />
          </FormField>
          <div className="acciones">
            <Button variante="secundario" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" cargando={enviando}>
              Actualizar contraseña
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Proveedor: permite abrir el diálogo desde cualquier parte (menú del avatar, "Mi cuenta"…).
export function CambiarPasswordProvider({ children }) {
  const [abierto, setAbierto] = useState(false);
  const abrir = useCallback(() => setAbierto(true), []);
  const cerrar = useCallback(() => setAbierto(false), []);
  const valor = useMemo(() => ({ abrir }), [abrir]);

  return (
    <ContextoCambiarPassword.Provider value={valor}>
      {children}
      {abierto && <CambiarPasswordDialog onCerrar={cerrar} />}
    </ContextoCambiarPassword.Provider>
  );
}

export function useCambiarPassword() {
  const contexto = useContext(ContextoCambiarPassword);
  if (!contexto) throw new Error('useCambiarPassword debe usarse dentro de CambiarPasswordProvider.');
  return contexto;
}
