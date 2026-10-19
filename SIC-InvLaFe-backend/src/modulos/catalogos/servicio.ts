import { ErrorNoEncontrado, ErrorValidacion } from "../../compartido/errores.js";
import { esObjetoPlano, esTelefonoValido, textoONulo } from "../../compartido/validacion.js";
import { consultar, consultarUno } from "../../infraestructura/db/pool.js";

/**
 * Catálogos: clientes, proveedores y productos.
 *
 * Los tres son tablas sencillas con las mismas operaciones, así que comparten
 * este código. Cada uno se describe con una `DefinicionCatalogo`.
 */
export interface DefinicionCatalogo {
  /** Tabla de la base. */
  tabla: "clientes" | "proveedores" | "productos";
  /** Palabra para los mensajes: "el cliente", "el proveedor"... */
  etiqueta: string;
  /** Si el registro lleva teléfono (clientes y proveedores sí, productos no). */
  conTelefono: boolean;
}

export const CLIENTES: DefinicionCatalogo = {
  tabla: "clientes",
  etiqueta: "cliente",
  conTelefono: true,
};

export const PROVEEDORES: DefinicionCatalogo = {
  tabla: "proveedores",
  etiqueta: "proveedor",
  conTelefono: true,
};

export const PRODUCTOS: DefinicionCatalogo = {
  tabla: "productos",
  etiqueta: "producto",
  conTelefono: false,
};

/** Forma que devuelve la API: igual a las entidades del frontend. */
export interface Registro {
  id: string;
  nombre: string;
  telefono?: string | null;
  creadoEn?: string;
}

interface Fila {
  id: string;
  nombre: string;
  telefono?: string | null;
  creado_en?: string;
}

function columnas(def: DefinicionCatalogo): string {
  return def.conTelefono ? "id, nombre, telefono, creado_en" : "id, nombre";
}

function aRegistro(def: DefinicionCatalogo, fila: Fila): Registro {
  return def.conTelefono
    ? { id: fila.id, nombre: fila.nombre, telefono: fila.telefono ?? null, creadoEn: fila.creado_en ?? "" }
    : { id: fila.id, nombre: fila.nombre };
}

/** Datos que se pueden escribir, ya validados. */
export interface DatosCatalogo {
  nombre: string;
  telefono: string | null;
}

/** Mismas reglas que `validarContacto` y `validarProducto` del frontend. */
export function validarDatos(def: DefinicionCatalogo, cuerpo: unknown): DatosCatalogo {
  if (!esObjetoPlano(cuerpo)) {
    throw new ErrorValidacion("El cuerpo de la petición debe ser un objeto JSON.");
  }

  const campos: Record<string, string> = {};

  const nombre = typeof cuerpo.nombre === "string" ? cuerpo.nombre.trim() : "";
  if (nombre.length < 2) {
    campos.nombre = "El nombre debe tener al menos 2 caracteres.";
  } else if (nombre.length > 120) {
    campos.nombre = "El nombre no puede pasar de 120 caracteres.";
  }

  const telefono = def.conTelefono ? textoONulo(cuerpo.telefono) : null;
  if (telefono && !esTelefonoValido(telefono)) {
    campos.telefono = "El teléfono solo admite números, espacios y los signos + ( ) -.";
  }

  if (Object.keys(campos).length > 0) {
    throw new ErrorValidacion(`Revisa los datos del ${def.etiqueta}.`, campos);
  }

  return { nombre, telefono };
}

export async function listar(def: DefinicionCatalogo): Promise<Registro[]> {
  const filas = await consultar<Fila>(
    `select ${columnas(def)} from ${def.tabla} order by nombre`,
    [],
    `cargar los ${def.tabla}`,
  );
  return filas.map((fila) => aRegistro(def, fila));
}

export async function obtener(def: DefinicionCatalogo, id: string): Promise<Registro | null> {
  const fila = await consultarUno<Fila>(
    `select ${columnas(def)} from ${def.tabla} where id = $1`,
    [id],
    `cargar el ${def.etiqueta}`,
  );
  return fila ? aRegistro(def, fila) : null;
}

export async function crear(def: DefinicionCatalogo, datos: DatosCatalogo): Promise<Registro> {
  const fila = def.conTelefono
    ? await consultarUno<Fila>(
        `insert into ${def.tabla} (nombre, telefono) values ($1, $2) returning ${columnas(def)}`,
        [datos.nombre, datos.telefono],
        `crear el ${def.etiqueta}`,
      )
    : await consultarUno<Fila>(
        `insert into ${def.tabla} (nombre) values ($1) returning ${columnas(def)}`,
        [datos.nombre],
        `crear el ${def.etiqueta}`,
      );
  return aRegistro(def, fila as Fila);
}

export async function actualizar(
  def: DefinicionCatalogo,
  id: string,
  datos: DatosCatalogo,
): Promise<Registro> {
  const fila = def.conTelefono
    ? await consultarUno<Fila>(
        `update ${def.tabla} set nombre = $1, telefono = $2 where id = $3 returning ${columnas(def)}`,
        [datos.nombre, datos.telefono, id],
        `actualizar el ${def.etiqueta}`,
      )
    : await consultarUno<Fila>(
        `update ${def.tabla} set nombre = $1 where id = $2 returning ${columnas(def)}`,
        [datos.nombre, id],
        `actualizar el ${def.etiqueta}`,
      );
  if (!fila) throw new ErrorNoEncontrado(`No se encontró el ${def.etiqueta}.`);
  return aRegistro(def, fila);
}

/** Si el registro está en uso (ventas, compras...), la base lo impide con un 409. */
export async function eliminar(def: DefinicionCatalogo, id: string): Promise<void> {
  const borradas = await consultar(
    `delete from ${def.tabla} where id = $1 returning id`,
    [id],
    `eliminar el ${def.etiqueta}`,
  );
  if (borradas.length === 0) throw new ErrorNoEncontrado(`No se encontró el ${def.etiqueta}.`);
}
