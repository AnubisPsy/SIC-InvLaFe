import type {
  FiltroCompras,
  FiltroLotes,
  ID,
  NuevaCompra,
  NuevoPagoProveedor,
} from "@invlafe/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { claves } from "./claves";
import { useCore } from "./contexto";

/** Facturas del proveedor con sus líneas y su saldo. */
export function useCompras(filtro?: FiltroCompras) {
  const core = useCore();
  return useQuery({
    queryKey: claves.compras.lista(filtro),
    queryFn: () => core.compras.listarCompras(filtro),
  });
}

export function useCompra(id: ID | null | undefined) {
  const core = useCore();
  return useQuery({
    queryKey: claves.compras.compra(id ?? ""),
    queryFn: () => core.compras.obtenerCompra(id as ID),
    enabled: Boolean(id),
  });
}

/** Líneas de inventario sueltas: las usa el cuadre. */
export function useLotes(filtro?: FiltroLotes) {
  const core = useCore();
  return useQuery({
    queryKey: claves.compras.lotes(filtro),
    queryFn: () => core.compras.listarLotes(filtro),
  });
}

/** Líneas con existencia > 0: alimenta el selector del registro de ventas. */
export function useLotesDisponibles(filtro?: FiltroLotes) {
  const core = useCore();
  return useQuery({
    queryKey: claves.compras.disponibles(filtro),
    queryFn: () => core.compras.listarLotesDisponibles(filtro),
  });
}

export function useLote(id: ID | null | undefined) {
  const core = useCore();
  return useQuery({
    queryKey: claves.compras.lote(id ?? ""),
    queryFn: () => core.compras.obtenerLote(id as ID),
    enabled: Boolean(id),
  });
}

export function useAbonosProveedor(compraId: ID | null | undefined) {
  const core = useCore();
  return useQuery({
    queryKey: claves.compras.abonos(compraId ?? ""),
    queryFn: () => core.compras.listarAbonos(compraId as ID),
    enabled: Boolean(compraId),
  });
}

/** Ledger histórico (facturas + abonos) para el reporte de pago a proveedor. */
export function useMovimientosProveedor(filtro?: FiltroCompras) {
  const core = useCore();
  return useQuery({
    queryKey: claves.compras.movimientos(filtro),
    queryFn: () => core.compras.listarMovimientosProveedor(filtro),
  });
}

export function useRegistrarCompra() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: (datos: NuevaCompra) => core.compras.registrarCompra(datos),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.compras.todo });
      // Una compra nueva es una entrada de inventario: el cuadre cambia.
      clienteQuery.invalidateQueries({ queryKey: claves.inventario.todo });
    },
  });
}

export function useAnularCompra() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: (id: ID) => core.compras.anularCompra(id),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.compras.todo });
      clienteQuery.invalidateQueries({ queryKey: claves.inventario.todo });
    },
  });
}

export function useRegistrarAbonoProveedor() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: (datos: NuevoPagoProveedor) => core.compras.registrarAbono(datos),
    onSuccess: () => {
      // El saldo de la compra se deriva de los abonos, así que se invalida el
      // módulo entero y no solo la lista de abonos.
      clienteQuery.invalidateQueries({ queryKey: claves.compras.todo });
    },
  });
}

export function useEliminarAbonoProveedor() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: (id: ID) => core.compras.eliminarAbono(id),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.compras.todo });
    },
  });
}
