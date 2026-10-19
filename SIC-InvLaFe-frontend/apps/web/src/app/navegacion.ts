import { MODULOS, type ClaveModulo } from "@invlafe/core";
import {
  Building2,
  Droplet,
  FileText,
  Fuel,
  HandCoins,
  LayoutDashboard,
  Package,
  Scale,
  ShieldCheck,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Mapa único entre módulo de negocio, ruta e icono.
 *
 * El menú lateral, el enrutador y el panel de inicio leen todos de aquí, así
 * que añadir un módulo es tocar un solo archivo y no tres.
 */
export interface EntradaNavegacion {
  modulo: ClaveModulo;
  etiqueta: string;
  ruta: string;
  icono: LucideIcon;
  descripcion: string;
}

export const NAVEGACION: readonly EntradaNavegacion[] = [
  {
    modulo: MODULOS.PAGO_PROVEEDOR,
    etiqueta: "Pago a proveedor",
    ruta: "/pagos-proveedor",
    icono: Truck,
    descripcion: "Lotes de compra, facturas y abonos al proveedor.",
  },
  {
    modulo: MODULOS.CONTROL_CARGA,
    etiqueta: "Control de carga",
    ruta: "/control-carga",
    icono: Fuel,
    descripcion: "Registro de ventas y despacho desde cada lote.",
  },
  {
    modulo: MODULOS.COBRO_CLIENTES,
    etiqueta: "Cobro a clientes",
    ruta: "/cobros",
    icono: HandCoins,
    descripcion: "Saldos por cliente y registro de abonos.",
  },
  {
    modulo: MODULOS.CUADRE_GALONES,
    etiqueta: "Cuadre de galones",
    ruta: "/cuadre",
    icono: Scale,
    descripcion: "Trazabilidad de entradas y salidas por lote.",
  },
  {
    modulo: MODULOS.CONTROL_ACEITE,
    etiqueta: "Control de aceite",
    ruta: "/control-aceite",
    icono: Droplet,
    descripcion: "Lotes, saldos y abonos del producto aceite.",
  },
  {
    modulo: MODULOS.COTIZACIONES,
    etiqueta: "Cotizaciones",
    ruta: "/cotizaciones",
    icono: FileText,
    descripcion: "Cotizaciones a clientes y conversión en venta.",
  },
  {
    modulo: MODULOS.CLIENTES,
    etiqueta: "Clientes",
    ruta: "/clientes",
    icono: Users,
    descripcion: "Directorio de clientes para ventas, cobros y cotizaciones.",
  },
  {
    modulo: MODULOS.PROVEEDORES,
    etiqueta: "Proveedores",
    ruta: "/proveedores",
    icono: Building2,
    descripcion: "Directorio de proveedores para lotes de compra y pagos.",
  },
  {
    modulo: MODULOS.PRODUCTOS,
    etiqueta: "Productos",
    ruta: "/productos",
    icono: Package,
    descripcion: "Catálogo de productos para compras, ventas y cotizaciones.",
  },
  {
    modulo: MODULOS.USUARIOS_ROLES,
    etiqueta: "Usuarios y roles",
    ruta: "/usuarios",
    icono: ShieldCheck,
    descripcion: "Altas de usuarios, roles y permisos por módulo.",
  },
] as const;

/** El panel de inicio no está protegido por módulo: lo ve cualquier sesión. */
export const RUTA_INICIO = {
  etiqueta: "Inicio",
  ruta: "/",
  icono: LayoutDashboard,
} as const;

export function entradaDeModulo(modulo: ClaveModulo): EntradaNavegacion | undefined {
  return NAVEGACION.find((entrada) => entrada.modulo === modulo);
}
