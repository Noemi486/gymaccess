// Diferencias de cada medida con el avance anterior que tenga esa medida (spec 004, FR-015).
// Entrada: avances del más reciente al más antiguo. Salida: los mismos avances con `diferencias`
// { peso_kg, grasa_pct, cintura_cm } (null si no hay dato propio o no hay un avance anterior con ese dato).

export const MEDIDAS = ['peso_kg', 'grasa_pct', 'cintura_cm'];
const DECIMALES = { peso_kg: 2, grasa_pct: 1, cintura_cm: 1 };

const numero = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const redondear = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

export function conDiferencias(avances) {
  return avances.map((avance, i) => {
    const diferencias = {};
    for (const medida of MEDIDAS) {
      const actual = numero(avance[medida]);
      const anterior = actual === null ? undefined : avances.slice(i + 1).find((a) => numero(a[medida]) !== null);
      diferencias[medida] = anterior ? redondear(actual - numero(anterior[medida]), DECIMALES[medida]) : null;
    }
    return { ...avance, diferencias };
  });
}
