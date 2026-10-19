import type {
  FiltroVentas,
  ID,
  NuevaVenta,
  NuevoPagoCliente,
} from "@invlafe/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { claves } from "./claves";
import { useCore } from "./contexto";

export function useVentas(filtro?: FiltroVentas) {
  const core = useCore();
  return useQuery({
    queryKey: claves.ventas.lista(filtro),
    queryFn: () => core.ventas.listarVentas(filtro),
  });
}

export function useVenta(id: ID | null | undefined) {
  const core = useCore();
  return useQuery({
    queryKey: claves.ventas.venta(id ?? ""),
    queryFn: () => core.ventas.obtenerVenta(id as ID),
    enabled: Boolean(id),
  });
}

export function useAbonosCliente(ventaId: ID | null | undefined) {
  const core = useCore();
  return useQuery({
    queryKey: claves.ventas.abonos(ventaId ?? ""),
    queryFn: () => core.ventas.listarAbonosDeVenta(ventaId as ID),
    enabled: Boolean(ventaId),
  });
}

/** Saldos agrupados por cliente para la pantalla de cobros. */
export function useCobrosPorCliente(filtro?: FiltroVentas) {
  const core = useCore();
  return useQuery({
    queryKey: claves.ventas.cobrosPorCliente(filtro),
    queryFn: () => core.ventas.resumenCobrosPorCliente(filtro),
  });
}

/** Ledger histórico (ventas + abonos) para el reporte de cobro a clientes. */
export function useMovimientosCliente(filtro?: FiltroVentas) {
  const core = useCore();
  return useQuery({
    queryKey: claves.ventas.movimientos(filtro),
    queryFn: () => core.ventas.listarMovimientosCliente(filtro),
  });
}

/**
 * Registrar una venta mueve tres cosas: la venta, la existencia del lote y el
 * cuadre. Los tres módulos se invalidan juntos para que ninguna pantalla quede
 * mostrando galones que ya se despacharon.
 */
export function useRegistrarVenta() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: (datos: NuevaVenta) => core.ventas.registrarVenta(datos),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.ventas.todo });
      clienteQuery.invalidateQueries({ queryKey: claves.compras.todo });
      clienteQuery.invalidateQueries({ queryKey: claves.inventario.todo });
    },
  });
}

export function useAnularVenta() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: (id: ID) => core.ventas.anularVenta(id),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.ventas.todo });
      clienteQuery.invalidateQueries({ queryKey: claves.compras.todo });
      clienteQuery.invalidateQueries({ queryKey: claves.inventario.todo });
    },
  });
}

export function useRegistrarAbonoCliente() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: (datos: NuevoPagoCliente) => core.ventas.registrarAbonoCliente(datos),
    onSuccess: () => {
      // El saldo vive en la propia venta, así que basta con el módulo de ventas.
      clienteQuery.invalidateQueries({ queryKey: claves.ventas.todo });
    },
  });
}
