/**
 * Arma la parte `?a=1&b=2` de una dirección a partir de un objeto de filtros.
 *
 * Omite los valores vacíos (`undefined`, `null`, `""`, listas vacías) y une
 * las listas con comas, que es como las lee el backend.
 */
export function conFiltros(
  ruta: string,
  filtros: Record<string, string | number | boolean | readonly string[] | null | undefined>,
): string {
  const partes: string[] = [];

  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor === undefined || valor === null || valor === "" || valor === false) continue;

    const texto = Array.isArray(valor) ? valor.join(",") : String(valor);
    if (!texto) continue;

    partes.push(`${encodeURIComponent(clave)}=${encodeURIComponent(texto)}`);
  }

  return partes.length > 0 ? `${ruta}?${partes.join("&")}` : ruta;
}

/** Codifica un id para meterlo en la ruta: `/api/compras/${id(compraId)}`. */
export const id = (valor: string | number): string => encodeURIComponent(String(valor));
