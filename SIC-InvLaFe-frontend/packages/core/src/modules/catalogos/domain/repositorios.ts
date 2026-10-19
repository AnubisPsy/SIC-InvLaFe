import type { ID } from "../../../shared/tipos";
import type { Cliente, DatosContacto, DatosProducto, Producto, Proveedor } from "./entidades";

/**
 * Puertos del módulo de catálogos. El dominio depende de estas interfaces;
 * la implementación contra el backend vive en `infrastructure/`.
 */
export interface RepositorioProveedores {
  listar(): Promise<Proveedor[]>;
  obtener(id: ID): Promise<Proveedor | null>;
  crear(datos: DatosContacto): Promise<Proveedor>;
  actualizar(id: ID, datos: DatosContacto): Promise<Proveedor>;
  eliminar(id: ID): Promise<void>;
}

export interface RepositorioClientes {
  listar(): Promise<Cliente[]>;
  obtener(id: ID): Promise<Cliente | null>;
  crear(datos: DatosContacto): Promise<Cliente>;
  actualizar(id: ID, datos: DatosContacto): Promise<Cliente>;
  eliminar(id: ID): Promise<void>;
}

export interface RepositorioProductos {
  listar(): Promise<Producto[]>;
  obtener(id: ID): Promise<Producto | null>;
  crear(datos: DatosProducto): Promise<Producto>;
  actualizar(id: ID, datos: DatosProducto): Promise<Producto>;
  eliminar(id: ID): Promise<void>;
}
