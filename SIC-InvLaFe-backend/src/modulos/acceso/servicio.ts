import { consultar, consultarUno } from "../../infraestructura/db/pool.js";
import {
  aBooleano,
  aId,
  aIdOpcional,
  type FilaModulo,
  type FilaPermisoRol,
  type FilaUsuario,
} from "../../infraestructura/supabase/tablas.js";
import {
  SIN_PERMISOS,
  claveDeModulo,
  type Accion,
  type AccionesPermitidas,
  type ClaveModulo,
} from "./modulos.js";

/** Identidad ya verificada de quien hace la petición. */
export interface Solicitante {
  /** Id del usuario. Se mantiene el nombre de la época de Supabase Auth. */
  authUserId: string;
  /** Correo del usuario, en minúsculas. */
  correo: string;
  /** Fila de `usuarios` de quien hace la petición. */
  usuario: UsuarioSistema;
}

/** Fila de `usuarios` en la forma que usa el resto del backend. */
export interface UsuarioSistema {
  id: string;
  nombre: string;
  correo: string;
  /** Nombre de usuario para iniciar sesión, o `null` si solo entra por correo. */
  usuario: string | null;
  telefono: string | null;
  rolId: string | null;
  activo: boolean;
  /** Si es `true`, la aplicación le exige cambiar la contraseña antes de entrar. */
  debeCambiarContrasena: boolean;
  creadoEn: string;
}

export function aUsuarioSistema(fila: FilaUsuario): UsuarioSistema {
  return {
    id: aId(fila.id),
    nombre: fila.nombre,
    correo: fila.correo,
    usuario: fila.usuario ?? null,
    telefono: fila.telefono,
    rolId: aIdOpcional(fila.rol_id),
    // Sin valor explícito se asume activo. Igual que en el frontend.
    activo: aBooleano(fila.activo, true),
    // Sin valor explícito, nadie tiene un cambio de contraseña pendiente.
    debeCambiarContrasena: aBooleano(fila.debe_cambiar_contrasena, false),
    creadoEn: fila.creado_en,
  };
}

/**
 * Columnas de `usuarios` que se leen normalmente. `contrasena_hash` queda fuera
 * a propósito: solo la consulta el login, para que nunca viaje por error en
 * una respuesta.
 */
export const COLUMNAS_USUARIO =
  "id, nombre, correo, usuario, telefono, rol_id, activo, debe_cambiar_contrasena, creado_en";

/** Busca la fila de `usuarios` por correo, sin distinguir mayúsculas. */
export async function buscarUsuarioPorCorreo(
  correo: string,
): Promise<UsuarioSistema | null> {
  const fila = await consultarUno<FilaUsuario>(
    `select ${COLUMNAS_USUARIO} from usuarios where lower(correo) = lower($1) limit 1`,
    [correo.trim()],
    "identificar tu usuario",
  );
  return fila ? aUsuarioSistema(fila) : null;
}

/**
 * Busca la fila de `usuarios` por su nombre de usuario.
 *
 * Se compara contra el valor en minúsculas porque el nombre se guarda ya
 * normalizado (ver `normalizarNombreUsuario` en `esquema.ts`).
 */
export async function buscarUsuarioPorNombreUsuario(
  usuario: string,
): Promise<UsuarioSistema | null> {
  const limpio = usuario.trim().toLowerCase();
  if (!limpio) return null;

  const fila = await consultarUno<FilaUsuario>(
    `select ${COLUMNAS_USUARIO} from usuarios where lower(usuario) = $1 limit 1`,
    [limpio],
    "identificar tu usuario",
  );
  return fila ? aUsuarioSistema(fila) : null;
}

export async function buscarUsuarioPorId(id: string): Promise<UsuarioSistema | null> {
  const fila = await consultarUno<FilaUsuario>(
    `select ${COLUMNAS_USUARIO} from usuarios where id = $1`,
    [id],
    "cargar el usuario",
  );
  return fila ? aUsuarioSistema(fila) : null;
}

/** Contraseña cifrada del usuario, o `null` si aún no tiene una. Solo para el login. */
export async function obtenerHashContrasena(id: string): Promise<string | null> {
  const fila = await consultarUno<{ contrasena_hash: string | null }>(
    "select contrasena_hash from usuarios where id = $1",
    [id],
    "verificar tu contraseña",
  );
  return fila?.contrasena_hash ?? null;
}

/**
 * Acciones que un rol puede ejecutar sobre un módulo.
 *
 * - Si un rol tiene varias filas para el mismo módulo, gana el permiso más amplio.
 * - Crear, editar y eliminar exigen además poder ver.
 * - Lo que no está concedido explícitamente, está denegado.
 */
export async function accionesPermitidas(
  rolId: string | null,
  modulo: ClaveModulo,
): Promise<AccionesPermitidas> {
  if (!rolId) return { ...SIN_PERMISOS };

  const modulos = await consultar<FilaModulo>(
    "select id, nombre from modulos",
    [],
    "cargar los módulos",
  );

  const idsDelModulo = modulos
    .filter((fila) => claveDeModulo(fila.nombre) === modulo)
    .map((fila) => aId(fila.id));

  // Sin fila en `modulos` no hay permiso que conceder.
  if (idsDelModulo.length === 0) return { ...SIN_PERMISOS };

  const permisos = await consultar<FilaPermisoRol>(
    "select * from permisos_rol where rol_id = $1 and modulo_id = any($2::uuid[])",
    [rolId, idsDelModulo],
    "cargar los permisos del rol",
  );

  return permisos.reduce<AccionesPermitidas>(
    (acumulado, permiso) => ({
      ver: acumulado.ver || aBooleano(permiso.puede_ver),
      crear: acumulado.crear || aBooleano(permiso.puede_crear),
      editar: acumulado.editar || aBooleano(permiso.puede_editar),
      eliminar: acumulado.eliminar || aBooleano(permiso.puede_eliminar),
    }),
    { ...SIN_PERMISOS },
  );
}

export function puede(permisos: AccionesPermitidas, accion: Accion): boolean {
  return accion === "ver" ? permisos.ver : permisos.ver && permisos[accion];
}
