import { ErrorConflicto, ErrorNoEncontrado } from "../../../shared/errores";
import type { ID } from "../../../shared/tipos";
import type {
  DatosRol,
  DatosUsuario,
  Rol,
  Usuario,
  UsuarioDetalle,
} from "../domain/entidades";
import { validarRol, validarUsuario } from "../domain/entidades";
import type { ClaveModulo, Modulo } from "../domain/modulos";
import { modulosSinMapear } from "../domain/modulos";
import type { AccionesPermitidas, PermisoEditable } from "../domain/permisos";
import { SIN_PERMISOS } from "../domain/permisos";
import type {
  RepositorioModulos,
  RepositorioPermisos,
  RepositorioRoles,
  RepositorioUsuarios,
} from "../domain/repositorios";

/** Una fila de la matriz de permisos que edita el administrador. */
export interface FilaMatrizPermisos extends AccionesPermitidas {
  modulo: Modulo;
}

export interface MatrizPermisos {
  rol: Rol;
  filas: FilaMatrizPermisos[];
  /** Claves del frontend sin fila en `modulos`: no se pueden conceder. */
  sinConfigurar: ClaveModulo[];
}

export interface CasosUsoAcceso {
  listarUsuarios(): Promise<UsuarioDetalle[]>;
  crearUsuario(datos: DatosUsuario): Promise<Usuario>;
  actualizarUsuario(id: ID, datos: DatosUsuario): Promise<Usuario>;
  cambiarActivoUsuario(id: ID, activo: boolean): Promise<Usuario>;
  eliminarUsuario(id: ID): Promise<void>;

  listarRoles(): Promise<Rol[]>;
  crearRol(datos: DatosRol): Promise<Rol>;
  actualizarRol(id: ID, datos: DatosRol): Promise<Rol>;
  eliminarRol(id: ID): Promise<void>;

  listarModulos(): Promise<Modulo[]>;
  /** Matriz módulo × acción del rol, lista para pintar en la pantalla. */
  matrizDePermisos(rolId: ID): Promise<MatrizPermisos>;
  guardarPermisos(rolId: ID, permisos: readonly PermisoEditable[]): Promise<void>;
}

export function crearCasosUsoAcceso(deps: {
  usuarios: RepositorioUsuarios;
  roles: RepositorioRoles;
  modulos: RepositorioModulos;
  permisos: RepositorioPermisos;
}): CasosUsoAcceso {
  const { usuarios, roles, modulos, permisos } = deps;

  return {
    listarUsuarios: () => usuarios.listar(),
    // Crear exige contraseña porque también se crea la cuenta de acceso;
    // editar la acepta vacía, que significa "deja la que tiene".
    crearUsuario: (datos) =>
      usuarios.crear(validarUsuario(datos, { contrasenaObligatoria: true })),
    actualizarUsuario: (id, datos) => usuarios.actualizar(id, validarUsuario(datos)),
    cambiarActivoUsuario: (id, activo) => usuarios.cambiarActivo(id, activo),
    eliminarUsuario: (id) => usuarios.eliminar(id),

    listarRoles: () => roles.listar(),
    crearRol: (datos) => roles.crear(validarRol(datos)),
    actualizarRol: (id, datos) => roles.actualizar(id, validarRol(datos)),

    /**
     * Borrar un rol con usuarios asignados los dejaría sin permisos y sin
     * forma de recuperarlos, así que se bloquea antes de tocar la base.
     */
    async eliminarRol(id) {
      const asignados = await roles.contarUsuarios(id);
      if (asignados > 0) {
        throw new ErrorConflicto(
          `No se puede eliminar: ${asignados} usuario(s) tienen este rol asignado. ` +
            "Reasígnalos primero.",
        );
      }
      await roles.eliminar(id);
    },

    listarModulos: () => modulos.listar(),

    async matrizDePermisos(rolId) {
      const [rol, listaModulos, listaPermisos] = await Promise.all([
        roles.obtener(rolId),
        modulos.listar(),
        permisos.listarPorRol(rolId),
      ]);

      if (!rol) throw new ErrorNoEncontrado("el rol", rolId);

      const porModulo = new Map(
        listaPermisos.map((permiso) => [permiso.moduloId, permiso]),
      );

      return {
        rol,
        filas: listaModulos.map((modulo) => {
          const permiso = porModulo.get(modulo.id);
          return {
            modulo,
            ...(permiso
              ? {
                  ver: permiso.ver,
                  crear: permiso.crear,
                  editar: permiso.editar,
                  eliminar: permiso.eliminar,
                }
              : SIN_PERMISOS),
          };
        }),
        sinConfigurar: modulosSinMapear(listaModulos),
      };
    },

    async guardarPermisos(rolId, lista) {
      await permisos.guardarPorRol(rolId, lista);
    },
  };
}
