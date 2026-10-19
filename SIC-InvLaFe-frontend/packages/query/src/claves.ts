import type {
  FiltroCompras,
  FiltroCotizaciones,
  FiltroLotes,
  FiltroVentas,
  ID,
} from "@invlafe/core";

/**
 * Fábrica de claves de caché.
 *
 * Están jerarquizadas a propósito: invalidar `["compras"]` alcanza a lotes,
 * detalles y abonos de una vez, que es justo lo que hace falta después de
 * registrar una venta.
 */
export const claves = {
  sesion: ["sesion"] as const,

  catalogos: {
    todo: ["catalogos"] as const,
    proveedores: ["catalogos", "proveedores"] as const,
    clientes: ["catalogos", "clientes"] as const,
    productos: ["catalogos", "productos"] as const,
  },

  compras: {
    todo: ["compras"] as const,
    lista: (filtro?: FiltroCompras) => ["compras", "lista", filtro ?? {}] as const,
    compra: (id: ID) => ["compras", "compra", id] as const,
    lotes: (filtro?: FiltroLotes) => ["compras", "lotes", filtro ?? {}] as const,
    disponibles: (filtro?: FiltroLotes) =>
      ["compras", "lotes-disponibles", filtro ?? {}] as const,
    lote: (id: ID) => ["compras", "lote", id] as const,
    abonos: (compraId: ID) => ["compras", "abonos", compraId] as const,
    movimientos: (filtro?: FiltroCompras) =>
      ["compras", "movimientos", filtro ?? {}] as const,
  },

  ventas: {
    todo: ["ventas"] as const,
    lista: (filtro?: FiltroVentas) => ["ventas", "lista", filtro ?? {}] as const,
    venta: (id: ID) => ["ventas", "venta", id] as const,
    abonos: (ventaId: ID) => ["ventas", "abonos", ventaId] as const,
    cobrosPorCliente: (filtro?: FiltroVentas) =>
      ["ventas", "cobros-por-cliente", filtro ?? {}] as const,
    movimientos: (filtro?: FiltroVentas) =>
      ["ventas", "movimientos", filtro ?? {}] as const,
  },

  inventario: {
    todo: ["inventario"] as const,
    cuadre: (filtro?: FiltroLotes) => ["inventario", "cuadre", filtro ?? {}] as const,
    cuadreLote: (id: ID) => ["inventario", "cuadre-lote", id] as const,
  },

  cotizaciones: {
    todo: ["cotizaciones"] as const,
    lista: (filtro?: FiltroCotizaciones) =>
      ["cotizaciones", "lista", filtro ?? {}] as const,
    cotizacion: (id: ID) => ["cotizaciones", "cotizacion", id] as const,
  },

  acceso: {
    todo: ["acceso"] as const,
    usuarios: ["acceso", "usuarios"] as const,
    roles: ["acceso", "roles"] as const,
    modulos: ["acceso", "modulos"] as const,
    matrizPermisos: (rolId: ID) => ["acceso", "matriz-permisos", rolId] as const,
  },
} as const;
