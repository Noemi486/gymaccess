import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import Spinner from './Spinner.jsx';

// Botón con variantes: principal, secundario, peligro y fantasma.
// Con `to` se muestra como enlace de navegación con el mismo aspecto.
// Con `cargando` queda deshabilitado y muestra un indicador de carga.
const Button = forwardRef(function Button(
  { variante = 'principal', cargando = false, icono = null, to, type = 'button', className = '', children, ...resto },
  ref,
) {
  const clases = `btn${variante === 'principal' ? '' : ` btn-${variante}`} ${className}`.trim();

  if (to) {
    return (
      <Link ref={ref} to={to} className={clases} {...resto}>
        {icono}
        {children}
      </Link>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      className={clases}
      {...resto}
      disabled={cargando || resto.disabled}
      aria-busy={cargando || undefined}
    >
      {cargando ? <Spinner etiqueta="Procesando…" /> : icono}
      {children}
    </button>
  );
});

export default Button;
