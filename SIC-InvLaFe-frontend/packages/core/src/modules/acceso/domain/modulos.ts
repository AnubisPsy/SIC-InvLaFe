import { normalizar } from "../../../shared/texto";
import type { ID } from "../../../shared/tipos";

/**
 * Catálogo de módulos que el frontend sabe proteger.
 *
 * Estas claves son del frontend, no ids de base: la tabla `modulos` guarda un
 * nombre libre y los ids cambian entre entornos. `claveDeModulo` casa ambos
 * mundos por nombre normalizado.
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
  PRODUCTOS: "productos",
  USUARIOS_ROLES: "usuarios_roles",
} as const;

export type ClaveModulo = (typeof MODULOS)[keyof typeof MODULOS];

export const CLAVES_MODULO: readonly ClaveModulo[] = Object.values(MODULOS);

/**
 * Nombres alternativos con los que el módulo puede estar dado de alta en la
 * tabla `modulos`. Si un nombre real no aparece aquí, agrégalo a la lista en
 * lugar de renombrar la fila en base: es el único punto de acoplamiento entre
 * los datos y el frontend.
 */
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
  [MODULOS.PRODUCTOS]: [
    "productos",
    "catalogo_productos",
    "directorio_productos",
    "maestro_productos",
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

/** Etiqueta de negocio del módulo, usada en la matriz de permisos. */
export const ETIQUETA_MODULO: Record<ClaveModulo, string> = {
  [MODULOS.PAGO_PROVEEDOR]: "Pago a proveedor",
  [MODULOS.CONTROL_CARGA]: "Control de carga",
  [MODULOS.COBRO_CLIENTES]: "Cobro a clientes",
  [MODULOS.CUADRE_GALONES]: "Cuadre de galones",
  [MODULOS.CONTROL_ACEITE]: "Control de aceite",
  [MODULOS.COTIZACIONES]: "Cotizaciones",
  [MODULOS.CLIENTES]: "Clientes",
  [MODULOS.PROVEEDORES]: "Proveedores",
  [MODULOS.PRODUCTOS]: "Productos",
  [MODULOS.USUARIOS_ROLES]: "Usuarios y roles",
};

export interface Modulo {
  id: ID;
  nombre: string;
  /** `null` cuando el nombre en base no casa con ninguna clave conocida. */
  clave: ClaveModulo | null;
}

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

/**
 * Claves que el frontend protege pero que no tienen fila en `modulos`.
 *
 * Sin fila no hay permisos que asignar, así que nadie podrá entrar. La pantalla
 * de Usuarios y roles muestra esta lista para que el administrador cree las
 * filas faltantes en vez de quedarse sin diagnóstico.
 */
export function modulosSinMapear(modulos: readonly Modulo[]): ClaveModulo[] {
  const mapeados = new Set(
    modulos.map((modulo) => modulo.clave).filter((clave): clave is ClaveModulo => clave !== null),
  );
  return CLAVES_MODULO.filter((clave) => !mapeados.has(clave));
}

/** Filas de `modulos` cuyo nombre no reconocemos; se ignoran al calcular permisos. */
export function modulosDesconocidos(modulos: readonly Modulo[]): Modulo[] {
  return modulos.filter((modulo) => modulo.clave === null);
}
