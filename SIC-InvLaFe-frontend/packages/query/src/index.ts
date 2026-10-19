/**
 * API pública de `@invlafe/query`.
 *
 * Hooks de acceso a datos sobre `@invlafe/core`. No renderizan nada, así que
 * la app de React Native puede importarlos tal cual.
 */
export { ProveedorCore, useCore } from "./contexto";
export { claves } from "./claves";

export * from "./auth";
export * from "./catalogos";
export * from "./compras";
export * from "./ventas";
export * from "./inventario";
export * from "./cotizaciones";
export * from "./acceso";
