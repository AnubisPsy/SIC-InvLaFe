import type { ClienteSupabase } from "../../../infrastructure/supabase/cliente";
import {
  ejecutar,
  ejecutarOpcional,
  ejecutarSinRetorno,
} from "../../../infrastructure/supabase/errores";
import {
  TABLAS,
  aBooleano,
  aId,
  aIdOpcional,
  type FilaModulo,
  type FilaPermisoRol,
  type FilaRol,
  type FilaUsuario,
} from "../../../infrastructure/supabase/tablas";
import type { ID } from "../../../shared/tipos";
import type {
  DatosRol,
  DatosUsuario,
  Rol,
  Usuario,
  UsuarioDetalle,
} from "../domain/entidades";
import { claveDeModulo, type Modulo } from "../domain/modulos";
import type { PermisoEditable, PermisoRol } from "../domain/permisos";
import type {
  RepositorioModulos,
  RepositorioPermisos,
  RepositorioRoles,
  RepositorioUsuarios,
} from "../domain/repositorios";

const SELECT_USUARIO = `
  *,
  rol:${TABLAS.ROLES}(*)
` as const;

interface FilaUsuarioExpandida extends FilaUsuario {
  rol: FilaRol | null;
}

const aRol = (fila: FilaRol): Rol => ({
  id: aId(fila.id),
  nombre: fila.nombre,
  creadoEn: fila.creado_en,
});

function aUsuario(fila: FilaUsuario): Usuario {
  return {
    id: aId(fila.id),
    nombre: fila.nombre,
    correo: fila.correo,
    usuario: fila.usuario ?? null,
    telefono: fila.telefono,
    rolId: aIdOpcional(fila.rol_id),
    // Sin valor explícito se asume activo: es como se comportan las filas
    // creadas antes de que la columna existiera.
    activo: aBooleano(fila.activo, true),
    // El valor por defecto es el contrario y por el mismo motivo: sin columna,
    // nadie tenía un cambio pendiente, y asumir `true` dejaría a todo el mundo
    // atrapado en la pantalla de cambio tras desplegar sin migrar.
    debeCambiarContrasena: aBooleano(fila.debe_cambiar_contrasena, false),
    creadoEn: fila.creado_en,
  };
}

const aUsuarioDetalle = (fila: FilaUsuarioExpandida): UsuarioDetalle => ({
  ...aUsuario(fila),
  rol: fila.rol ? aRol(fila.rol) : null,
});

const aModulo = (fila: FilaModulo): Modulo => ({
  id: aId(fila.id),
  nombre: fila.nombre,
  clave: claveDeModulo(fila.nombre),
});

const aPermisoRol = (fila: FilaPermisoRol): PermisoRol => ({
  id: aId(fila.id),
  rolId: aId(fila.rol_id),
  moduloId: aId(fila.modulo_id),
  ver: aBooleano(fila.puede_ver),
  crear: aBooleano(fila.puede_crear),
  editar: aBooleano(fila.puede_editar),
  eliminar: aBooleano(fila.puede_eliminar),
});

function aFilaEscritura(datos: DatosUsuario) {
  return {
    nombre: datos.nombre,
    correo: datos.correo,
    usuario: datos.usuario,
    telefono: datos.telefono,
    rol_id: datos.rolId,
    activo: datos.activo,
    debe_cambiar_contrasena: datos.debeCambiarContrasena,
  };
}

export function crearRepositorioUsuarios(
  cliente: ClienteSupabase,
): RepositorioUsuarios {
  const tabla = () => cliente.from(TABLAS.USUARIOS);

  return {
    async listar() {
      const filas = await ejecutar<FilaUsuarioExpandida[]>(
        tabla().select(SELECT_USUARIO).order("nombre", { ascending: true }),
        "cargar los usuarios",
      );
      return filas.map(aUsuarioDetalle);
    },

    async obtener(id: ID) {
      const fila = await ejecutarOpcional<FilaUsuarioExpandida>(
        tabla().select(SELECT_USUARIO).eq("id", id).single(),
        "cargar el usuario",
      );
      return fila ? aUsuarioDetalle(fila) : null;
    },

    /**
     * El correo es el puente entre Supabase Auth y la tabla `usuarios`.
     * Se compara sin distinguir mayúsculas porque Auth normaliza el email y la
     * fila pudo darse de alta a mano con otra capitalización.
     */
    async obtenerPorCorreo(correo: string) {
      const fila = await ejecutarOpcional<FilaUsuarioExpandida>(
        tabla()
          .select(SELECT_USUARIO)
          .ilike("correo", correo.trim())
          .limit(1)
          .maybeSingle(),
        "identificar tu usuario",
      );
      return fila ? aUsuarioDetalle(fila) : null;
    },

    async crear(datos: DatosUsuario) {
      const fila = await ejecutar<FilaUsuario>(
        tabla().insert(aFilaEscritura(datos)).select("*").single(),
        "crear el usuario",
      );
      return aUsuario(fila);
    },

    async actualizar(id: ID, datos: DatosUsuario) {
      const fila = await ejecutar<FilaUsuario>(
        tabla().update(aFilaEscritura(datos)).eq("id", id).select("*").single(),
        "actualizar el usuario",
      );
      return aUsuario(fila);
    },

    async cambiarActivo(id: ID, activo: boolean) {
      const fila = await ejecutar<FilaUsuario>(
        tabla().update({ activo }).eq("id", id).select("*").single(),
        activo ? "activar el usuario" : "desactivar el usuario",
      );
      return aUsuario(fila);
    },

    async eliminar(id: ID) {
      await ejecutarSinRetorno(tabla().delete().eq("id", id), "eliminar el usuario");
    },
  };
}

export function crearRepositorioRoles(cliente: ClienteSupabase): RepositorioRoles {
  const tabla = () => cliente.from(TABLAS.ROLES);

  return {
    async listar() {
      const filas = await ejecutar<FilaRol[]>(
        tabla().select("*").order("nombre", { ascending: true }),
        "cargar los roles",
      );
      return filas.map(aRol);
    },

    async obtener(id: ID) {
      const fila = await ejecutarOpcional<FilaRol>(
        tabla().select("*").eq("id", id).single(),
        "cargar el rol",
      );
      return fila ? aRol(fila) : null;
    },

    async crear(datos: DatosRol) {
      const fila = await ejecutar<FilaRol>(
        tabla().insert({ nombre: datos.nombre }).select("*").single(),
        "crear el rol",
      );
      return aRol(fila);
    },

    async actualizar(id: ID, datos: DatosRol) {
      const fila = await ejecutar<FilaRol>(
        tabla().update({ nombre: datos.nombre }).eq("id", id).select("*").single(),
        "actualizar el rol",
      );
      return aRol(fila);
    },

    async eliminar(id: ID) {
      await ejecutarSinRetorno(tabla().delete().eq("id", id), "eliminar el rol");
    },

    async contarUsuarios(rolId: ID) {
      const { count, error } = await cliente
        .from(TABLAS.USUARIOS)
        .select("id", { count: "exact", head: true })
        .eq("rol_id", rolId);

      if (error) throw error;
      return count ?? 0;
    },
  };
}

export function crearRepositorioModulos(
  cliente: ClienteSupabase,
): RepositorioModulos {
  return {
    async listar() {
      const filas = await ejecutar<FilaModulo[]>(
        cliente.from(TABLAS.MODULOS).select("*").order("id", { ascending: true }),
        "cargar los módulos",
      );
      return filas.map(aModulo);
    },
  };
}

export function crearRepositorioPermisos(
  cliente: ClienteSupabase,
): RepositorioPermisos {
  const tabla = () => cliente.from(TABLAS.PERMISOS_ROL);

  return {
    async listarPorRol(rolId: ID) {
      const filas = await ejecutar<FilaPermisoRol[]>(
        tabla().select("*").eq("rol_id", rolId),
        "cargar los permisos del rol",
      );
      return filas.map(aPermisoRol);
    },

    /**
     * Reemplazo en bloque, vía la función `guardar_permisos_rol` (RPC): borra
     * los permisos del rol e inserta los nuevos en una sola llamada atómica.
     *
     * Antes esto era un `delete` + `insert` como dos llamadas separadas desde
     * el cliente, y podía autobloquear a quien editaba los permisos de su
     * propio rol: el `delete` le quitaba la fila que le daba permiso sobre
     * "usuarios_roles", y la política de RLS del `insert` siguiente ya no lo
     * dejaba pasar, dejando el rol sin ninguna fila. La función valida el
     * permiso una sola vez, antes de tocar nada.
     */
    async guardarPorRol(rolId: ID, permisos: readonly PermisoEditable[]) {
      const filas = await ejecutar<FilaPermisoRol[]>(
        cliente.rpc("guardar_permisos_rol", {
          p_rol_id: rolId,
          p_permisos: permisos.map((permiso) => ({
            moduloId: permiso.moduloId,
            ver: permiso.ver,
            crear: permiso.crear,
            editar: permiso.editar,
            eliminar: permiso.eliminar,
          })),
        }),
        "guardar los permisos del rol",
      );
      return filas.map(aPermisoRol);
    },
  };
}
