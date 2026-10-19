import type { ClienteApi } from "../../../infrastructure/http/cliente";
import { conFiltros, id } from "../../../infrastructure/http/consulta";
import type { ID } from "../../../shared/tipos";
import type { DatosRol, DatosUsuario, Rol, Usuario, UsuarioDetalle } from "../domain/entidades";
import { claveDeModulo, type Modulo } from "../domain/modulos";
import type { PermisoEditable, PermisoRol } from "../domain/permisos";
import type {
  RepositorioModulos,
  RepositorioPermisos,
  RepositorioRoles,
  RepositorioUsuarios,
} from "../domain/repositorios";

/**
 * Usuarios, roles, módulos y permisos a través del backend.
 *
 * El backend ya devuelve las entidades en la forma del dominio (camelCase),
 * así que aquí casi no hay conversión.
 */

function cuerpoUsuario(datos: DatosUsuario) {
  return {
    nombre: datos.nombre,
    correo: datos.correo,
    usuario: datos.usuario,
    telefono: datos.telefono,
    rolId: datos.rolId,
    activo: datos.activo,
    debeCambiarContrasena: datos.debeCambiarContrasena,
    // Solo viaja si se escribió una: en blanco significa "deja la que tiene".
    ...(datos.contrasena ? { contrasena: datos.contrasena } : {}),
  };
}

export function crearRepositorioUsuarios(api: ClienteApi): RepositorioUsuarios {
  return {
    async listar() {
      const r = await api.solicitar<{ usuarios: UsuarioDetalle[] }>("/api/usuarios", {
        contexto: "cargar los usuarios",
      });
      return r.usuarios;
    },

    async obtener(usuarioId: ID) {
      const r = await api.solicitar<{ usuario: UsuarioDetalle | null }>(
        `/api/usuarios/${id(usuarioId)}`,
        { contexto: "cargar el usuario" },
      );
      return r.usuario;
    },

    async obtenerPorCorreo(correo: string) {
      const r = await api.solicitar<{ usuario: UsuarioDetalle | null }>(
        conFiltros("/api/usuarios/por-correo", { correo }),
        { contexto: "identificar tu usuario" },
      );
      return r.usuario;
    },

    async crear(datos: DatosUsuario) {
      const r = await api.solicitar<{ usuario: Usuario }>("/api/usuarios", {
        metodo: "POST",
        contexto: "crear el usuario",
        cuerpo: cuerpoUsuario(datos),
      });
      return r.usuario;
    },

    async actualizar(usuarioId: ID, datos: DatosUsuario) {
      const r = await api.solicitar<{ usuario: Usuario }>(`/api/usuarios/${id(usuarioId)}`, {
        metodo: "PATCH",
        contexto: "actualizar el usuario",
        cuerpo: cuerpoUsuario(datos),
      });
      return r.usuario;
    },

    async cambiarActivo(usuarioId: ID, activo: boolean) {
      const r = await api.solicitar<{ usuario: Usuario }>(`/api/usuarios/${id(usuarioId)}`, {
        metodo: "PATCH",
        contexto: activo ? "activar el usuario" : "desactivar el usuario",
        cuerpo: { activo },
      });
      return r.usuario;
    },

    async eliminar(usuarioId: ID) {
      await api.solicitar<void>(`/api/usuarios/${id(usuarioId)}`, {
        metodo: "DELETE",
        contexto: "eliminar el usuario",
      });
    },
  };
}

export function crearRepositorioRoles(api: ClienteApi): RepositorioRoles {
  return {
    async listar() {
      const r = await api.solicitar<{ roles: Rol[] }>("/api/roles", { contexto: "cargar los roles" });
      return r.roles;
    },

    async obtener(rolId: ID) {
      const r = await api.solicitar<{ rol: Rol | null }>(`/api/roles/${id(rolId)}`, {
        contexto: "cargar el rol",
      });
      return r.rol;
    },

    async crear(datos: DatosRol) {
      const r = await api.solicitar<{ rol: Rol }>("/api/roles", {
        metodo: "POST",
        contexto: "crear el rol",
        cuerpo: { nombre: datos.nombre },
      });
      return r.rol;
    },

    async actualizar(rolId: ID, datos: DatosRol) {
      const r = await api.solicitar<{ rol: Rol }>(`/api/roles/${id(rolId)}`, {
        metodo: "PATCH",
        contexto: "actualizar el rol",
        cuerpo: { nombre: datos.nombre },
      });
      return r.rol;
    },

    async eliminar(rolId: ID) {
      await api.solicitar<void>(`/api/roles/${id(rolId)}`, {
        metodo: "DELETE",
        contexto: "eliminar el rol",
      });
    },

    async contarUsuarios(rolId: ID) {
      const r = await api.solicitar<{ cantidad: number }>(
        `/api/roles/${id(rolId)}/usuarios/cantidad`,
        { contexto: "contar los usuarios del rol" },
      );
      return r.cantidad;
    },
  };
}

export function crearRepositorioModulos(api: ClienteApi): RepositorioModulos {
  return {
    async listar() {
      const r = await api.solicitar<{ modulos: { id: ID; nombre: string }[] }>("/api/modulos", {
        contexto: "cargar los módulos",
      });
      return r.modulos.map(
        (modulo): Modulo => ({ id: modulo.id, nombre: modulo.nombre, clave: claveDeModulo(modulo.nombre) }),
      );
    },
  };
}

export function crearRepositorioPermisos(api: ClienteApi): RepositorioPermisos {
  return {
    async listarPorRol(rolId: ID) {
      const r = await api.solicitar<{ permisos: PermisoRol[] }>(`/api/roles/${id(rolId)}/permisos`, {
        contexto: "cargar los permisos del rol",
      });
      return r.permisos;
    },

    /** Reemplazo en bloque: el backend lo hace en una transacción. */
    async guardarPorRol(rolId: ID, permisos: readonly PermisoEditable[]) {
      const r = await api.solicitar<{ permisos: PermisoRol[] }>(`/api/roles/${id(rolId)}/permisos`, {
        metodo: "PUT",
        contexto: "guardar los permisos del rol",
        cuerpo: {
          permisos: permisos.map((permiso) => ({
            moduloId: permiso.moduloId,
            ver: permiso.ver,
            crear: permiso.crear,
            editar: permiso.editar,
            eliminar: permiso.eliminar,
          })),
        },
      });
      return r.permisos;
    },
  };
}
