import { crearClienteApi } from "../infrastructure/http/cliente";
import { crearAlmacenSesion, type AlmacenamientoSesion } from "../infrastructure/http/sesion";

import { crearCasosUsoAcceso, type CasosUsoAcceso } from "../modules/acceso/application/casos-uso";
import {
  crearRepositorioModulos,
  crearRepositorioPermisos,
  crearRepositorioRoles,
  crearRepositorioUsuarios,
} from "../modules/acceso/infrastructure/repositorios.http";

import { crearCasosUsoAuth, type CasosUsoAuth } from "../modules/auth/application/casos-uso";
import { crearServicioAutenticacion } from "../modules/auth/infrastructure/servicio.backend";

import {
  crearCasosUsoCatalogos,
  type CasosUsoCatalogos,
} from "../modules/catalogos/application/casos-uso";
import {
  crearRepositorioClientes,
  crearRepositorioProductos,
  crearRepositorioProveedores,
} from "../modules/catalogos/infrastructure/repositorios.http";

import {
  crearCasosUsoCompras,
  type CasosUsoCompras,
} from "../modules/compras/application/casos-uso";
import {
  crearRepositorioCompras,
  crearRepositorioLotes,
  crearRepositorioPagosProveedor,
} from "../modules/compras/infrastructure/repositorios.http";

import {
  crearCasosUsoCotizaciones,
  type CasosUsoCotizaciones,
} from "../modules/cotizaciones/application/casos-uso";
import { crearRepositorioCotizaciones } from "../modules/cotizaciones/infrastructure/repositorios.http";

import {
  crearCasosUsoInventario,
  type CasosUsoInventario,
} from "../modules/inventario/application/casos-uso";

import {
  crearCasosUsoVentas,
  type CasosUsoVentas,
} from "../modules/ventas/application/casos-uso";
import {
  crearRepositorioPagosCliente,
  crearRepositorioVentas,
} from "../modules/ventas/infrastructure/repositorios.http";

/**
 * Punto único donde el dominio se une con el backend.
 *
 * Es lo único que la app (web o React Native) necesita construir: todo lo demás
 * se consume a través de estos casos de uso. Cambiar de backend significa
 * escribir otro contenedor, no tocar los módulos.
 */
export interface ConfiguracionContenedor {
  /** URL del backend (`VITE_API_URL`), sin barra final. */
  apiUrl: string;
  /**
   * Dónde guardar la sesión. En la web, `window.localStorage`; en React Native,
   * un adaptador de AsyncStorage. Sin él, la sesión vive solo en memoria.
   */
  almacenamiento?: AlmacenamientoSesion;
}

export interface ContenedorCore {
  auth: CasosUsoAuth;
  catalogos: CasosUsoCatalogos;
  compras: CasosUsoCompras;
  ventas: CasosUsoVentas;
  inventario: CasosUsoInventario;
  cotizaciones: CasosUsoCotizaciones;
  acceso: CasosUsoAcceso;
}

export function crearContenedor(config: ConfiguracionContenedor): ContenedorCore {
  const sesion = crearAlmacenSesion(config.almacenamiento);
  const api = crearClienteApi({ urlBase: config.apiUrl }, sesion);

  // --- Repositorios (adaptadores de salida) ---
  const repoProveedores = crearRepositorioProveedores(api);
  const repoClientes = crearRepositorioClientes(api);
  const repoProductos = crearRepositorioProductos(api);
  const repoCompras = crearRepositorioCompras(api);
  const repoLotes = crearRepositorioLotes(api);
  const repoPagosProveedor = crearRepositorioPagosProveedor(api);
  const repoVentas = crearRepositorioVentas(api);
  const repoPagosCliente = crearRepositorioPagosCliente(api);
  const repoCotizaciones = crearRepositorioCotizaciones(api);
  const repoUsuarios = crearRepositorioUsuarios(api);
  const repoRoles = crearRepositorioRoles(api);
  const repoModulos = crearRepositorioModulos(api);
  const repoPermisos = crearRepositorioPermisos(api);
  const servicioAuth = crearServicioAutenticacion(api, sesion);

  // --- Casos de uso. El orden importa: compras depende de catálogos,
  // inventario de compras, y cotizaciones de ventas.
  const catalogos = crearCasosUsoCatalogos({
    proveedores: repoProveedores,
    clientes: repoClientes,
    productos: repoProductos,
  });

  const compras = crearCasosUsoCompras({
    compras: repoCompras,
    lotes: repoLotes,
    pagos: repoPagosProveedor,
    catalogos,
  });

  const ventas = crearCasosUsoVentas({
    ventas: repoVentas,
    pagos: repoPagosCliente,
    lotes: repoLotes,
  });

  const inventario = crearCasosUsoInventario({ compras, ventas: repoVentas });

  const cotizaciones = crearCasosUsoCotizaciones({
    cotizaciones: repoCotizaciones,
    ventas,
  });

  const acceso = crearCasosUsoAcceso({
    usuarios: repoUsuarios,
    roles: repoRoles,
    modulos: repoModulos,
    permisos: repoPermisos,
  });

  const auth = crearCasosUsoAuth({
    auth: servicioAuth,
    usuarios: repoUsuarios,
    modulos: repoModulos,
    permisos: repoPermisos,
  });

  return {
    auth,
    catalogos,
    compras,
    ventas,
    inventario,
    cotizaciones,
    acceso,
  };
}
