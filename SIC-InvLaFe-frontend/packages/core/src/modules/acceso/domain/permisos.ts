import type { ID } from "../../../shared/tipos";
import { CLAVES_MODULO, type ClaveModulo, type Modulo } from "./modulos";

export type Accion = "ver" | "crear" | "editar" | "eliminar";

export const ACCIONES: readonly Accion[] = ["ver", "crear", "editar", "eliminar"];

export const ETIQUETA_ACCION: Record<Accion, string> = {
  ver: "Ver",
  crear: "Crear",
  editar: "Editar",
  eliminar: "Eliminar",
};

export interface AccionesPermitidas {
  ver: boolean;
  crear: boolean;
  editar: boolean;
  eliminar: boolean;
}

export const SIN_PERMISOS: AccionesPermitidas = {
  ver: false,
  crear: false,
  editar: false,
  eliminar: false,
};

/** Fila de `permisos_rol` tal como la entiende el dominio. */
export interface PermisoRol extends AccionesPermitidas {
  id: ID;
  rolId: ID;
  moduloId: ID;
}

/** Permisos efectivos del usuario, indexados por clave de módulo. */
export type MapaPermisos = Record<ClaveModulo, AccionesPermitidas>;

export function mapaPermisosVacio(): MapaPermisos {
  return Object.fromEntries(
    CLAVES_MODULO.map((clave) => [clave, { ...SIN_PERMISOS }]),
  ) as MapaPermisos;
}

/**
 * Cruza `permisos_rol` con `modulos` para producir el mapa que consume la UI.
 *
 * Todo lo que no esté explícitamente concedido queda denegado, y las filas de
 * `permisos_rol` que apuntan a módulos no reconocidos se descartan en silencio:
 * conceder algo que el frontend no sabe proteger sería peor que ignorarlo.
 */
export function construirMapaPermisos(
  permisos: readonly PermisoRol[],
  modulos: readonly Modulo[],
): MapaPermisos {
  const claveDeId = new Map<ID, ClaveModulo>();
  for (const modulo of modulos) {
    if (modulo.clave) claveDeId.set(modulo.id, modulo.clave);
  }

  const mapa = mapaPermisosVacio();

  for (const permiso of permisos) {
    const clave = claveDeId.get(permiso.moduloId);
    if (!clave) continue;

    // Un rol podría tener más de una fila para el mismo módulo; se acumula con
    // OR para que el permiso más amplio gane.
    const actual = mapa[clave];
    mapa[clave] = {
      ver: actual.ver || permiso.ver,
      crear: actual.crear || permiso.crear,
      editar: actual.editar || permiso.editar,
      eliminar: actual.eliminar || permiso.eliminar,
    };
  }

  return mapa;
}

export function puede(
  mapa: MapaPermisos | null | undefined,
  modulo: ClaveModulo,
  accion: Accion,
): boolean {
  if (!mapa) return false;
  const permitido = mapa[modulo];
  if (!permitido) return false;
  // Crear, editar y eliminar carecen de sentido sin poder ver el módulo.
  return accion === "ver" ? permitido.ver : permitido.ver && permitido[accion];
}

export function puedeVer(mapa: MapaPermisos | null | undefined, modulo: ClaveModulo): boolean {
  return puede(mapa, modulo, "ver");
}

/** Módulos visibles para el usuario, en el orden del catálogo. */
export function modulosVisibles(mapa: MapaPermisos | null | undefined): ClaveModulo[] {
  if (!mapa) return [];
  return CLAVES_MODULO.filter((clave) => mapa[clave].ver);
}

/** Cambios de permisos que la pantalla de roles envía al guardar. */
export interface PermisoEditable extends AccionesPermitidas {
  moduloId: ID;
}
