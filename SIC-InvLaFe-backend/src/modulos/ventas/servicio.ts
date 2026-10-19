import { ErrorNoEncontrado } from "../../compartido/errores.js";
import { redondear2 } from "../../compartido/consultas.js";
import { consultar, consultarUno } from "../../infraestructura/db/pool.js";

/**
 * Ventas (despachos a clientes) y sus cobros.
 *
 * Igual que en compras, las lecturas devuelven las filas con la forma que
 * entregaba Supabase, para que el frontend reutilice sus conversiones y sus
 * cálculos de saldo y estado de cobro.
 */

/** Venta + cliente + lote (con producto, compra y proveedor). */
const SELECT_VENTA = `
  select v.*,
         to_jsonb(cl) as cliente,
         case when l.id is null then null else
           to_jsonb(l) || jsonb_build_object(
             'producto', to_jsonb(pr),
             'compra', to_jsonb(c) || jsonb_build_object('proveedor', to_jsonb(p))
           )
         end as lote
    from ventas v
    left join clientes cl on cl.id = v.cliente_id
    left join lotes_compra l on l.id = v.lote_compra_id
    left join productos pr on pr.id = l.producto_id
    left join compras c on c.id = l.compra_id
    left join proveedores p on p.id = c.proveedor_id`;

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

  marcador(valor: unknown): string {
    this.valores.push(valor);
    return `$${this.valores.length}`;
  }
}

// --- Ventas --------------------------------------------------------------------

export interface FiltroVentas {
  desde?: string;
  hasta?: string;
  clienteId?: string;
  loteCompraId?: string;
  soloConSaldo: boolean;
  limite: number;
}

export async function listarVentas(filtro: FiltroVentas): Promise<unknown[]> {
  const c = new Condiciones();
  if (filtro.desde) c.agregar((n) => `v.fecha >= ${n}`, filtro.desde);
  if (filtro.hasta) c.agregar((n) => `v.fecha <= ${n}`, filtro.hasta);
  if (filtro.clienteId) c.agregar((n) => `v.cliente_id = ${n}`, filtro.clienteId);
  if (filtro.loteCompraId) c.agregar((n) => `v.lote_compra_id = ${n}`, filtro.loteCompraId);
  if (filtro.soloConSaldo) c.partes.push("v.saldo_pendiente > 0");

  const limite = c.marcador(filtro.limite);
  return consultar(
    `${SELECT_VENTA}${c.where} order by v.fecha desc, v.creado_en desc limit ${limite}`,
    c.valores,
    "cargar las ventas",
  );
}

/** Ventas de uno o varios lotes, de la más antigua a la más reciente (cuadre de galones). */
export async function listarVentasPorLotes(loteIds: string[]): Promise<unknown[]> {
  if (loteIds.length === 0) return [];
  return consultar(
    `${SELECT_VENTA} where v.lote_compra_id = any($1::uuid[]) order by v.fecha asc, v.creado_en asc`,
    [loteIds],
    "cargar las ventas de los lotes",
  );
}

export async function obtenerVenta(id: string): Promise<unknown | null> {
  return consultarUno(`${SELECT_VENTA} where v.id = $1`, [id], "cargar la venta");
}

export interface NuevaVenta {
  loteCompraId: string;
  clienteId: string;
  fecha: string;
  numeroFactura: string | null;
  cantidad: number;
  precioUnitario: number;
  valorTotal: number;
  detalle: string | null;
}

/**
 * Inserta la venta. No toca el lote: el descuento de existencia lo coordina
 * el frontend (`registrarVenta`), igual que antes.
 */
export async function crearVenta(datos: NuevaVenta): Promise<unknown> {
  return consultarUno(
    `insert into ventas
       (lote_compra_id, cliente_id, fecha, numero_factura, cantidad, precio_unitario,
        valor_total, saldo_pendiente, detalle)
     values ($1, $2, $3, $4, $5, $6, $7, $7, $8)
     returning *`,
    [
      datos.loteCompraId,
      datos.clienteId,
      datos.fecha,
      datos.numeroFactura,
      datos.cantidad,
      datos.precioUnitario,
      datos.valorTotal,
      datos.detalle,
    ],
    "registrar la venta",
  );
}

/** Si la venta tiene abonos o cotizaciones enlazadas, la base lo impide con un 409. */
export async function eliminarVenta(id: string): Promise<void> {
  const borradas = await consultar(
    "delete from ventas where id = $1 returning id",
    [id],
    "eliminar la venta",
  );
  if (borradas.length === 0) throw new ErrorNoEncontrado("No se encontró la venta.");
}

/**
 * Baja el saldo con bloqueo optimista: solo aplica si el saldo sigue siendo el
 * que el frontend leyó. Devuelve la venta actualizada, o `null` si otro abono
 * se coló en medio.
 */
export async function descontarSaldo(
  id: string,
  monto: number,
  saldoEsperado: number,
): Promise<unknown | null> {
  return consultarUno(
    `update ventas set saldo_pendiente = $1
      where id = $2 and saldo_pendiente = $3
      returning *`,
    [redondear2(saldoEsperado - monto), id, saldoEsperado],
    "actualizar el saldo de la venta",
  );
}

/** Restituye saldo sumando en la misma consulta, sin pisar cambios concurrentes. */
export async function restituirSaldo(id: string, monto: number): Promise<void> {
  await consultar(
    "update ventas set saldo_pendiente = round(saldo_pendiente + $1, 2) where id = $2",
    [monto, id],
    "restituir el saldo de la venta",
  );
}

// --- Pagos de clientes ---------------------------------------------------------

export async function listarPagosDeVenta(ventaId: string): Promise<unknown[]> {
  return consultar(
    "select * from pagos_cliente where venta_id = $1 order by fecha desc, creado_en desc",
    [ventaId],
    "cargar los abonos de la venta",
  );
}

export interface FiltroPagosEnRango {
  desde?: string;
  hasta?: string;
  ventaIds?: string[];
}

export async function listarPagosEnRango(filtro: FiltroPagosEnRango): Promise<unknown[]> {
  if (filtro.ventaIds && filtro.ventaIds.length === 0) return [];

  const c = new Condiciones();
  if (filtro.desde) c.agregar((n) => `fecha >= ${n}`, filtro.desde);
  if (filtro.hasta) c.agregar((n) => `fecha <= ${n}`, filtro.hasta);
  if (filtro.ventaIds) c.agregar((n) => `venta_id = any(${n}::uuid[])`, filtro.ventaIds);

  return consultar(
    `select * from pagos_cliente${c.where} order by fecha asc, creado_en asc`,
    c.valores,
    "cargar los abonos del periodo",
  );
}

export async function crearPagoCliente(datos: {
  ventaId: string;
  fecha: string;
  monto: number;
}): Promise<unknown> {
  return consultarUno(
    "insert into pagos_cliente (venta_id, fecha, monto) values ($1, $2, $3) returning *",
    [datos.ventaId, datos.fecha, datos.monto],
    "registrar el abono del cliente",
  );
}

export async function eliminarPagoCliente(id: string): Promise<void> {
  const borradas = await consultar(
    "delete from pagos_cliente where id = $1 returning id",
    [id],
    "eliminar el abono",
  );
  if (borradas.length === 0) throw new ErrorNoEncontrado("No se encontró el abono.");
}
