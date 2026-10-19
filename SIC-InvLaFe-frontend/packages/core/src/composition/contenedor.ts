import { crearClienteApi } from "../infrastructure/http/cliente";
import {
  crearClienteSupabase,
  type ClienteSupabase,
  type ConfiguracionSupabase,
} from "../infrastructure/supabase/cliente";

import { crearCasosUsoAcceso, type CasosUsoAcceso } from "../modules/acceso/application/casos-uso";
import { crearRepositorioUsuariosBackend } from "../modules/acceso/infrastructure/repositorios.backend";
import {
  crearRepositorioModulos,
  crearRepositorioPermisos,
  crearRepositorioRoles,
  crearRepositorioUsuarios,
} from "../modules/acceso/infrastructure/repositorios.supabase";

import { crearCasosUsoAuth, type CasosUsoAuth } from "../modules/auth/application/casos-uso";
import { crearServicioAutenticacion } from "../modules/auth/infrastructure/servicio.supabase";

import {
  crearCasosUsoCatalogos,
  type CasosUsoCatalogos,
} from "../modules/catalogos/application/casos-uso";
import {
  crearRepositorioClientes,
  crearRepositorioProductos,
  crearRepositorioProveedores,
} from "../modules/catalogos/infrastructure/repositorios.supabase";

import {
  crearCasosUsoCompras,
  type CasosUsoCompras,
} from "../modules/compras/application/casos-uso";
import {
  crearRepositorioCompras,
  crearRepositorioLotes,
  crearRepositorioPagosProveedor,
} from "../modules/compras/infrastructure/repositorios.supabase";

import {
  crearCasosUsoCotizaciones,
  type CasosUsoCotizaciones,
} from "../modules/cotizaciones/application/casos-uso";
import { crearRepositorioCotizaciones } from "../modules/cotizaciones/infrastructure/repositorios.supabase";

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
} from "../modules/ventas/infrastructure/repositorios.supabase";

/**
 * Punto único donde el dominio se une con Supabase.
 *
 * Es lo único que la app (web o React Native) necesita construir: todo lo demás
 * se consume a través de estos casos de uso, que no exponen nada de PostgREST.
 * Cambiar de backend significa escribir otro contenedor, no tocar los módulos.
 */
export interface ConfiguracionContenedor extends ConfiguracionSupabase {
  /**
   * URL del backend administrativo (`VITE_API_URL`), sin barra final.
   *
   * Es obligatoria: sin ella, dar de alta un usuario volvería a crear solo la
   * fila de la tabla, sin cuenta de acceso, que es justo el problema que el
   * backend resuelve. Mejor fallar al arrancar que en silencio.
   */
  apiUrl: string;
}

export interface ContenedorCore {
  /** Se expone solo para casos puntuales, como suscribirse a realtime. */
  cliente: ClienteSupabase;
  auth: CasosUsoAuth;
  catalogos: CasosUsoCatalogos;
  compras: CasosUsoCompras;
  ventas: CasosUsoVentas;
  inventario: CasosUsoInventario;
  cotizaciones: CasosUsoCotizaciones;
  acceso: CasosUsoAcceso;
}

export function crearContenedor(config: ConfiguracionContenedor): ContenedorCore {
  const cliente = crearClienteSupabase(config);
  const api = crearClienteApi({ urlBase: config.apiUrl }, cliente);

  // --- Repositorios (adaptadores de salida) ---
  const repoProveedores = crearRepositorioProveedores(cliente);
  const repoClientes = crearRepositorioClientes(cliente);
  const repoProductos = crearRepositorioProductos(cliente);
  const repoCompras = crearRepositorioCompras(cliente);
  const repoLotes = crearRepositorioLotes(cliente);
  const repoPagosProveedor = crearRepositorioPagosProveedor(cliente);
  const repoVentas = crearRepositorioVentas(cliente);
  const repoPagosCliente = crearRepositorioPagosCliente(cliente);
  const repoCotizaciones = crearRepositorioCotizaciones(cliente);
  // Las escrituras de usuarios pasan por el backend porque necesitan la
  // service_role key; las lecturas siguen yendo directas a Supabase.
  const repoUsuarios = crearRepositorioUsuariosBackend(
    crearRepositorioUsuarios(cliente),
    api,
  );
  const repoRoles = crearRepositorioRoles(cliente);
  const repoModulos = crearRepositorioModulos(cliente);
  const repoPermisos = crearRepositorioPermisos(cliente);
  // El backend entra aquí solo por el login con nombre de usuario; entrar con
  // el correo sigue siendo una llamada directa a Supabase.
  const servicioAuth = crearServicioAutenticacion(cliente, api);

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
    cliente,
    auth,
    catalogos,
    compras,
    ventas,
    inventario,
    cotizaciones,
    acceso,
  };
}
