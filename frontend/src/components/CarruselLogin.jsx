import { useEffect, useState } from 'react';
import { IlustracionAcceso, IlustracionCliente, IlustracionPagos } from './IlustracionAcceso.jsx';

const INTERVALO_MS = 5000;

// Cada diapositiva: frase en dos líneas (la segunda en el color de acento) y su propia ilustración.
// Hablan a todos los roles, no solo a los clientes.
export const DIAPOSITIVAS = [
  { id: 'acceso', linea1: 'Controla quién entra,', linea2: 'sin filas.', Ilustracion: IlustracionAcceso },
  { id: 'pagos', linea1: 'Membresías y pagos,', linea2: 'siempre al día.', Ilustracion: IlustracionPagos },
  { id: 'cliente', linea1: 'Consulta tu membresía', linea2: 'y tus visitas.', Ilustracion: IlustracionCliente },
];

// ¿El usuario prefiere menos movimiento? (sin matchMedia, por ejemplo en pruebas, se asume que no).
function leerMovimientoReducido() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Carrusel automático del panel de marca del inicio de sesión:
// - cambia cada 5 segundos y se pausa al pasar el mouse o al enfocar un punto;
// - los puntos son botones que llevan a cada diapositiva;
// - con "reducir movimiento" muestra solo la primera diapositiva, sin cambios ni puntos.
export default function CarruselLogin({ diapositivas = DIAPOSITIVAS, intervalo = INTERVALO_MS }) {
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [reducido, setReducido] = useState(leerMovimientoReducido);

  // Sigue los cambios de la preferencia del sistema.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const consulta = window.matchMedia('(prefers-reduced-motion: reduce)');
    const alCambiar = () => setReducido(consulta.matches);
    consulta.addEventListener?.('change', alCambiar);
    return () => consulta.removeEventListener?.('change', alCambiar);
  }, []);

  // Avanza a la siguiente diapositiva; el temporizador se reinicia con cada cambio manual o automático.
  useEffect(() => {
    if (reducido || pausado || diapositivas.length < 2) return undefined;
    const temporizador = setTimeout(() => setIndice((actual) => (actual + 1) % diapositivas.length), intervalo);
    return () => clearTimeout(temporizador);
  }, [indice, pausado, reducido, diapositivas.length, intervalo]);

  const visibles = reducido ? diapositivas.slice(0, 1) : diapositivas;
  const activa = reducido ? 0 : indice;

  return (
    <section
      className="carrusel"
      aria-roledescription="carrusel"
      aria-label="Qué puedes hacer con GymAccess"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      <div className="carrusel-pistas" aria-live="off">
        {visibles.map(({ id, linea1, linea2, Ilustracion }, posicion) => (
          <div
            key={id}
            className={`carrusel-diapositiva${posicion === activa ? ' carrusel-activa' : ''}`}
            aria-roledescription="diapositiva"
            aria-label={`${posicion + 1} de ${visibles.length}`}
            aria-hidden={posicion === activa ? undefined : 'true'}
          >
            <p className="login-frase">
              <span>{linea1}</span>
              <span className="login-frase-acento">{linea2}</span>
            </p>
            <Ilustracion />
          </div>
        ))}
      </div>

      {!reducido && diapositivas.length > 1 && (
        <div className="carrusel-puntos" role="group" aria-label="Diapositivas">
          {diapositivas.map(({ id }, posicion) => (
            <button
              key={id}
              type="button"
              className={`carrusel-punto${posicion === activa ? ' carrusel-punto-activo' : ''}`}
              aria-label={`Ir a la diapositiva ${posicion + 1} de ${diapositivas.length}`}
              aria-current={posicion === activa ? 'true' : undefined}
              onClick={() => setIndice(posicion)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
