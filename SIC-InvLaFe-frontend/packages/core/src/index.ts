/**
 * API pública de `@invlafe/core`.
 *
 * Nada fuera de este archivo debería importarse con rutas profundas: lo que no
 * esté aquí es detalle interno y puede cambiar sin aviso.
 */

// --- Núcleo compartido -------------------------------------------------------
export * from "./shared/tipos";
export * from "./shared/errores";
export * from "./shared/numeros";
export * from "./shared/fechas";
export * from "./shared/texto";
export { CONFIG_REGIONAL, CONFIG_SESION } from "./shared/config";

// --- Composición e infraestructura ------------------------------------------
export {
  crearContenedor,
  type ConfiguracionContenedor,
  type ContenedorCore,
} from "./composition/contenedor";
export {
  crearClienteSupabase,
  type AlmacenamientoSesion,
  type ClienteSupabase,
  type ConfiguracionSupabase,
} from "./infrastructure/supabase/cliente";
export type { ClienteApi, ConfiguracionApi } from "./infrastructure/http/cliente";

// --- Autenticación -----------------------------------------------------------
export type {
  Credenciales,
  Sesion,
  SesionAuth,
} from "./modules/auth/domain/entidades";
export { usuarioEstaHabilitado } from "./modules/auth/domain/entidades";
export type { ServicioAutenticacion } from "./modules/auth/domain/repositorios";
export type { CasosUsoAuth } from "./modules/auth/application/casos-uso";

// --- Acceso: usuarios, roles, módulos y permisos -----------------------------
export {
  AYUDA_NOMBRE_USUARIO,
  LARGO_MINIMO_CONTRASENA,
  type DatosRol,
  type DatosUsuario,
  type Rol,
  type Usuario,
  type UsuarioDetalle,
} from "./modules/acceso/domain/entidades";
export {
  CLAVES_MODULO,
  ETIQUETA_MODULO,
  MODULOS,
  claveDeModulo,
  modulosDesconocidos,
  modulosSinMapear,
  type ClaveModulo,
  type Modulo,
} from "./modules/acceso/domain/modulos";
export {
  ACCIONES,
  ETIQUETA_ACCION,
  SIN_PERMISOS,
  construirMapaPermisos,
  mapaPermisosVacio,
  modulosVisibles,
  puede,
  puedeVer,
  type Accion,
  type AccionesPermitidas,
  type MapaPermisos,
  type PermisoEditable,
  type PermisoRol,
} from "./modules/acceso/domain/permisos";
export type {
  CasosUsoAcceso,
  FilaMatrizPermisos,
  MatrizPermisos,
} from "./modules/acceso/application/casos-uso";

// --- Catálogos ---------------------------------------------------------------
export {
  PRODUCTOS,
  claveDeProducto,
  esAceite,
  esCombustible,
  validarContacto,
  validarProducto,
  type ClaveProducto,
  type Cliente,
  type DatosContacto,
  type DatosProducto,
  type Producto,
  type Proveedor,
} from "./modules/catalogos/domain/entidades";
export type { CasosUsoCatalogos } from "./modules/catalogos/application/casos-uso";

// --- Compras: facturas, líneas de inventario y pagos a proveedor -------------
export {
  LIMITE_LOTES_POR_DEFECTO,
  MAXIMO_LINEAS_COMPRA,
  cantidadDespachada,
  construirLedgerProveedor,
  estadoDePago,
  loteAgotado,
  porcentajeConsumido,
  saldoDeCompra,
  validarAbonoProveedor,
  validarNuevaCompra,
  valorDeLinea,
  valorFacturaSugerido,
  type Compra,
  type CompraDetalle,
  type EstadoPago,
  type FilaLedgerProveedor,
  type FiltroCompras,
  type FiltroLotes,
  type LoteCompra,
  type LoteCompraDetalle,
  type NuevaCompra,
  type NuevaLineaCompra,
  type NuevoPagoProveedor,
  type PagoProveedor,
} from "./modules/compras/domain/entidades";
export type { CasosUsoCompras } from "./modules/compras/application/casos-uso";

// --- Ventas y cobros ---------------------------------------------------------
export {
  LIMITE_VENTAS_POR_DEFECTO,
  agruparCobrosPorCliente,
  calcularValorTotal,
  construirLedgerCliente,
  estadoDeCobro,
  totalCobrado,
  validarAbonoCliente,
  validarNuevaVenta,
  type EstadoCobro,
  type FilaLedgerCliente,
  type FiltroVentas,
  type NuevaVenta,
  type NuevoPagoCliente,
  type PagoCliente,
  type ResumenCobroCliente,
  type Venta,
  type VentaDetalle,
} from "./modules/ventas/domain/entidades";
export type { CasosUsoVentas } from "./modules/ventas/application/casos-uso";

// --- Inventario: cuadre de galones -------------------------------------------
export {
  construirCuadre,
  resumirCuadre,
  type CuadreLote,
  type ResumenCuadre,
} from "./modules/inventario/domain/entidades";
export type { CasosUsoInventario } from "./modules/inventario/application/casos-uso";

// --- Cotizaciones ------------------------------------------------------------
export {
  ESTADOS_COTIZACION,
  ESTADOS_COTIZACION_LISTA,
  MAXIMO_LINEAS_COTIZACION,
  estaConvertida,
  normalizarEstado,
  puedeConvertirseEnVenta,
  puedeEditarse,
  subtotalDeLinea,
  totalCotizado,
  validarConversion,
  validarCotizacion,
  type Cotizacion,
  type CotizacionDetalle,
  type DatosConversion,
  type DatosCotizacion,
  type EstadoCotizacion,
  type FiltroCotizaciones,
  type LineaConversion,
  type LineaCotizacion,
  type LineaCotizacionDetalle,
  type LineaCotizacionEntrada,
} from "./modules/cotizaciones/domain/entidades";
export type {
  CasosUsoCotizaciones,
  ResultadoConversion,
} from "./modules/cotizaciones/application/casos-uso";
