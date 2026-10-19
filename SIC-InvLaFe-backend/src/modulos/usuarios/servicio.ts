import {
  ErrorConflicto,
  ErrorInfraestructura,
  ErrorNoEncontrado,
  ErrorValidacion,
} from "../../compartido/errores.js";
import { obtenerClienteAdmin } from "../../infraestructura/supabase/admin.js";
import {
  ejecutar,
  ejecutarOpcional,
  traducirErrorAuth,
} from "../../infraestructura/supabase/errores.js";
import { TABLAS, type FilaUsuario } from "../../infraestructura/supabase/tablas.js";
import {
  aUsuarioSistema,
  buscarUsuarioPorId,
  type Solicitante,
  type UsuarioSistema,
} from "../acceso/servicio.js";
import type { DatosCrearUsuario, DatosEditarUsuario } from "./esquema.js";

/**
 * Duración del bloqueo al desactivar un usuario: cien años, que es la forma que
 * tiene GoTrue de expresar "indefinido". Reactivar envía `"none"`.
 */
const BLOQUEO_INDEFINIDO = "876000h";

// --- Cuentas de Auth ---------------------------------------------------------

const PATRON_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CuentaAuth {
  id: string;
  correo: string;
}

/**
 * Localiza la cuenta de Auth de un usuario del sistema.
 *
 * Vía rápida: `usuarios.id` **es** el id de la cuenta de Auth. No hay una clave
 * foránea que lo imponga, pero es la convención con la que se creó la base y la
 * que este backend mantiene al dar de alta (ver `crearUsuario`).
 *
 * Vía lenta: si el id no casa —fila dada de alta a mano con otro id, o cuenta
 * recreada desde el panel de Supabase— se recorre el listado de Auth buscando
 * el correo, que es el enlace que el frontend usa para componer la sesión. Es
 * O(n) sobre el total de cuentas, aceptable con decenas de usuarios y la única
 * opción portable: la API de administración no permite filtrar por correo.
 */
async function buscarCuentaAuth(
  correo: string,
  idCandidato: string | null = null,
): Promise<CuentaAuth | null> {
  const cliente = obtenerClienteAdmin();

  if (idCandidato && PATRON_UUID.test(idCandidato)) {
    const { data, error } = await cliente.auth.admin.getUserById(idCandidato);
    if (!error && data.user?.email) {
      return { id: data.user.id, correo: data.user.email.toLowerCase() };
    }
  }

  const buscado = correo.trim().toLowerCase();
  const porPagina = 200;

  for (let pagina = 1; pagina <= 50; pagina += 1) {
    const { data, error } = await cliente.auth.admin.listUsers({
      page: pagina,
      perPage: porPagina,
    });

    if (error) throw traducirErrorAuth(error, "consultar las cuentas de acceso");

    const encontrada = data.users.find(
      (cuenta) => cuenta.email?.toLowerCase() === buscado,
    );
    if (encontrada?.email) {
      return { id: encontrada.id, correo: encontrada.email.toLowerCase() };
    }

    if (data.users.length < porPagina) break;
  }

  return null;
}

/** `true` si ya existe una cuenta de Auth con ese correo. */
async function existeCuentaAuthConCorreo(correo: string): Promise<boolean> {
  return (await buscarCuentaAuth(correo)) !== null;
}

// --- Filas de `usuarios` -----------------------------------------------------

async function existeCorreoEnTabla(correo: string, excluyendoId?: string): Promise<boolean> {
  let consulta = obtenerClienteAdmin()
    .from(TABLAS.USUARIOS)
    .select("id")
    .ilike("correo", correo.trim());

  if (excluyendoId) consulta = consulta.neq("id", excluyendoId);

  const filas = await ejecutar<{ id: string | number }[]>(
    consulta.limit(1),
    "comprobar si el correo ya está registrado",
  );
  return filas.length > 0;
}

/**
 * Comprueba si el nombre de usuario ya está tomado.
 *
 * La base tiene un índice único sobre `lower(usuario)` que es la garantía real;
 * esta consulta existe para poder devolver un error de campo entendible en vez
 * del 23505 crudo. Compara con `eq` porque el nombre se guarda ya en minúsculas
 * y porque `ilike` trataría el `_` como comodín.
 */
async function existeNombreUsuarioEnTabla(
  usuario: string,
  excluyendoId?: string,
): Promise<boolean> {
  let consulta = obtenerClienteAdmin()
    .from(TABLAS.USUARIOS)
    .select("id")
    .eq("usuario", usuario);

  if (excluyendoId) consulta = consulta.neq("id", excluyendoId);

  const filas = await ejecutar<{ id: string | number }[]>(
    consulta.limit(1),
    "comprobar si el nombre de usuario ya está en uso",
  );
  return filas.length > 0;
}

// --- Casos de uso ------------------------------------------------------------

/**
 * Alta completa: cuenta de acceso en Supabase Auth + fila en `usuarios`.
 *
 * No hay transacción posible entre Auth y Postgres, así que se compensa: si la
 * inserción de la fila falla, se borra la cuenta recién creada. El orden
 * importa —primero Auth, luego la tabla— porque una cuenta huérfana es fácil de
 * borrar, mientras que una fila sin cuenta deja al usuario en el limbo que este
 * backend viene a eliminar.
 *
 * La fila se inserta con `id` = id de la cuenta de Auth, que es la convención
 * con la que ya estaba montada la base. Da un enlace por id sin necesidad de
 * columna nueva ni migración, y deja abierta la puerta a resolver la sesión por
 * id en vez de por correo el día que se quiera.
 */
export async function crearUsuario(datos: DatosCrearUsuario): Promise<UsuarioSistema> {
  const cliente = obtenerClienteAdmin();

  if (await existeCorreoEnTabla(datos.correo)) {
    throw new ErrorValidacion("Ya existe un usuario con ese correo.", {
      correo: "Este correo ya está registrado en el sistema.",
    });
  }

  if (datos.usuario && (await existeNombreUsuarioEnTabla(datos.usuario))) {
    throw new ErrorValidacion("Ese nombre de usuario ya está en uso.", {
      usuario: "Ya hay otro usuario con este nombre. Elige otro.",
    });
  }

  if (await existeCuentaAuthConCorreo(datos.correo)) {
    throw new ErrorValidacion("Ya existe una cuenta de acceso con ese correo.", {
      correo:
        "Ya hay una cuenta de acceso con este correo, pero sin usuario del " +
        "sistema. Bórrala en Supabase Auth o usa otro correo.",
    });
  }

  const { data, error } = await cliente.auth.admin.createUser({
    email: datos.correo,
    password: datos.contrasena,
    // Sin confirmación por correo: el administrador ya definió la contraseña y
    // el usuario debe poder entrar de inmediato.
    email_confirm: true,
    ...(datos.activo ? {} : { ban_duration: BLOQUEO_INDEFINIDO }),
  });

  if (error || !data.user) {
    throw traducirErrorAuth(error ?? {}, "crear la cuenta de acceso");
  }

  const cuentaCreada = data.user.id;

  try {
    const fila = await ejecutar<FilaUsuario>(
      cliente
        .from(TABLAS.USUARIOS)
        .insert({
          id: cuentaCreada,
          nombre: datos.nombre,
          correo: datos.correo,
          usuario: datos.usuario,
          telefono: datos.telefono,
          rol_id: datos.rolId,
          activo: datos.activo,
          debe_cambiar_contrasena: datos.debeCambiarContrasena,
        })
        .select("*")
        .single(),
      "crear el usuario",
    );

    return aUsuarioSistema(fila);
  } catch (fallo) {
    await revertirCuentaAuth(cuentaCreada);
    throw fallo;
  }
}

/** Compensación del alta: borra la cuenta que quedó sin fila en `usuarios`. */
async function revertirCuentaAuth(authUserId: string): Promise<void> {
  const { error } = await obtenerClienteAdmin().auth.admin.deleteUser(authUserId);
  if (error) {
    // No se relanza: el error que importa es el que disparó la compensación.
    // Este queda en el log para poder limpiar la cuenta a mano si hiciera falta.
    console.error(
      `[usuarios] No se pudo revertir la cuenta de Auth ${authUserId} tras ` +
        "fallar el alta. Bórrala manualmente en Supabase → Authentication.",
      error,
    );
  }
}

/**
 * Edición: aplica los cambios primero en Auth y después en la tabla.
 *
 * Ese orden es deliberado. Si Auth falla, la tabla no se ha tocado y no hay
 * nada que deshacer; si falla la tabla, se revierten en Auth los valores
 * anteriores, que conocemos exactamente.
 */
export async function editarUsuario(
  id: string,
  cambios: DatosEditarUsuario,
  solicitante: Solicitante,
): Promise<UsuarioSistema> {
  const actual = await buscarUsuarioPorId(id);
  if (!actual) throw new ErrorNoEncontrado("No se encontró el usuario.");

  const esUnoMismo = actual.id === solicitante.usuario.id;

  if (esUnoMismo && cambios.activo === false) {
    throw new ErrorConflicto(
      "No puedes desactivar tu propio usuario: perderías el acceso al sistema.",
    );
  }

  if (cambios.correo && cambios.correo !== actual.correo) {
    if (await existeCorreoEnTabla(cambios.correo, id)) {
      throw new ErrorValidacion("Ya existe un usuario con ese correo.", {
        correo: "Este correo ya está registrado en el sistema.",
      });
    }
  }

  if (cambios.usuario && cambios.usuario !== actual.usuario) {
    if (await existeNombreUsuarioEnTabla(cambios.usuario, id)) {
      throw new ErrorValidacion("Ese nombre de usuario ya está en uso.", {
        usuario: "Ya hay otro usuario con este nombre. Elige otro.",
      });
    }
  }

  const cuenta = await buscarCuentaAuth(actual.correo, actual.id);
  const cambiaCorreo = Boolean(cambios.correo && cambios.correo !== actual.correo);
  const cambiaActivo = cambios.activo !== undefined && cambios.activo !== actual.activo;
  const tocaAuth = cambiaCorreo || cambiaActivo || Boolean(cambios.contrasena);

  if (tocaAuth && !cuenta) {
    throw new ErrorConflicto(
      `El usuario ${actual.correo} no tiene cuenta de acceso en Supabase Auth, ` +
        "así que no se puede cambiar su correo, su contraseña ni su acceso. " +
        "Elimínalo y vuelve a crearlo para generarla.",
    );
  }

  if (tocaAuth && cuenta) {
    const { error } = await obtenerClienteAdmin().auth.admin.updateUserById(cuenta.id, {
      ...(cambiaCorreo ? { email: cambios.correo, email_confirm: true } : {}),
      ...(cambios.contrasena ? { password: cambios.contrasena } : {}),
      ...(cambiaActivo
        ? { ban_duration: cambios.activo ? "none" : BLOQUEO_INDEFINIDO }
        : {}),
    });

    if (error) throw traducirErrorAuth(error, "actualizar la cuenta de acceso");
  }

  const filaNueva: Record<string, unknown> = {};
  if (cambios.nombre !== undefined) filaNueva.nombre = cambios.nombre;
  if (cambios.correo !== undefined) filaNueva.correo = cambios.correo;
  if (cambios.usuario !== undefined) filaNueva.usuario = cambios.usuario;
  if (cambios.telefono !== undefined) filaNueva.telefono = cambios.telefono;
  if (cambios.rolId !== undefined) filaNueva.rol_id = cambios.rolId;
  if (cambios.activo !== undefined) filaNueva.activo = cambios.activo;
  if (cambios.debeCambiarContrasena !== undefined) {
    filaNueva.debe_cambiar_contrasena = cambios.debeCambiarContrasena;
  }

  // La contraseña solo vive en Auth; si era el único cambio, no hay UPDATE.
  if (Object.keys(filaNueva).length === 0) return actual;

  try {
    const fila = await ejecutar<FilaUsuario>(
      obtenerClienteAdmin()
        .from(TABLAS.USUARIOS)
        .update(filaNueva)
        .eq("id", id)
        .select("*")
        .single(),
      "actualizar el usuario",
    );
    return aUsuarioSistema(fila);
  } catch (fallo) {
    if (tocaAuth && cuenta) await revertirCambiosAuth(cuenta, actual, cambiaCorreo, cambiaActivo);
    throw fallo;
  }
}

/**
 * Compensación de la edición: devuelve a Auth el correo y el estado anteriores.
 *
 * La contraseña no se restaura porque no la conocemos —Auth solo guarda su
 * hash—. Es una asimetría aceptable: una contraseña cambiada sin que el resto
 * de los datos cambiara no rompe nada, y el administrador puede volver a
 * fijarla.
 */
async function revertirCambiosAuth(
  cuenta: CuentaAuth,
  anterior: UsuarioSistema,
  seCambioCorreo: boolean,
  seCambioActivo: boolean,
): Promise<void> {
  if (!seCambioCorreo && !seCambioActivo) return;

  const { error } = await obtenerClienteAdmin().auth.admin.updateUserById(cuenta.id, {
    ...(seCambioCorreo ? { email: anterior.correo, email_confirm: true } : {}),
    ...(seCambioActivo
      ? { ban_duration: anterior.activo ? "none" : BLOQUEO_INDEFINIDO }
      : {}),
  });

  if (error) {
    console.error(
      `[usuarios] No se pudieron revertir en Auth los cambios de ${anterior.correo} ` +
        "tras fallar la actualización de la tabla. Revisa la cuenta a mano: el " +
        "correo o el estado de acceso pueden haber quedado desincronizados.",
      error,
    );
  }
}

/**
 * Baja completa: fila de `usuarios` y cuenta de Auth.
 *
 * Se borra primero la fila porque es lo recuperable —se guarda entera y se
 * reinserta si el segundo paso falla—; una cuenta de Auth borrada no se puede
 * restaurar, ya que su contraseña se pierde con ella.
 */
export async function eliminarUsuario(
  id: string,
  solicitante: Solicitante,
): Promise<void> {
  const cliente = obtenerClienteAdmin();

  const fila = await ejecutarOpcional<FilaUsuario>(
    cliente.from(TABLAS.USUARIOS).select("*").eq("id", id).maybeSingle(),
    "cargar el usuario",
  );

  if (!fila) throw new ErrorNoEncontrado("No se encontró el usuario.");

  const usuario = aUsuarioSistema(fila);

  if (usuario.id === solicitante.usuario.id) {
    throw new ErrorConflicto(
      "No puedes eliminar tu propio usuario: perderías el acceso al sistema.",
    );
  }

  const cuenta = await buscarCuentaAuth(usuario.correo, usuario.id);

  const { error: errorBorrado } = await cliente
    .from(TABLAS.USUARIOS)
    .delete()
    .eq("id", id);

  if (errorBorrado) {
    throw new ErrorInfraestructura("No se pudo eliminar el usuario.", errorBorrado);
  }

  // Sin cuenta de Auth el borrado ya está completo: la fila era huérfana.
  if (!cuenta) return;

  const { error: errorAuth } = await cliente.auth.admin.deleteUser(cuenta.id);

  if (errorAuth) {
    await restaurarFilaUsuario(fila);
    throw traducirErrorAuth(errorAuth, "eliminar la cuenta de acceso");
  }
}

/** Compensación de la baja: vuelve a insertar la fila con su id original. */
async function restaurarFilaUsuario(fila: FilaUsuario): Promise<void> {
  const { error } = await obtenerClienteAdmin().from(TABLAS.USUARIOS).insert(fila);

  if (error) {
    console.error(
      `[usuarios] No se pudo restaurar la fila del usuario ${fila.correo} tras ` +
        "fallar el borrado de su cuenta de Auth. El usuario quedó sin fila en " +
        "`usuarios` pero conserva su cuenta de acceso.",
      error,
    );
  }
}
