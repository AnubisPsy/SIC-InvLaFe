import { normalizar } from "../../compartido/validacion.js";

/**
 * Catálogo de módulos protegidos y sus nombres alternativos en la tabla
 * `modulos`.
 *
 * Copia de `packages/core/src/modules/acceso/domain/modulos.ts` del frontend.
 * La tabla guarda un nombre libre ("Usuarios y roles") y los ids cambian entre
 * entornos, así que el cruce se hace por nombre normalizado. **Si se añade un
 * alias en el frontend, hay que añadirlo también aquí**, o el backend denegará
 * acciones que la interfaz sí ofrece.
 */
export const MODULOS = {
  PAGO_PROVEEDOR: "pago_proveedor",
  CONTROL_CARGA: "control_carga",
  COBRO_CLIENTES: "cobro_clientes",
  CUADRE_GALONES: "cuadre_galones",
  CONTROL_ACEITE: "control_aceite",
  COTIZACIONES: "cotizaciones",
  CLIENTES: "clientes",
  PROVEEDORES: "proveedores",
  USUARIOS_ROLES: "usuarios_roles",
} as const;

export type ClaveModulo = (typeof MODULOS)[keyof typeof MODULOS];

const ALIAS_MODULO: Record<ClaveModulo, readonly string[]> = {
  // Ojo: `proveedores` a secas ya no está aquí. Desde que existe el módulo de
  // catálogo con ese nombre, la palabra suelta significa "el directorio de
  // proveedores", no "los pagos que les hacemos".
  [MODULOS.PAGO_PROVEEDOR]: [
    "pago_proveedor",
    "pagos_proveedor",
    "pago_a_proveedor",
    "pagos_a_proveedores",
    "pago_proveedores",
    "compras",
  ],
  [MODULOS.CONTROL_CARGA]: [
    "control_carga",
    "control_de_carga",
    "carga",
    "ventas",
    "despacho",
  ],
  [MODULOS.COBRO_CLIENTES]: [
    "cobro_clientes",
    "cobro_a_clientes",
    "cobros_clientes",
    "cobros",
    "cuentas_por_cobrar",
  ],
  [MODULOS.CUADRE_GALONES]: [
    "cuadre_galones",
    "cuadre_de_galones",
    "cuadre_de_galones_cargados",
    "cuadre",
    "inventario",
  ],
  [MODULOS.CONTROL_ACEITE]: [
    "control_aceite",
    "control_de_aceite",
    "aceite",
    "lubricantes",
  ],
  [MODULOS.COTIZACIONES]: ["cotizaciones", "cotizacion", "presupuestos"],
  [MODULOS.CLIENTES]: [
    "clientes",
    "catalogo_clientes",
    "directorio_clientes",
    "maestro_clientes",
  ],
  [MODULOS.PROVEEDORES]: [
    "proveedores",
    "catalogo_proveedores",
    "directorio_proveedores",
    "maestro_proveedores",
  ],
  [MODULOS.USUARIOS_ROLES]: [
    "usuarios_roles",
    "usuarios_y_roles",
    "usuarios",
    "roles",
    "administracion",
    "seguridad",
  ],
};

/** Etiqueta de negocio del módulo, para los mensajes de error. */
export const ETIQUETA_MODULO: Record<ClaveModulo, string> = {
  [MODULOS.PAGO_PROVEEDOR]: "Pago a proveedor",
  [MODULOS.CONTROL_CARGA]: "Control de carga",
  [MODULOS.COBRO_CLIENTES]: "Cobro a clientes",
  [MODULOS.CUADRE_GALONES]: "Cuadre de galones",
  [MODULOS.CONTROL_ACEITE]: "Control de aceite",
  [MODULOS.COTIZACIONES]: "Cotizaciones",
  [MODULOS.CLIENTES]: "Clientes",
  [MODULOS.PROVEEDORES]: "Proveedores",
  [MODULOS.USUARIOS_ROLES]: "Usuarios y roles",
};

/** `null` cuando el nombre en base no casa con ninguna clave conocida. */
export function claveDeModulo(nombre: string | null | undefined): ClaveModulo | null {
  const normalizado = normalizar(nombre);
  if (!normalizado) return null;

  for (const [clave, alias] of Object.entries(ALIAS_MODULO) as [
    ClaveModulo,
    readonly string[],
  ][]) {
    if (alias.includes(normalizado)) return clave;
  }
  return null;
}

export type Accion = "ver" | "crear" | "editar" | "eliminar";

export interface AccionesPermitidas {
  ver: boolean;
  crear: boolean;
  editar: boolean;
  eliminar: boolean;
}

export const SIN_PERMISOS: AccionesPermitidas = {
  ver: false,
  crear: false,
  editar: false,
  eliminar: false,
};
