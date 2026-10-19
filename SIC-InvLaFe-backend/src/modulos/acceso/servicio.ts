import { obtenerClienteAdmin } from "../../infraestructura/supabase/admin.js";
import { ejecutar, ejecutarOpcional } from "../../infraestructura/supabase/errores.js";
import {
  TABLAS,
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
  /** Id de la cuenta en `auth.users`. */
  authUserId: string;
  /** Correo de la cuenta de Auth, ya en minúsculas. */
  correo: string;
  /** Fila de `usuarios` enlazada por correo. */
  usuario: UsuarioSistema;
}

/**
 * Fila de `usuarios` en la forma que usa el resto del backend.
 *
 * `id` coincide con el de la cuenta de Auth en las filas creadas por este
 * backend (ver `FilaUsuario`), lo que permite localizar la cuenta sin recorrer
 * el listado completo de Auth.
 */
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
    // Sin valor explícito se asume activo: es como se comportan las filas
    // creadas antes de que la columna existiera. Igual que en el frontend.
    activo: aBooleano(fila.activo, true),
    // Aquí el valor por defecto es el contrario y por el mismo motivo: sin
    // columna, nadie tenía cambio pendiente, y asumir `true` dejaría a todo el
    // mundo atrapado en la pantalla de cambio tras desplegar sin migrar.
    debeCambiarContrasena: aBooleano(fila.debe_cambiar_contrasena, false),
    creadoEn: fila.creado_en,
  };
}

/**
 * Busca la fila de `usuarios` que corresponde a una cuenta de Auth.
 *
 * El enlace es el correo (ver `docs/supabase.md` del frontend). Se compara sin
 * distinguir mayúsculas porque Auth normaliza el email y una fila pudo darse de
 * alta a mano con otra capitalización.
 */
export async function buscarUsuarioPorCorreo(
  correo: string,
): Promise<UsuarioSistema | null> {
  const fila = await ejecutarOpcional<FilaUsuario>(
    obtenerClienteAdmin()
      .from(TABLAS.USUARIOS)
      .select("*")
      .ilike("correo", correo.trim())
      .limit(1)
      .maybeSingle(),
    "identificar tu usuario",
  );
  return fila ? aUsuarioSistema(fila) : null;
}

/**
 * Busca la fila de `usuarios` por su nombre de usuario.
 *
 * Es el primer paso del login por nombre de usuario: Supabase Auth solo acepta
 * correo o teléfono como identificador, así que el nombre hay que traducirlo
 * antes.
 *
 * La comparación es de igualdad exacta contra el valor en minúsculas, **no**
 * `ilike`, y eso es deliberado: el patrón de nombre de usuario admite `_`, que
 * en `LIKE` es un comodín de un carácter, así que buscar `j_perez` con `ilike`
 * casaría también con `jxperez`. Se puede usar `eq` porque el nombre se guarda
 * ya normalizado a minúsculas (ver `normalizarNombreUsuario` en `esquema.ts`).
 */
export async function buscarUsuarioPorNombreUsuario(
  usuario: string,
): Promise<UsuarioSistema | null> {
  const limpio = usuario.trim().toLowerCase();
  if (!limpio) return null;

  const fila = await ejecutarOpcional<FilaUsuario>(
    obtenerClienteAdmin()
      .from(TABLAS.USUARIOS)
      .select("*")
      .eq("usuario", limpio)
      .limit(1)
      .maybeSingle(),
    "identificar tu usuario",
  );
  return fila ? aUsuarioSistema(fila) : null;
}

export async function buscarUsuarioPorId(id: string): Promise<UsuarioSistema | null> {
  const fila = await ejecutarOpcional<FilaUsuario>(
    obtenerClienteAdmin().from(TABLAS.USUARIOS).select("*").eq("id", id).maybeSingle(),
    "cargar el usuario",
  );
  return fila ? aUsuarioSistema(fila) : null;
}

/**
 * Acciones que un rol puede ejecutar sobre un módulo.
 *
 * Reproduce la semántica de `construirMapaPermisos` + `puede` del frontend:
 *
 * - Un rol puede tener varias filas para el mismo módulo (si la tabla `modulos`
 *   tiene entradas con nombres distintos que casan con la misma clave); se
 *   acumulan con OR para que gane el permiso más amplio.
 * - Crear, editar y eliminar exigen además poder ver: conceder "eliminar" sobre
 *   un módulo invisible no tiene sentido y en la interfaz nunca ocurre.
 * - Lo que no está concedido explícitamente, está denegado.
 */
export async function accionesPermitidas(
  rolId: string | null,
  modulo: ClaveModulo,
): Promise<AccionesPermitidas> {
  if (!rolId) return { ...SIN_PERMISOS };

  const cliente = obtenerClienteAdmin();

  const modulos = await ejecutar<FilaModulo[]>(
    cliente.from(TABLAS.MODULOS).select("*"),
    "cargar los módulos",
  );

  const idsDelModulo = modulos
    .filter((fila) => claveDeModulo(fila.nombre) === modulo)
    .map((fila) => aId(fila.id));

  // Sin fila en `modulos` no hay permiso que conceder. Es un fallo de
  // configuración, no del usuario, y el frontend ya lo señala en pantalla.
  if (idsDelModulo.length === 0) return { ...SIN_PERMISOS };

  const permisos = await ejecutar<FilaPermisoRol[]>(
    cliente
      .from(TABLAS.PERMISOS_ROL)
      .select("*")
      .eq("rol_id", rolId)
      .in("modulo_id", idsDelModulo),
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
