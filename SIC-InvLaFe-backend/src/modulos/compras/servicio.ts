import { ErrorNoEncontrado, ErrorValidacion } from "../../compartido/errores.js";
import { redondear2 } from "../../compartido/consultas.js";
import { consultar, consultarUno, transaccion } from "../../infraestructura/db/pool.js";

/**
 * Compras, lotes (líneas de compra) y pagos a proveedores.
 *
 * Las lecturas devuelven las filas con la **misma forma que entregaba
 * Supabase** (nombres en snake_case y relaciones anidadas). Así el frontend
 * reutiliza sus funciones de conversión y sus cálculos de saldo sin cambios.
 * PostgreSQL arma esas estructuras anidadas con `to_jsonb` y `jsonb_agg`.
 */

// --- Consultas base ------------------------------------------------------------

/** Compra + proveedor + líneas (con su producto) + montos de los abonos. */
const SELECT_COMPRA = `
  select c.*,
         to_jsonb(p) as proveedor,
         coalesce((
           select jsonb_agg(to_jsonb(l) || jsonb_build_object('producto', to_jsonb(pr))
                            order by l.creado_en)
             from lotes_compra l
             left join productos pr on pr.id = l.producto_id
            where l.compra_id = c.id
         ), '[]'::jsonb) as lineas,
         coalesce((
           select jsonb_agg(jsonb_build_object('monto', pg.monto))
             from pagos_proveedor pg
            where pg.compra_id = c.id
         ), '[]'::jsonb) as pagos
    from compras c
    left join proveedores p on p.id = c.proveedor_id`;

/** Línea + producto + su compra (con el proveedor dentro). */
const SELECT_LOTE = `
  select l.*,
         to_jsonb(pr) as producto,
         to_jsonb(c) || jsonb_build_object('proveedor', to_jsonb(p)) as compra
    from lotes_compra l
    join compras c on c.id = l.compra_id
    left join productos pr on pr.id = l.producto_id
    left join proveedores p on p.id = c.proveedor_id`;

/**
 * Arma un `where` con los filtros que vengan. Cada valor viaja como parámetro
 * ($1, $2…), nunca pegado al texto del SQL.
 */
class Condiciones {
  readonly partes: string[] = [];
  readonly valores: unknown[] = [];

  agregar(sql: (n: string) => string, valor: unknown): void {
    this.valores.push(valor);
    this.partes.push(sql(`$${this.valores.length}`));
  }

  get where(): string {
    return this.partes.length ? ` where ${this.partes.join(" and ")}` : "";
  }

  /** Agrega el valor y devuelve su marcador, para `limit $n`. */
  marcador(valor: unknown): string {
    this.valores.push(valor);
    return `$${this.valores.length}`;
  }
}

// --- Compras -------------------------------------------------------------------

export interface FiltroCompras {
  desde?: string;
  hasta?: string;
  proveedorId?: string;
  limite: number;
}

export async function listarCompras(filtro: FiltroCompras): Promise<unknown[]> {
  const c = new Condiciones();
  if (filtro.desde) c.agregar((n) => `c.fecha >= ${n}`, filtro.desde);
  if (filtro.hasta) c.agregar((n) => `c.fecha <= ${n}`, filtro.hasta);
  if (filtro.proveedorId) c.agregar((n) => `c.proveedor_id = ${n}`, filtro.proveedorId);

  const limite = c.marcador(filtro.limite);
  return consultar(
    `${SELECT_COMPRA}${c.where} order by c.fecha desc, c.creado_en desc limit ${limite}`,
    c.valores,
    "cargar las compras",
  );
}

export async function obtenerCompra(id: number): Promise<unknown | null> {
  return consultarUno(`${SELECT_COMPRA} where c.id = $1`, [id], "cargar la compra");
}

export interface NuevaLinea {
  productoId: string;
  cantidadComprada: number;
  precioUnitario: number;
}

export interface NuevaCompra {
  proveedorId: string;
  fecha: string;
  numeroFactura: string | null;
  valorFactura: number;
  lineas: NuevaLinea[];
}

/**
 * Cabecera y líneas en una sola transacción: o se guarda la compra completa,
 * o no se guarda nada. Nunca queda una factura sin productos ni productos sin
 * factura.
 */
export async function crearCompra(datos: NuevaCompra): Promise<unknown> {
  if (datos.lineas.length === 0) {
    throw new ErrorValidacion("La compra debe tener al menos un producto.", {
      lineas: "Agrega al menos un producto.",
    });
  }

  return transaccion(async (cliente) => {
    const cabecera = await consultarUno<{ id: number }>(
      `insert into compras (proveedor_id, fecha, numero_factura, valor_factura)
       values ($1, $2, $3, $4) returning *`,
      [datos.proveedorId, datos.fecha, datos.numeroFactura, datos.valorFactura],
      "registrar la compra",
      cliente,
    );

    for (const linea of datos.lineas) {
      // Una línea nace íntegra: todo lo comprado está disponible.
      await consultar(
        `insert into lotes_compra
           (compra_id, producto_id, cantidad_comprada, precio_unitario, cantidad_disponible)
         values ($1, $2, $3, $4, $3)`,
        [cabecera?.id, linea.productoId, linea.cantidadComprada, linea.precioUnitario],
        "registrar las líneas de la compra",
        cliente,
      );
    }

    return cabecera;
  }, "registrar la compra");
}

/** Las líneas y los abonos se borran en cascada (lo define la base). */
export async function eliminarCompra(id: number): Promise<void> {
  const borradas = await consultar(
    "delete from compras where id = $1 returning id",
    [id],
    "eliminar la compra",
  );
  if (borradas.length === 0) throw new ErrorNoEncontrado("No se encontró la compra.");
}

// --- Lotes ---------------------------------------------------------------------

export interface FiltroLotes {
  desde?: string;
  hasta?: string;
  proveedorId?: string;
  productoId?: string;
  productoIds?: string[];
  soloDisponibles: boolean;
  limite: number;
}

export async function listarLotes(filtro: FiltroLotes): Promise<unknown[]> {
  const c = new Condiciones();
  if (filtro.desde) c.agregar((n) => `c.fecha >= ${n}`, filtro.desde);
  if (filtro.hasta) c.agregar((n) => `c.fecha <= ${n}`, filtro.hasta);
  if (filtro.proveedorId) c.agregar((n) => `c.proveedor_id = ${n}`, filtro.proveedorId);
  if (filtro.productoId) c.agregar((n) => `l.producto_id = ${n}`, filtro.productoId);
  if (filtro.productoIds?.length) {
    c.agregar((n) => `l.producto_id = any(${n}::uuid[])`, filtro.productoIds);
  }
  if (filtro.soloDisponibles) c.partes.push("l.cantidad_disponible > 0");

  const limite = c.marcador(filtro.limite);
  return consultar(
    `${SELECT_LOTE}${c.where} order by l.creado_en desc limit ${limite}`,
    c.valores,
    "cargar las líneas de compra",
  );
}

export async function obtenerLote(id: string): Promise<unknown | null> {
  return consultarUno(`${SELECT_LOTE} where l.id = $1`, [id], "cargar el lote de compra");
}

/**
 * Descuenta existencia con bloqueo optimista: solo aplica si la existencia
 * sigue valiendo lo que el frontend leyó. Si otra venta se coló en medio, no
 * cambia nada y responde `false`, para que el usuario reintente con el dato
 * fresco. Así el inventario nunca queda en negativo.
 */
export async function descontarExistencia(
  id: string,
  cantidad: number,
  disponibleEsperada: number,
): Promise<boolean> {
  const filas = await consultar(
    `update lotes_compra
        set cantidad_disponible = $1
      where id = $2 and cantidad_disponible = $3
      returning id`,
    [redondear2(disponibleEsperada - cantidad), id, disponibleEsperada],
    "descontar la existencia del lote",
  );
  return filas.length > 0;
}

/**
 * Devuelve existencia al lote (al anular una venta o si falla su registro).
 * Se suma en la misma consulta, así no se pisa ningún cambio concurrente.
 */
export async function devolverExistencia(id: string, cantidad: number): Promise<void> {
  await consultar(
    "update lotes_compra set cantidad_disponible = round(cantidad_disponible + $1, 2) where id = $2",
    [cantidad, id],
    "devolver la existencia al lote",
  );
}

// --- Pagos a proveedor ---------------------------------------------------------

export async function listarPagosDeCompra(compraId: number): Promise<unknown[]> {
  return consultar(
    "select * from pagos_proveedor where compra_id = $1 order by fecha desc, creado_en desc",
    [compraId],
    "cargar los abonos de la compra",
  );
}

export interface FiltroPagosEnRango {
  desde?: string;
  hasta?: string;
  compraIds?: number[];
}

export async function listarPagosEnRango(filtro: FiltroPagosEnRango): Promise<unknown[]> {
  if (filtro.compraIds && filtro.compraIds.length === 0) return [];

  const c = new Condiciones();
  if (filtro.desde) c.agregar((n) => `fecha >= ${n}`, filtro.desde);
  if (filtro.hasta) c.agregar((n) => `fecha <= ${n}`, filtro.hasta);
  if (filtro.compraIds) c.agregar((n) => `compra_id = any(${n}::bigint[])`, filtro.compraIds);

  return consultar(
    `select * from pagos_proveedor${c.where} order by fecha asc, creado_en asc`,
    c.valores,
    "cargar los abonos del periodo",
  );
}

export async function crearPagoProveedor(datos: {
  compraId: number;
  fecha: string;
  monto: number;
}): Promise<unknown> {
  return consultarUno(
    "insert into pagos_proveedor (compra_id, fecha, monto) values ($1, $2, $3) returning *",
    [datos.compraId, datos.fecha, datos.monto],
    "registrar el abono al proveedor",
  );
}

export async function eliminarPagoProveedor(id: string): Promise<void> {
  const borradas = await consultar(
    "delete from pagos_proveedor where id = $1 returning id",
    [id],
    "eliminar el abono",
  );
  if (borradas.length === 0) throw new ErrorNoEncontrado("No se encontró el abono.");
}
