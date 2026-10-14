// Iniciales para el avatar: primera letra de las dos primeras palabras del nombre.
export function iniciales(nombre = '') {
  const letras = nombre
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((palabra) => palabra[0].toUpperCase());
  return letras.join('') || '?';
}

// Avatar circular con las iniciales. Es decorativo: el nombre siempre aparece también como texto.
export default function Avatar({ nombre, tamano = 'normal' }) {
  return (
    <span className={`avatar${tamano === 'grande' ? ' avatar-grande' : ''}`} aria-hidden="true">
      {iniciales(nombre)}
    </span>
  );
}
