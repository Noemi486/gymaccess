import EmptyState from './EmptyState.jsx';

// Tabla con encabezado fijo, filas con hover y estado vacío.
// columnas: [{ clave, etiqueta, render?(fila) }]; filas: arreglo de objetos con `id`.
export default function Table({ columnas, filas, vacio, etiquetaTabla }) {
  const sinFilas = !filas || filas.length === 0;
  return (
    <div className="tabla-contenedor">
      <table aria-label={etiquetaTabla}>
        <thead>
          <tr>
            {columnas.map((columna) => (
              <th key={columna.clave} scope="col">
                {columna.etiqueta}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!sinFilas &&
            filas.map((fila, indice) => (
              <tr key={fila.id ?? indice}>
                {columnas.map((columna) => (
                  <td key={columna.clave}>{columna.render ? columna.render(fila) : fila[columna.clave]}</td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
      {sinFilas && (vacio ?? <EmptyState titulo="Sin resultados" texto="No hay registros para mostrar." />)}
    </div>
  );
}
