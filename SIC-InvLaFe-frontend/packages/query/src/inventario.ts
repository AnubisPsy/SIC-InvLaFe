import { resumirCuadre, type FiltroLotes, type ID } from "@invlafe/core";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { claves } from "./claves";
import { useCore } from "./contexto";

/**
 * Cuadre de galones: cada lote con sus ventas y el resumen agregado.
 *
 * El resumen se calcula aquí en vez de en el `queryFn` para que no forme parte
 * de la caché: es una derivación barata de datos que ya están en memoria.
 */
export function useCuadre(filtro?: FiltroLotes) {
  const core = useCore();

  const consulta = useQuery({
    queryKey: claves.inventario.cuadre(filtro),
    queryFn: () => core.inventario.cuadreDeLotes(filtro),
  });

  const resumen = useMemo(
    () => resumirCuadre(consulta.data ?? []),
    [consulta.data],
  );

  return { ...consulta, resumen };
}

export function useCuadreDeLote(loteId: ID | null | undefined) {
  const core = useCore();
  return useQuery({
    queryKey: claves.inventario.cuadreLote(loteId ?? ""),
    queryFn: () => core.inventario.cuadreDeLote(loteId as ID),
    enabled: Boolean(loteId),
  });
}
