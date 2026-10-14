import { cloneElement, isValidElement } from 'react';

// Campo de formulario: etiqueta, control, ayuda y error asociados entre sí.
// El control hijo (Input, Select…) recibe id, aria-describedby y aria-invalid.
// Con `etiquetaOculta` la etiqueta solo la leen los lectores de pantalla (el campo usa un placeholder).
export default function FormField({ id, etiqueta, ayuda, error, etiquetaOculta = false, children }) {
  const idAyuda = ayuda ? `${id}-ayuda` : undefined;
  const idError = error ? `${id}-error` : undefined;
  const describedBy = [idAyuda, idError].filter(Boolean).join(' ') || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })
    : children;

  return (
    <div className="campo">
      <label htmlFor={id} className={etiquetaOculta ? 'solo-lectores' : undefined}>
        {etiqueta}
      </label>
      {control}
      {ayuda && (
        <span id={idAyuda} className="ayuda">
          {ayuda}
        </span>
      )}
      {error && (
        <span id={idError} className="error-campo" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
