/**
 * Forma cruda de las filas de acceso (usuarios, módulos y permisos), tal como
 * salen de PostgreSQL, y funciones para convertirlas.
 *
 * Los ids se declaran `string | number` para no atar el código a un tipo de
 * columna: los uuid llegan como texto y los bigint como número.
 */
export type IdCrudo = string | number;

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
