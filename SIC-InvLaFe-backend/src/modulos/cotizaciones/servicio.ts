import { ErrorNoEncontrado } from "../../compartido/errores.js";
import { consultar, consultarUno, transaccion, type Ejecutor } from "../../infraestructura/db/pool.js";

/**
 * Cotizaciones y sus líneas (`cotizacion_items`).
 *
 * Las lecturas devuelven la forma de Supabase (cliente y líneas anidadas, cada
 * línea con su producto), para que el frontend reutilice sus cálculos de
 * subtotales y totales.
 */

const SELECT_COTIZACION = `
  select co.*,
         to_jsonb(cl) as cliente,
         coalesce((
           select jsonb_agg(to_jsonb(i) || jsonb_build_object('producto', to_jsonb(pr))
                            order by i.id)
             from cotizacion_items i
             left join productos pr on pr.id = i.producto_id
            where i.cotizacion_id = co.id
         ), '[]'::jsonb) as lineas
    from cotizaciones co
    left join clientes cl on cl.id = co.cliente_id`;

/** Estados que admite la base (restricción `cotizaciones_estado_check`). */
export const ESTADOS = ["pendiente", "aceptada", "rechazada"] as const;
export type Estado = (typeof ESTADOS)[number];

export interface FiltroCotizaciones {
  desde?: string;
  hasta?: string;
  clienteId?: string;
}

export async function listarCotizaciones(filtro: FiltroCotizaciones): Promise<unknown[]> {
  const partes: string[] = [];
  const valores: unknown[] = [];
  const agregar = (sql: (n: string) => string, valor: unknown) => {
    valores.push(valor);
    partes.push(sql(`$${valores.length}`));
  };

  if (filtro.desde) agregar((n) => `co.fecha >= ${n}`, filtro.desde);
  if (filtro.hasta) agregar((n) => `co.fecha <= ${n}`, filtro.hasta);
  if (filtro.clienteId) agregar((n) => `co.cliente_id = ${n}`, filtro.clienteId);

  const where = partes.length ? ` where ${partes.join(" and ")}` : "";
  return consultar(
    `${SELECT_COTIZACION}${where} order by co.fecha desc, co.creado_en desc limit 500`,
    valores,
    "cargar las cotizaciones",
  );
}

export async function obtenerCotizacion(id: string): Promise<unknown | null> {
  return consultarUno(`${SELECT_COTIZACION} where co.id = $1`, [id], "cargar la cotización");
}

export interface LineaCotizacion {
  productoId: string;
  cantidad: number;
  precioUnitario: number;
}

export interface DatosCotizacion {
  clienteId: string;
  fecha: string;
  nota: string | null;
  estado: Estado;
  lineas: LineaCotizacion[];
}

async function insertarLineas(
  cotizacionId: string,
  lineas: readonly LineaCotizacion[],
  cliente: Ejecutor,
): Promise<void> {
  for (const linea of lineas) {
    await consultar(
      `insert into cotizacion_items (cotizacion_id, producto_id, cantidad, precio_unitario)
       values ($1, $2, $3, $4)`,
      [cotizacionId, linea.productoId, linea.cantidad, linea.precioUnitario],
      "guardar las líneas de la cotización",
      cliente,
    );
  }
}

/** Cotización y líneas en una sola transacción: o todo, o nada. */
export async function crearCotizacion(datos: DatosCotizacion): Promise<unknown> {
  return transaccion(async (cliente) => {
    const fila = await consultarUno<{ id: string }>(
      `insert into cotizaciones (cliente_id, fecha, detalle, estado)
       values ($1, $2, $3, $4) returning *`,
      [datos.clienteId, datos.fecha, datos.nota, datos.estado],
      "crear la cotización",
      cliente,
    );
    await insertarLineas(fila!.id, datos.lineas, cliente);
    return fila;
  }, "crear la cotización");
}

/**
 * Reemplaza la cotización y todas sus líneas, también en una transacción: si
 * algo falla, la cotización queda exactamente como estaba.
 */
export async function actualizarCotizacion(id: string, datos: DatosCotizacion): Promise<unknown> {
  return transaccion(async (cliente) => {
    const fila = await consultarUno<{ id: string }>(
      `update cotizaciones set cliente_id = $1, fecha = $2, detalle = $3, estado = $4
        where id = $5 returning *`,
      [datos.clienteId, datos.fecha, datos.nota, datos.estado, id],
      "actualizar la cotización",
      cliente,
    );
    if (!fila) throw new ErrorNoEncontrado("No se encontró la cotización.");

    await consultar(
      "delete from cotizacion_items where cotizacion_id = $1",
      [id],
      "reemplazar las líneas de la cotización",
      cliente,
    );
    await insertarLineas(id, datos.lineas, cliente);
    return fila;
  }, "actualizar la cotización");
}

export async function cambiarEstado(id: string, estado: Estado): Promise<unknown> {
  const fila = await consultarUno(
    "update cotizaciones set estado = $1 where id = $2 returning *",
    [estado, id],
    "cambiar el estado de la cotización",
  );
  if (!fila) throw new ErrorNoEncontrado("No se encontró la cotización.");
  return fila;
}

/** Marca la cotización como facturada, apuntando a la primera venta. */
export async function enlazarVenta(id: string, ventaId: string): Promise<unknown> {
  const fila = await consultarUno(
    "update cotizaciones set venta_id = $1 where id = $2 returning *",
    [ventaId, id],
    "enlazar la cotización con la venta",
  );
  if (!fila) throw new ErrorNoEncontrado("No se encontró la cotización.");
  return fila;
}

export async function enlazarVentaDeLinea(lineaId: number, ventaId: string): Promise<void> {
  const filas = await consultar(
    "update cotizacion_items set venta_id = $1 where id = $2 returning id",
    [ventaId, lineaId],
    "enlazar la línea con su venta",
  );
  if (filas.length === 0) throw new ErrorNoEncontrado("No se encontró la línea de la cotización.");
}

/** Las líneas se borran en cascada (lo define la base). */
export async function eliminarCotizacion(id: string): Promise<void> {
  const borradas = await consultar(
    "delete from cotizaciones where id = $1 returning id",
    [id],
    "eliminar la cotización",
  );
  if (borradas.length === 0) throw new ErrorNoEncontrado("No se encontró la cotización.");
}
