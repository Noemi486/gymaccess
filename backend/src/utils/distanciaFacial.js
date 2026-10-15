// Comparación de descriptores faciales (research R4).
// Distancia euclidiana entre dos vectores de 128 valores. Umbral por defecto: 0.5, más estricto que el
// 0.6 que sugiere la biblioteca, para favorecer rechazar ante la duda.

export const UMBRAL_COINCIDENCIA = 0.5;

export function distanciaEuclidiana(a, b) {
  if (a.length !== b.length) throw new Error('Los descriptores deben tener el mismo tamaño.');
  let suma = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diferencia = a[i] - b[i];
    suma += diferencia * diferencia;
  }
  return Math.sqrt(suma);
}

// candidatos: [{ id_cliente, descriptor }] (un cliente puede aparecer varias veces).
// Resultado:
//   { tipo: 'clara', id_cliente, distancia }  exactamente UN cliente distinto dentro del umbral
//   { tipo: 'ninguna' }                       ningún cliente dentro del umbral
//   { tipo: 'ambigua' }                       dos o más clientes distintos dentro del umbral
// Nunca se autoriza por un parecido dudoso: ambigua se trata como no reconocido.
export function buscarCoincidencia(descriptor, candidatos, umbral = UMBRAL_COINCIDENCIA) {
  const mejorPorCliente = new Map();
  for (const candidato of candidatos) {
    const distancia = distanciaEuclidiana(descriptor, candidato.descriptor);
    if (distancia > umbral) continue;
    const actual = mejorPorCliente.get(candidato.id_cliente);
    if (actual === undefined || distancia < actual) mejorPorCliente.set(candidato.id_cliente, distancia);
  }

  if (mejorPorCliente.size === 0) return { tipo: 'ninguna' };
  if (mejorPorCliente.size > 1) return { tipo: 'ambigua' };
  const [[id_cliente, distancia]] = mejorPorCliente;
  return { tipo: 'clara', id_cliente, distancia };
}
