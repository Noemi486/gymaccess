import { formatearFechaCorta } from '../utils/formato.js';

// Detalle de una rutina por día (spec 004, US3 y US5). Solo lectura.
export function detalleEjercicio(e) {
  const partes = [];
  if (e.series && e.repeticiones) partes.push(`${e.series} × ${e.repeticiones}`);
  else if (e.series) partes.push(`${e.series} series`);
  else if (e.repeticiones) partes.push(e.repeticiones);
  if (e.peso_kg !== null && e.peso_kg !== undefined) partes.push(`${e.peso_kg} kg`);
  if (e.descanso_seg !== null && e.descanso_seg !== undefined) partes.push(`descanso ${e.descanso_seg} s`);
  return partes.join(' · ');
}

export default function VistaRutina({ rutina, mostrarEncabezado = true }) {
  return (
    <div className="vista-rutina">
      {mostrarEncabezado && (
        <p className="texto-suave">
          {rutina.nombre} · creada el {formatearFechaCorta(rutina.fecha_creacion)} por {rutina.entrenador.nombre}
        </p>
      )}
      {rutina.indicaciones && <p className="rutina-indicaciones">{rutina.indicaciones}</p>}
      <div className="rutina-dias">
        {rutina.dias.map((d) => (
          <section key={d.dia} className="rutina-dia" aria-label={`Día ${d.dia}`}>
            <h4>Día {d.dia}</h4>
            <ol>
              {d.ejercicios.map((e, i) => (
                <li key={i}>
                  <strong>{e.nombre}</strong>
                  {detalleEjercicio(e) && <span className="texto-suave"> · {detalleEjercicio(e)}</span>}
                  {e.instrucciones && <p className="rutina-instrucciones">{e.instrucciones}</p>}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
