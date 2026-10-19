import { formatearCantidad, formatearFecha, type LoteCompraDetalle } from "@invlafe/core";
import { useLotesDisponibles } from "@invlafe/query";
import { Selector } from "../../../shared/ui";

/**
 * Selector de lote de origen con la existencia visible en cada opción.
 *
 * Mostrar los galones disponibles en la propia etiqueta evita el error más
 * común al despachar: elegir un lote que ya no da para la cantidad pedida.
 */
export function SelectorLote({
  valor,
  alCambiar,
  error,
  id,
  ariaProps,
  productoId,
}: {
  valor: string;
  alCambiar: (loteId: string, lote: LoteCompraDetalle | undefined) => void;
  error?: boolean;
  id?: string;
  ariaProps?: Record<string, unknown>;
  /**
   * Restringe la lista al producto indicado. Lo usa la conversión de
   * cotizaciones: cada línea solo puede salir de un lote de su producto, y
   * ofrecer los demás solo sirve para equivocarse.
   */
  productoId?: string;
}) {
  const lotes = useLotesDisponibles(productoId ? { productoId } : undefined);

  const opciones = (lotes.data ?? []).map((lote) => ({
    valor: lote.id,
    etiqueta: [
      formatearFecha(lote.fecha),
      lote.producto?.nombre ?? "Producto",
      lote.numeroFactura ? `Fact. ${lote.numeroFactura}` : null,
      `${formatearCantidad(lote.cantidadDisponible)} disp.`,
    ]
      .filter(Boolean)
      .join(" · "),
  }));

  return (
    <Selector
      id={id}
      {...ariaProps}
      opciones={opciones}
      value={valor}
      error={error}
      marcador={
        lotes.isPending
          ? "Cargando lotes…"
          : opciones.length === 0
            ? productoId
              ? "No hay lotes de este producto con existencia"
              : "No hay lotes con existencia"
            : "Selecciona el lote de origen"
      }
      disabled={!lotes.isPending && opciones.length === 0}
      onChange={(evento) => {
        const seleccionado = (lotes.data ?? []).find(
          (lote) => lote.id === evento.target.value,
        );
        alCambiar(evento.target.value, seleccionado);
      }}
    />
  );
}
