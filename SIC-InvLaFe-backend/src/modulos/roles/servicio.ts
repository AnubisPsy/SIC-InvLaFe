import { ErrorNoEncontrado, ErrorValidacion } from "../../compartido/errores.js";
import { esObjetoPlano } from "../../compartido/validacion.js";
import { consultar, consultarUno, transaccion } from "../../infraestructura/db/pool.js";
import {
  aBooleano,
  aId,
  type FilaModulo,
  type FilaPermisoRol,
} from "../../infraestructura/supabase/tablas.js";

// --- Formas que devuelve la API (iguales a las entidades del frontend) -------

export interface Rol {
  id: string;
  nombre: string;
  creadoEn: string;
}

export interface Modulo {
  id: string;
  nombre: string;
}

export interface PermisoRol {
  id: string;
  rolId: string;
  moduloId: string;
  ver: boolean;
  crear: boolean;
  editar: boolean;
  eliminar: boolean;
}

interface FilaRol {
  id: string;
  nombre: string;
  creado_en: string;
}

const aRol = (fila: FilaRol): Rol => ({
  id: aId(fila.id),
  nombre: fila.nombre,
  creadoEn: fila.creado_en,
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

// --- Roles -------------------------------------------------------------------

export async function listarRoles(): Promise<Rol[]> {
  const filas = await consultar<FilaRol>(
    "select id, nombre, creado_en from roles order by nombre",
    [],
    "cargar los roles",
  );
  return filas.map(aRol);
}

export async function obtenerRol(id: string): Promise<Rol | null> {
  const fila = await consultarUno<FilaRol>(
    "select id, nombre, creado_en from roles where id = $1",
    [id],
    "cargar el rol",
  );
  return fila ? aRol(fila) : null;
}

export function validarNombreRol(cuerpo: unknown): string {
  const nombre =
    esObjetoPlano(cuerpo) && typeof cuerpo.nombre === "string" ? cuerpo.nombre.trim() : "";
  if (nombre.length < 2) {
    throw new ErrorValidacion("Revisa los datos del rol.", {
      nombre: "El nombre debe tener al menos 2 caracteres.",
    });
  }
  return nombre;
}

export async function crearRol(nombre: string): Promise<Rol> {
  const fila = await consultarUno<FilaRol>(
    "insert into roles (nombre) values ($1) returning id, nombre, creado_en",
    [nombre],
    "crear el rol",
  );
  return aRol(fila as FilaRol);
}

export async function actualizarRol(id: string, nombre: string): Promise<Rol> {
  const fila = await consultarUno<FilaRol>(
    "update roles set nombre = $1 where id = $2 returning id, nombre, creado_en",
    [nombre, id],
    "actualizar el rol",
  );
  if (!fila) throw new ErrorNoEncontrado("No se encontró el rol.");
  return aRol(fila);
}

/** Si el rol tiene usuarios, la base lo impide y responde con un 409. */
export async function eliminarRol(id: string): Promise<void> {
  const borradas = await consultar(
    "delete from roles where id = $1 returning id",
    [id],
    "eliminar el rol",
  );
  if (borradas.length === 0) throw new ErrorNoEncontrado("No se encontró el rol.");
}

export async function contarUsuariosDelRol(rolId: string): Promise<number> {
  const fila = await consultarUno<{ cantidad: number }>(
    "select count(*)::int as cantidad from usuarios where rol_id = $1",
    [rolId],
    "contar los usuarios del rol",
  );
  return fila?.cantidad ?? 0;
}

// --- Módulos -----------------------------------------------------------------

export async function listarModulos(): Promise<Modulo[]> {
  const filas = await consultar<FilaModulo>(
    "select id, nombre from modulos order by nombre",
    [],
    "cargar los módulos",
  );
  return filas.map((fila) => ({ id: aId(fila.id), nombre: fila.nombre }));
}

// --- Permisos ----------------------------------------------------------------

export async function listarPermisosDelRol(rolId: string): Promise<PermisoRol[]> {
  const filas = await consultar<FilaPermisoRol>(
    "select * from permisos_rol where rol_id = $1",
    [rolId],
    "cargar los permisos del rol",
  );
  return filas.map(aPermisoRol);
}

export interface PermisoEditable {
  moduloId: string;
  ver: boolean;
  crear: boolean;
  editar: boolean;
  eliminar: boolean;
}

export function validarPermisos(cuerpo: unknown): PermisoEditable[] {
  const lista = esObjetoPlano(cuerpo) ? cuerpo.permisos : undefined;
  if (!Array.isArray(lista)) {
    throw new ErrorValidacion("Envía la lista de permisos en «permisos».");
  }

  return lista.map((item) => {
    if (!esObjetoPlano(item) || typeof item.moduloId !== "string" || !item.moduloId) {
      throw new ErrorValidacion("Cada permiso debe indicar su «moduloId».");
    }
    return {
      moduloId: item.moduloId,
      ver: item.ver === true,
      crear: item.crear === true,
      editar: item.editar === true,
      eliminar: item.eliminar === true,
    };
  });
}

/**
 * Reemplaza en bloque los permisos del rol, dentro de una transacción: si algo
 * falla a la mitad, el rol conserva los permisos que tenía.
 */
export async function guardarPermisosDelRol(
  rolId: string,
  permisos: readonly PermisoEditable[],
): Promise<PermisoRol[]> {
  return transaccion(async (cliente) => {
    await consultar("delete from permisos_rol where rol_id = $1", [rolId], "guardar los permisos del rol", cliente);

    const guardadas: PermisoRol[] = [];
    for (const permiso of permisos) {
      // Una fila sin ningún permiso no aporta nada: no se guarda.
      if (!permiso.ver && !permiso.crear && !permiso.editar && !permiso.eliminar) continue;

      const fila = await consultarUno<FilaPermisoRol>(
        `insert into permisos_rol
           (rol_id, modulo_id, puede_ver, puede_crear, puede_editar, puede_eliminar)
         values ($1, $2, $3, $4, $5, $6)
         returning *`,
        [rolId, permiso.moduloId, permiso.ver, permiso.crear, permiso.editar, permiso.eliminar],
        "guardar los permisos del rol",
        cliente,
      );
      if (fila) guardadas.push(aPermisoRol(fila));
    }
    return guardadas;
  }, "guardar los permisos del rol");
}
