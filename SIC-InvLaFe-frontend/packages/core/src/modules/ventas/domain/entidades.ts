import { ErrorValidacion } from "../../../shared/errores";
import { esFechaISOValida } from "../../../shared/fechas";
import { esCero, redondearCantidad, redondearMonto } from "../../../shared/numeros";
import { textoONulo } from "../../../shared/texto";
import type { FechaHoraISO, FechaISO, ID, RangoFechas } from "../../../shared/tipos";
import type { Cliente } from "../../catalogos/domain/entidades";
import type { LoteCompraDetalle } from "../../compras/domain/entidades";

/**
 * Una venta siempre sale de un lote concreto (`loteCompraId`): es lo que
 * permite trazar de qué compra salió cada galón despachado.
 */
export interface Venta {
  id: ID;
  loteCompraId: ID;
  clienteId: ID;
  fecha: FechaISO;
  numeroFactura: string | null;
  cantidad: number;
  precioUnitario: number;
  valorTotal: number;
  /** Lo que el cliente aún debe. Arranca en `valorTotal` y baja con cada abono. */
  saldoPendiente: number;
  /**
   * Nota libre para el desglose en barriles, p. ej. «25x60» para 1500
   * galones repartidos en 25 barriles de 60. El combustible se carga en
   * barriles y los galones solos no bastan para cuadrar la carga física.
   */
  detalle: string | null;
  creadoEn: FechaHoraISO;
}

export interface PagoCliente {
  id: ID;
  ventaId: ID;
  fecha: FechaISO;
  monto: number;
  creadoEn: FechaHoraISO;
}

export type EstadoCobro = "pendiente" | "abonada" | "saldada";

export interface VentaDetalle extends Venta {
  cliente: Cliente | null;
  lote: LoteCompraDetalle | null;
  totalCobrado: number;
  estadoCobro: EstadoCobro;
}

export interface NuevaVenta {
  loteCompraId: ID;
  clienteId: ID;
  fecha: FechaISO;
  numeroFactura: string | null;
  cantidad: number;
  precioUnitario: number;
  detalle?: string | null;
}

export interface NuevoPagoCliente {
  ventaId: ID;
  fecha: FechaISO;
  monto: number;
}

/**
 * `desde`, `hasta`, `clienteId`, `loteCompraId`, `soloConSaldo` y `limite` los
 * resuelve Postgres. `productoId` y `busqueda` se aplican sobre el resultado,
 * porque cuelgan de tablas embebidas.
 */
export interface FiltroVentas extends RangoFechas {
  clienteId?: ID;
  loteCompraId?: ID;
  productoId?: ID;
  /** `true` deja solo las ventas que aún deben algo — la vista de cobros. */
  soloConSaldo?: boolean;
  busqueda?: string;
  limite?: number;
}

export const LIMITE_VENTAS_POR_DEFECTO = 500;

// --- Reglas ------------------------------------------------------------------

export function calcularValorTotal(cantidad: number, precioUnitario: number): number {
  return redondearMonto(cantidad * precioUnitario);
}

export function estadoDeCobro(valorTotal: number, saldoPendiente: number): EstadoCobro {
  if (esCero(saldoPendiente)) return "saldada";
  if (saldoPendiente >= valorTotal - 0.005) return "pendiente";
  return "abonada";
}

export function totalCobrado(venta: Pick<Venta, "valorTotal" | "saldoPendiente">): number {
  return redondearMonto(Math.max(venta.valorTotal - venta.saldoPendiente, 0));
}

/**
 * Valida la venta contra la existencia real del lote.
 *
 * `disponibleEnLote` se pasa explícitamente en vez de leerlo aquí para que la
 * regla siga siendo una función pura y el caso de uso decida cuándo consultarlo.
 */
export function validarNuevaVenta(
  datos: NuevaVenta,
  disponibleEnLote: number,
): NuevaVenta {
  const campos: Record<string, string> = {};

  if (!datos.loteCompraId) campos.loteCompraId = "Selecciona el lote del que sale el producto.";
  if (!datos.clienteId) campos.clienteId = "Selecciona el cliente.";

  if (!datos.fecha || !esFechaISOValida(datos.fecha)) {
    campos.fecha = "Indica una fecha válida.";
  }

  const cantidad = redondearCantidad(datos.cantidad);
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    campos.cantidad = "La cantidad debe ser mayor que cero.";
  } else if (cantidad > disponibleEnLote + 0.0001) {
    campos.cantidad = `El lote solo tiene ${disponibleEnLote} disponibles.`;
  }

  const precioUnitario = redondearMonto(datos.precioUnitario);
  if (!Number.isFinite(precioUnitario) || precioUnitario <= 0) {
    campos.precioUnitario = "El precio unitario debe ser mayor que cero.";
  }

  if (Object.keys(campos).length > 0) {
    throw new ErrorValidacion("Revisa los datos de la venta.", campos);
  }

  return {
    ...datos,
    numeroFactura: textoONulo(datos.numeroFactura),
    detalle: textoONulo(datos.detalle),
    cantidad,
    precioUnitario,
  };
}

export function validarAbonoCliente(
  datos: NuevoPagoCliente,
  saldoActual: number,
): NuevoPagoCliente {
  const campos: Record<string, string> = {};

  if (!datos.ventaId) campos.ventaId = "Selecciona la venta.";

  if (!datos.fecha || !esFechaISOValida(datos.fecha)) {
    campos.fecha = "Indica una fecha válida.";
  }

  const monto = redondearMonto(datos.monto);
  if (!Number.isFinite(monto) || monto <= 0) {
    campos.monto = "El monto del abono debe ser mayor que cero.";
  } else if (monto > saldoActual + 0.005) {
    campos.monto = `El abono no puede superar el saldo pendiente de ${saldoActual.toFixed(2)}.`;
  }

  if (Object.keys(campos).length > 0) {
    throw new ErrorValidacion("Revisa los datos del abono.", campos);
  }

  return { ...datos, monto };
}

/**
 * Fila del reporte histórico de cobro a clientes.
 *
 * Mismo espíritu que `FilaLedgerProveedor`: una fila de "apertura" con la
 * venta completa, seguida de una fila por cada abono con su propia fecha y el
 * saldo que queda después de aplicarlo, tal como se anota en el cuaderno.
 */
export interface FilaLedgerCliente {
  fecha: FechaISO;
  tipo: "apertura" | "abono";
  ventaId: ID;
  numeroFactura: string | null;
  cliente: Cliente | null;
  /** Galones de la venta; solo viene en la fila de apertura. */
  cantidad: number | null;
  /** Cargo a la cuenta: el valor de la venta, solo en la apertura. */
  cargo: number | null;
  /** Abono aplicado a la venta; solo en las filas de abono. */
  abono: number | null;
  /** Saldo de la venta después de este movimiento. */
  saldo: number;
}

/**
 * Combina las ventas con sus abonos en un solo ledger cronológico. Ver
 * `construirLedgerProveedor` en el módulo de compras: mismo razonamiento,
 * espejado para el lado del cliente.
 */
export function construirLedgerCliente(
  aperturas: readonly VentaDetalle[],
  pagos: readonly PagoCliente[],
): FilaLedgerCliente[] {
  const pagosPorVenta = new Map<ID, PagoCliente[]>();
  for (const pago of pagos) {
    const lista = pagosPorVenta.get(pago.ventaId) ?? [];
    lista.push(pago);
    pagosPorVenta.set(pago.ventaId, lista);
  }

  const filas: FilaLedgerCliente[] = [];

  for (const venta of aperturas) {
    let saldo = venta.valorTotal;

    filas.push({
      fecha: venta.fecha,
      tipo: "apertura",
      ventaId: venta.id,
      numeroFactura: venta.numeroFactura,
      cliente: venta.cliente,
      cantidad: venta.cantidad,
      cargo: venta.valorTotal,
      abono: null,
      saldo,
    });

    const pagosDeVenta = [...(pagosPorVenta.get(venta.id) ?? [])].sort((a, b) =>
      a.fecha === b.fecha
        ? a.creadoEn.localeCompare(b.creadoEn)
        : a.fecha.localeCompare(b.fecha),
    );

    for (const pago of pagosDeVenta) {
      saldo = redondearMonto(Math.max(saldo - pago.monto, 0));
      filas.push({
        fecha: pago.fecha,
        tipo: "abono",
        ventaId: venta.id,
        numeroFactura: venta.numeroFactura,
        cliente: venta.cliente,
        cantidad: null,
        cargo: null,
        abono: pago.monto,
        saldo,
      });
    }
  }

  return filas.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Totales por cliente para la pantalla de cobros. */
export interface ResumenCobroCliente {
  cliente: Cliente;
  ventas: number;
  totalFacturado: number;
  totalCobrado: number;
  saldoPendiente: number;
}

export function agruparCobrosPorCliente(
  ventas: readonly VentaDetalle[],
): ResumenCobroCliente[] {
  const porCliente = new Map<ID, ResumenCobroCliente>();

  for (const venta of ventas) {
    if (!venta.cliente) continue;

    const acumulado = porCliente.get(venta.clienteId) ?? {
      cliente: venta.cliente,
      ventas: 0,
      totalFacturado: 0,
      totalCobrado: 0,
      saldoPendiente: 0,
    };

    acumulado.ventas += 1;
    acumulado.totalFacturado += venta.valorTotal;
    acumulado.totalCobrado += venta.totalCobrado;
    acumulado.saldoPendiente += venta.saldoPendiente;
    porCliente.set(venta.clienteId, acumulado);
  }

  return [...porCliente.values()]
    .map((resumen) => ({
      ...resumen,
      totalFacturado: redondearMonto(resumen.totalFacturado),
      totalCobrado: redondearMonto(resumen.totalCobrado),
      saldoPendiente: redondearMonto(resumen.saldoPendiente),
    }))
    .sort((a, b) => b.saldoPendiente - a.saldoPendiente);
}
