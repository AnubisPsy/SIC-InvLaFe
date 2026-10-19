/**
 * Forma cruda de las filas tal como las devuelve el backend (snake_case, igual
 * que las columnas de la base).
 *
 * Estos tipos son el contrato con la API y viven solo en infraestructura: el
 * dominio nunca los ve. Los ids se declaran `string | number` porque los uuid
 * llegan como texto y los bigint como número; los mappers normalizan.
 */
export const TABLAS = {
  PROVEEDORES: "proveedores",
  CLIENTES: "clientes",
  PRODUCTOS: "productos",
  COMPRAS: "compras",
  LOTES_COMPRA: "lotes_compra",
  PAGOS_PROVEEDOR: "pagos_proveedor",
  VENTAS: "ventas",
  PAGOS_CLIENTE: "pagos_cliente",
  COTIZACIONES: "cotizaciones",
  COTIZACION_ITEMS: "cotizacion_items",
  USUARIOS: "usuarios",
  ROLES: "roles",
  MODULOS: "modulos",
  PERMISOS_ROL: "permisos_rol",
} as const;

export type IdCrudo = string | number;

export interface FilaProveedor {
  id: IdCrudo;
  nombre: string;
  telefono: string | null;
  creado_en: string;
}

export interface FilaCliente {
  id: IdCrudo;
  nombre: string;
  telefono: string | null;
  creado_en: string;
}

export interface FilaProducto {
  id: IdCrudo;
  nombre: string;
}

/** Cabecera de compra: una factura del proveedor con una o varias líneas. */
export interface FilaCompra {
  id: IdCrudo;
  proveedor_id: IdCrudo;
  fecha: string;
  numero_factura: string | null;
  valor_factura: number | string;
  creado_en: string;
}

/**
 * Línea de compra. Sigue llamándose `lotes_compra` porque es la unidad de
 * inventario a la que apuntan las ventas: lo que cambió es que ya no lleva
 * encima los datos de la factura, que viven en `compras`.
 */
export interface FilaLoteCompra {
  id: IdCrudo;
  compra_id: IdCrudo;
  producto_id: IdCrudo;
  cantidad_comprada: number | string;
  precio_unitario: number | string;
  cantidad_disponible: number | string;
  creado_en: string;
}

export interface FilaPagoProveedor {
  id: IdCrudo;
  compra_id: IdCrudo;
  fecha: string;
  monto: number | string;
  creado_en: string;
}

export interface FilaVenta {
  id: IdCrudo;
  lote_compra_id: IdCrudo;
  cliente_id: IdCrudo;
  fecha: string;
  numero_factura: string | null;
  cantidad: number | string;
  precio_unitario: number | string;
  valor_total: number | string;
  saldo_pendiente: number | string;
  /** Desglose en barriles, p. ej. «25x60». `null` en ventas anteriores a la columna. */
  detalle: string | null;
  creado_en: string;
}

export interface FilaPagoCliente {
  id: IdCrudo;
  venta_id: IdCrudo;
  fecha: string;
  monto: number | string;
  creado_en: string;
}

export interface FilaCotizacion {
  id: IdCrudo;
  cliente_id: IdCrudo;
  fecha: string;
  /** Nota libre. Antes describía la cotización entera; ahora la acompaña. */
  detalle: string | null;
  estado: string | null;
  venta_id: IdCrudo | null;
  creado_en: string;
}

/** Línea cotizada. `venta_id` se llena al convertirla. */
export interface FilaCotizacionItem {
  id: IdCrudo;
  cotizacion_id: IdCrudo;
  producto_id: IdCrudo;
  cantidad: number | string;
  precio_unitario: number | string;
  venta_id: IdCrudo | null;
  creado_en: string;
}

export interface FilaUsuario {
  id: IdCrudo;
  nombre: string;
  correo: string;
  /**
   * Nombre de usuario para iniciar sesión, alternativo al correo. `null` en las
   * filas de quien solo entra por correo, que es lo normal.
   */
  usuario: string | null;
  telefono: string | null;
  rol_id: IdCrudo | null;
  activo: boolean | null;
  /**
   * Obliga a definir una contraseña nueva antes de poder usar la aplicación.
   * `null` cuenta como `false`: las filas más antiguas nunca la tuvieron.
   */
  debe_cambiar_contrasena: boolean | null;
  creado_en: string;
}

export interface FilaRol {
  id: IdCrudo;
  nombre: string;
  creado_en: string;
}

export interface FilaModulo {
  id: IdCrudo;
  nombre: string;
}

export interface FilaPermisoRol {
  id: IdCrudo;
  rol_id: IdCrudo;
  modulo_id: IdCrudo;
  puede_ver: boolean | null;
  puede_crear: boolean | null;
  puede_editar: boolean | null;
  puede_eliminar: boolean | null;
}

// --- Normalización de valores crudos ----------------------------------------

/** Todo id se maneja como texto en el dominio, venga como `bigint` o `uuid`. */
export function aId(valor: IdCrudo | null | undefined): string {
  return valor === null || valor === undefined ? "" : String(valor);
}

export function aIdOpcional(valor: IdCrudo | null | undefined): string | null {
  return valor === null || valor === undefined ? null : String(valor);
}

/**
 * Las columnas `numeric` de Postgres llegan como string cuando la precisión
 * excede la de un double. Convertir siempre evita concatenaciones accidentales
 * ("100" + 50 = "10050") al sumar saldos.
 */
export function aNumero(valor: number | string | null | undefined): number {
  if (valor === null || valor === undefined) return 0;
  const numero = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

export function aBooleano(valor: boolean | null | undefined, porDefecto = false): boolean {
  return valor === null || valor === undefined ? porDefecto : valor;
}

/** Recorta `timestamptz` a `YYYY-MM-DD` para las columnas `date`. */
export function aFecha(valor: string | null | undefined): string {
  return (valor ?? "").slice(0, 10);
}
