const PAGINA_POR_DEFECTO = 1;
const LIMITE_POR_DEFECTO = 20;
const LIMITE_MAXIMO = 100;

function enteroPositivo(valor, porDefecto) {
  const numero = Number.parseInt(valor, 10);
  return Number.isInteger(numero) && numero > 0 ? numero : porDefecto;
}

// Lee `page` y `limit` de la consulta: página 1 y 20 por defecto, máximo 100 por página.
export function leerPaginacion(query = {}) {
  const page = enteroPositivo(query.page, PAGINA_POR_DEFECTO);
  const limit = Math.min(enteroPositivo(query.limit, LIMITE_POR_DEFECTO), LIMITE_MAXIMO);
  return { page, limit, offset: (page - 1) * limit };
}
