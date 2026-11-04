import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorApi, solicitar } from '../api/cliente.js';
import Button from '../components/ui/Button.jsx';
import FormField from '../components/ui/FormField.jsx';
import Input from '../components/ui/Input.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Spinner from '../components/ui/Spinner.jsx';

const CAMPOS = ['nombre', 'correo', 'password', 'telefono', 'especialidad'];
const VACIO = { nombre: '', correo: '', password: '', telefono: '', especialidad: '' };

// Alta (/entrenadores/nuevo: cuenta + ficha en un solo formulario) y edición (/entrenadores/:id/editar:
// nombre, teléfono y especialidad). Solo administrador (spec 004, FR-001 y FR-002).
export default function EntrenadorForm() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navegar = useNavigate();
  const [valores, setValores] = useState(VACIO);
  const [original, setOriginal] = useState(null);
  const [cargando, setCargando] = useState(editando);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!editando) return undefined;
    let activo = true;
    solicitar(`/entrenadores/${id}`)
      .then((e) => {
        if (!activo) return;
        setOriginal(e);
        setValores({ ...VACIO, nombre: e.nombre, correo: e.correo, telefono: e.telefono ?? '', especialidad: e.especialidad ?? '' });
      })
      .catch((e) => activo && setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'ERROR', 'No se pudo cargar el entrenador.')))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [editando, id]);

  const cambiar = (campo) => (evento) => setValores((actual) => ({ ...actual, [campo]: evento.target.value }));

  async function alEnviar(evento) {
    evento.preventDefault();
    setError(null);
    let cuerpo;
    if (editando) {
      cuerpo = {};
      if (valores.nombre !== original.nombre) cuerpo.nombre = valores.nombre;
      if (valores.telefono !== (original.telefono ?? '')) cuerpo.telefono = valores.telefono;
      if (valores.especialidad !== (original.especialidad ?? '')) cuerpo.especialidad = valores.especialidad;
      if (Object.keys(cuerpo).length === 0) {
        setError(new ErrorApi(0, 'SIN_CAMBIOS', 'No hay cambios para guardar.'));
        return;
      }
    } else {
      cuerpo = { ...valores };
    }
    setEnviando(true);
    try {
      await solicitar(editando ? `/entrenadores/${id}` : '/entrenadores', { metodo: editando ? 'PATCH' : 'POST', cuerpo });
      navegar('/entrenadores', { state: { mensaje: editando ? 'Entrenador actualizado.' : 'Entrenador registrado. Ya puede iniciar sesión.' } });
    } catch (e) {
      setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'ERROR', 'Ocurrió un error inesperado. Inténtalo de nuevo.'));
    } finally {
      setEnviando(false);
    }
  }

  const detalles = error?.detalles ?? [];
  const mostrarGeneral = error && (detalles.length === 0 || detalles.some((d) => !CAMPOS.includes(d.field)));
  const errorDe = (campo) => error?.mensajeDeCampo(campo);

  if (cargando) return <Spinner etiqueta="Cargando entrenador…" />;
  if (editando && !original) {
    return (
      <section className="formulario-pagina">
        <div className="mensaje mensaje-error" role="alert">
          {error?.message ?? 'El entrenador no existe.'}
        </div>
        <Button to="/entrenadores" variante="secundario">
          Volver a la lista
        </Button>
      </section>
    );
  }

  return (
    <section className="formulario-pagina">
      <PageHeader
        titulo={editando ? 'Editar entrenador' : 'Nuevo entrenador'}
        descripcion={editando ? undefined : 'Se crea su cuenta para iniciar sesión (rol entrenador) y su ficha.'}
      />
      {mostrarGeneral && (
        <div className="mensaje mensaje-error" role="alert">
          {error.message}
        </div>
      )}
      <form onSubmit={alEnviar} noValidate className="card">
        <FormField id="nombre" etiqueta="Nombre" error={errorDe('nombre')}>
          <Input value={valores.nombre} onChange={cambiar('nombre')} maxLength={120} required />
        </FormField>
        <FormField
          id="correo"
          etiqueta="Correo"
          ayuda={editando ? 'El correo y la contraseña se cambian en Usuarios y roles.' : 'Con este correo inicia sesión.'}
          error={errorDe('correo')}
        >
          <Input type="email" value={valores.correo} onChange={cambiar('correo')} disabled={editando} maxLength={150} required />
        </FormField>
        {!editando && (
          <FormField id="password" etiqueta="Contraseña" ayuda="De 8 a 72 caracteres, con al menos una letra y un número." error={errorDe('password')}>
            <Input type="password" autoComplete="new-password" value={valores.password} onChange={cambiar('password')} maxLength={72} required />
          </FormField>
        )}
        <FormField id="telefono" etiqueta="Teléfono (opcional)" error={errorDe('telefono')}>
          <Input type="tel" value={valores.telefono} onChange={cambiar('telefono')} maxLength={20} />
        </FormField>
        <FormField id="especialidad" etiqueta="Especialidad (opcional)" ayuda="Por ejemplo: fuerza, funcional, yoga." error={errorDe('especialidad')}>
          <Input value={valores.especialidad} onChange={cambiar('especialidad')} maxLength={100} />
        </FormField>
        <div className="acciones">
          <Button to="/entrenadores" variante="secundario">
            Cancelar
          </Button>
          <Button type="submit" cargando={enviando}>
            Guardar
          </Button>
        </div>
      </form>
    </section>
  );
}
