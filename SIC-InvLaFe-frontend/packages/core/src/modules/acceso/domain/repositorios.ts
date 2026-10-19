import type { ID } from "../../../shared/tipos";
import type { DatosRol, DatosUsuario, Rol, Usuario, UsuarioDetalle } from "./entidades";
import type { Modulo } from "./modulos";
import type { PermisoEditable, PermisoRol } from "./permisos";

export interface RepositorioUsuarios {
  listar(): Promise<UsuarioDetalle[]>;
  obtener(id: ID): Promise<UsuarioDetalle | null>;
  /** Resuelve el usuario del sistema a partir del email de la sesión de Auth. */
  obtenerPorCorreo(correo: string): Promise<UsuarioDetalle | null>;
  crear(datos: DatosUsuario): Promise<Usuario>;
  actualizar(id: ID, datos: DatosUsuario): Promise<Usuario>;
  cambiarActivo(id: ID, activo: boolean): Promise<Usuario>;
  eliminar(id: ID): Promise<void>;
}

export interface RepositorioRoles {
  listar(): Promise<Rol[]>;
  obtener(id: ID): Promise<Rol | null>;
  crear(datos: DatosRol): Promise<Rol>;
  actualizar(id: ID, datos: DatosRol): Promise<Rol>;
  eliminar(id: ID): Promise<void>;
  /** Cuántos usuarios dependen del rol; bloquea el borrado si hay alguno. */
  contarUsuarios(rolId: ID): Promise<number>;
}

export interface RepositorioModulos {
  listar(): Promise<Modulo[]>;
}

export interface RepositorioPermisos {
  listarPorRol(rolId: ID): Promise<PermisoRol[]>;
  /** Reemplaza en bloque la matriz de permisos del rol. */
  guardarPorRol(rolId: ID, permisos: readonly PermisoEditable[]): Promise<PermisoRol[]>;
}
