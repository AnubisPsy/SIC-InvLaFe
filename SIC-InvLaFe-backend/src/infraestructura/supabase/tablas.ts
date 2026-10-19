/**
 * Nombres de tabla y forma cruda de las filas, tal como las devuelve PostgREST.
 *
 * Espejo reducido de `packages/core/src/infrastructure/supabase/tablas.ts` del
 * frontend: aquí solo aparecen las tablas que el backend necesita tocar.
 *
 * Los ids se declaran `string | number` porque PostgREST serializa `bigint`
 * como número y `uuid` como texto, y el esquema de este proyecto no está fijado
 * a uno de los dos.
 */
export const TABLAS = {
  USUARIOS: "usuarios",
  ROLES: "roles",
  MODULOS: "modulos",
  PERMISOS_ROL: "permisos_rol",
} as const;

export type IdCrudo = string | number;

/**
 * `id` es, por convención de este proyecto, el mismo UUID que
 * `auth.users.id` de la cuenta de acceso. No hay clave foránea que lo imponga,
 * y el frontend sigue resolviendo la sesión por correo, pero el backend
 * mantiene la convención al dar de alta para que el enlace por id exista.
 */
export interface FilaUsuario {
  id: IdCrudo;
  nombre: string;
  correo: string;
  /**
   * Nombre de usuario para iniciar sesión, alternativo al correo. `null` en las
   * filas de quien solo entra por correo, que es lo normal.
   */
  usuario: string | null;
  telefono: string | null;
  rol_id: IdCrudo | null;
  activo: boolean | null;
  /**
   * Obliga a definir una contraseña nueva antes de poder usar la aplicación.
   * `null` cuenta como `false`: las filas más antiguas nunca la tuvieron.
   */
  debe_cambiar_contrasena: boolean | null;
  creado_en: string;
}

export interface FilaModulo {
  id: IdCrudo;
  nombre: string;
}

export interface FilaPermisoRol {
  id: IdCrudo;
  rol_id: IdCrudo;
  modulo_id: IdCrudo;
  puede_ver: boolean | null;
  puede_crear: boolean | null;
  puede_editar: boolean | null;
  puede_eliminar: boolean | null;
}

/** Todo id se maneja como texto fuera de infraestructura. */
export function aId(valor: IdCrudo | null | undefined): string {
  return valor === null || valor === undefined ? "" : String(valor);
}

export function aIdOpcional(valor: IdCrudo | null | undefined): string | null {
  return valor === null || valor === undefined ? null : String(valor);
}

export function aBooleano(
  valor: boolean | null | undefined,
  porDefecto = false,
): boolean {
  return valor === null || valor === undefined ? porDefecto : valor;
}
