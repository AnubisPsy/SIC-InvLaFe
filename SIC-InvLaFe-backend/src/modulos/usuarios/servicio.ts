import {
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorValidacion,
} from "../../compartido/errores.js";
import { consultar, consultarUno } from "../../infraestructura/db/pool.js";
import type { FilaUsuario } from "../../infraestructura/supabase/tablas.js";
import { cifrarContrasena } from "../acceso/autenticacion.js";
import {
  COLUMNAS_USUARIO,
  aUsuarioSistema,
  buscarUsuarioPorId,
  type Solicitante,
  type UsuarioSistema,
} from "../acceso/servicio.js";
import type { DatosCrearUsuario, DatosEditarUsuario } from "./esquema.js";

/** Rol resumido que acompaña a cada usuario en los listados. */
export interface RolResumen {
  id: string;
  nombre: string;
  creadoEn: string;
}

export interface UsuarioDetalle extends UsuarioSistema {
  rol: RolResumen | null;
}

interface FilaUsuarioConRol extends FilaUsuario {
  rol_nombre: string | null;
  rol_creado_en: string | null;
}

/** Usuario + su rol en una sola consulta (un `left join`). */
const SELECT_USUARIO_CON_ROL = `
  select u.id, u.nombre, u.correo, u.usuario, u.telefono, u.rol_id, u.activo,
         u.debe_cambiar_contrasena, u.creado_en,
         r.nombre as rol_nombre, r.creado_en as rol_creado_en
    from usuarios u
    left join roles r on r.id = u.rol_id`;

function aUsuarioDetalle(fila: FilaUsuarioConRol): UsuarioDetalle {
  const usuario = aUsuarioSistema(fila);
  return {
    ...usuario,
    rol:
      usuario.rolId && fila.rol_nombre
        ? { id: usuario.rolId, nombre: fila.rol_nombre, creadoEn: fila.rol_creado_en ?? "" }
        : null,
  };
}

// --- Lecturas ----------------------------------------------------------------

export async function listarUsuarios(): Promise<UsuarioDetalle[]> {
  const filas = await consultar<FilaUsuarioConRol>(
    `${SELECT_USUARIO_CON_ROL} order by u.nombre`,
    [],
    "cargar los usuarios",
  );
  return filas.map(aUsuarioDetalle);
}

export async function obtenerUsuarioDetalle(id: string): Promise<UsuarioDetalle | null> {
  const fila = await consultarUno<FilaUsuarioConRol>(
    `${SELECT_USUARIO_CON_ROL} where u.id = $1`,
    [id],
    "cargar el usuario",
  );
  return fila ? aUsuarioDetalle(fila) : null;
}

export async function obtenerUsuarioDetallePorCorreo(
  correo: string,
): Promise<UsuarioDetalle | null> {
  const fila = await consultarUno<FilaUsuarioConRol>(
    `${SELECT_USUARIO_CON_ROL} where lower(u.correo) = lower($1) limit 1`,
    [correo.trim()],
    "identificar tu usuario",
  );
  return fila ? aUsuarioDetalle(fila) : null;
}

// --- Comprobaciones ----------------------------------------------------------

async function existeCorreo(correo: string, excluyendoId?: string): Promise<boolean> {
  const fila = await consultarUno(
    "select 1 from usuarios where lower(correo) = lower($1) and id is distinct from $2::uuid limit 1",
    [correo.trim(), excluyendoId ?? null],
    "comprobar si el correo ya está registrado",
  );
  return fila !== null;
}

async function existeNombreUsuario(usuario: string, excluyendoId?: string): Promise<boolean> {
  const fila = await consultarUno(
    "select 1 from usuarios where lower(usuario) = lower($1) and id is distinct from $2::uuid limit 1",
    [usuario, excluyendoId ?? null],
    "comprobar si el nombre de usuario ya está en uso",
  );
  return fila !== null;
}

// --- Escrituras --------------------------------------------------------------

/** Alta: una sola fila en `usuarios`, con la contraseña ya cifrada. */
export async function crearUsuario(datos: DatosCrearUsuario): Promise<UsuarioSistema> {
  if (await existeCorreo(datos.correo)) {
    throw new ErrorValidacion("Ya existe un usuario con ese correo.", {
      correo: "Este correo ya está registrado en el sistema.",
    });
  }

  if (datos.usuario && (await existeNombreUsuario(datos.usuario))) {
    throw new ErrorValidacion("Ese nombre de usuario ya está en uso.", {
      usuario: "Ya hay otro usuario con este nombre. Elige otro.",
    });
  }

  const hash = await cifrarContrasena(datos.contrasena);

  const fila = await consultarUno<FilaUsuario>(
    `insert into usuarios
       (nombre, correo, usuario, telefono, rol_id, activo, debe_cambiar_contrasena, contrasena_hash)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning ${COLUMNAS_USUARIO}`,
    [
      datos.nombre,
      datos.correo,
      datos.usuario,
      datos.telefono,
      datos.rolId,
      datos.activo,
      datos.debeCambiarContrasena,
      hash,
    ],
    "crear el usuario",
  );

  return aUsuarioSistema(fila as FilaUsuario);
}

/** Edición: un solo `update` con los campos que vengan. */
export async function editarUsuario(
  id: string,
  cambios: DatosEditarUsuario,
  solicitante: Solicitante,
): Promise<UsuarioSistema> {
  const actual = await buscarUsuarioPorId(id);
  if (!actual) throw new ErrorNoEncontrado("No se encontró el usuario.");

  if (actual.id === solicitante.usuario.id && cambios.activo === false) {
    throw new ErrorConflicto(
      "No puedes desactivar tu propio usuario: perderías el acceso al sistema.",
    );
  }

  if (cambios.correo && cambios.correo !== actual.correo && (await existeCorreo(cambios.correo, id))) {
    throw new ErrorValidacion("Ya existe un usuario con ese correo.", {
      correo: "Este correo ya está registrado en el sistema.",
    });
  }

  if (
    cambios.usuario &&
    cambios.usuario !== actual.usuario &&
    (await existeNombreUsuario(cambios.usuario, id))
  ) {
    throw new ErrorValidacion("Ese nombre de usuario ya está en uso.", {
      usuario: "Ya hay otro usuario con este nombre. Elige otro.",
    });
  }

  // Se arma el `update` solo con lo que cambió. Cada valor va como parámetro
  // ($1, $2…), nunca pegado al texto, para evitar inyección SQL.
  const columnas: string[] = [];
  const valores: unknown[] = [];
  const asignar = (columna: string, valor: unknown) => {
    valores.push(valor);
    columnas.push(`${columna} = $${valores.length}`);
  };

  if (cambios.nombre !== undefined) asignar("nombre", cambios.nombre);
  if (cambios.correo !== undefined) asignar("correo", cambios.correo);
  if (cambios.usuario !== undefined) asignar("usuario", cambios.usuario);
  if (cambios.telefono !== undefined) asignar("telefono", cambios.telefono);
  if (cambios.rolId !== undefined) asignar("rol_id", cambios.rolId);
  if (cambios.activo !== undefined) asignar("activo", cambios.activo);
  if (cambios.debeCambiarContrasena !== undefined) {
    asignar("debe_cambiar_contrasena", cambios.debeCambiarContrasena);
  }
  if (cambios.contrasena) {
    asignar("contrasena_hash", await cifrarContrasena(cambios.contrasena));
  }

  if (columnas.length === 0) return actual;

  valores.push(id);
  const fila = await consultarUno<FilaUsuario>(
    `update usuarios set ${columnas.join(", ")}
      where id = $${valores.length}
      returning ${COLUMNAS_USUARIO}`,
    valores,
    "actualizar el usuario",
  );

  if (!fila) throw new ErrorNoEncontrado("No se encontró el usuario.");
  return aUsuarioSistema(fila);
}

/** Baja: borra la fila. La contraseña se va con ella. */
export async function eliminarUsuario(id: string, solicitante: Solicitante): Promise<void> {
  if (id === solicitante.usuario.id) {
    throw new ErrorConflicto(
      "No puedes eliminar tu propio usuario: perderías el acceso al sistema.",
    );
  }

  const borradas = await consultar(
    "delete from usuarios where id = $1 returning id",
    [id],
    "eliminar el usuario",
  );

  if (borradas.length === 0) throw new ErrorNoEncontrado("No se encontró el usuario.");
}
