import type {
  DatosConversion,
  DatosCotizacion,
  EstadoCotizacion,
  FiltroCotizaciones,
  ID,
} from "@invlafe/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { claves } from "./claves";
import { useCore } from "./contexto";

export function useCotizaciones(filtro?: FiltroCotizaciones) {
  const core = useCore();
  return useQuery({
    queryKey: claves.cotizaciones.lista(filtro),
    queryFn: () => core.cotizaciones.listar(filtro),
  });
}

export function useCotizacion(id: ID | null | undefined) {
  const core = useCore();
  return useQuery({
    queryKey: claves.cotizaciones.cotizacion(id ?? ""),
    queryFn: () => core.cotizaciones.obtener(id as ID),
    enabled: Boolean(id),
  });
}

export function useCrearCotizacion() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: (datos: DatosCotizacion) => core.cotizaciones.crear(datos),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.cotizaciones.todo });
    },
  });
}

export function useActualizarCotizacion() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: ({ id, datos }: { id: ID; datos: DatosCotizacion }) =>
      core.cotizaciones.actualizar(id, datos),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.cotizaciones.todo });
    },
  });
}

export function useCambiarEstadoCotizacion() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: ({ id, estado }: { id: ID; estado: EstadoCotizacion }) =>
      core.cotizaciones.cambiarEstado(id, estado),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.cotizaciones.todo });
    },
  });
}

export function useEliminarCotizacion() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: (id: ID) => core.cotizaciones.eliminar(id),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.cotizaciones.todo });
    },
  });
}

/**
 * Convertir genera una venta por línea cotizada, así que invalida también
 * compras e inventario: la existencia de varios lotes acaba de bajar.
 */
export function useConvertirCotizacion() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: ({ id, datos }: { id: ID; datos: DatosConversion }) =>
      core.cotizaciones.convertirEnVenta(id, datos),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.cotizaciones.todo });
      clienteQuery.invalidateQueries({ queryKey: claves.ventas.todo });
      clienteQuery.invalidateQueries({ queryKey: claves.compras.todo });
      clienteQuery.invalidateQueries({ queryKey: claves.inventario.todo });
    },
  });
}
