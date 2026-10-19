import { ErrorValidacion } from "../../../shared/errores";
import { esFechaISOValida } from "../../../shared/fechas";
import {
  esCero,
  redondearCantidad,
  redondearMonto,
  sumarMontos,
} from "../../../shared/numeros";
import { textoONulo } from "../../../shared/texto";
import type { FechaHoraISO, FechaISO, ID, RangoFechas } from "../../../shared/tipos";
import type { Producto, Proveedor } from "../../catalogos/domain/entidades";

/**
 * Una compra es una factura del proveedor. Lleva dentro una o varias líneas,
 * porque en la práctica un mismo viaje trae diésel, regular y aceite.
 *
 * El importe no se deriva de las líneas: `valorFactura` es lo que el proveedor
 * cobra de verdad, y puede diferir de la suma por redondeos, descuentos o un
 * flete que la factura reparte pero el detalle no.
 */
export interface Compra {
  id: ID;
  proveedorId: ID;
  fecha: FechaISO;
  numeroFactura: string | null;
  valorFactura: number;
  creadoEn: FechaHoraISO;
}

/**
 * Línea de una compra, y unidad de inventario: es lo único de lo que pueden
 * salir ventas. `cantidadDisponible` es su saldo físico y solo lo mueve el
 * registro de ventas.
 *
 * Arrastra `fecha`, `numeroFactura` y `proveedorId` de su cabecera para que
 * quien solo mira inventario —el cuadre, el selector de ventas— no tenga que
 * cargar la compra entera.
 */
export interface LoteCompra {
  id: ID;
  compraId: ID;
  productoId: ID;
  cantidadComprada: number;
  precioUnitario: number;
  cantidadDisponible: number;
  creadoEn: FechaHoraISO;

  proveedorId: ID;
  fecha: FechaISO;
  numeroFactura: string | null;
}

/** Abono parcial al proveedor sobre una factura. */
export interface PagoProveedor {
  id: ID;
  compraId: ID;
  fecha: FechaISO;
  monto: number;
  creadoEn: FechaHoraISO;
}

export type EstadoPago = "pendiente" | "parcial" | "pagado";

/** Línea con proveedor y producto resueltos, lista para pintar. */
export interface LoteCompraDetalle extends LoteCompra {
  proveedor: Proveedor | null;
  producto: Producto | null;
  /** Derivada: cantidad comprada menos la disponible. */
  cantidadDespachada: number;
  /** Derivada: cantidad × precio. Lo que aporta la línea al total. */
  valorLinea: number;
}

/**
 * Compra con todo lo que la pantalla necesita mostrar. El saldo no está en la
 * base: se deriva de `valorFactura` menos la suma de sus abonos, tal como pide
 * la regla del negocio.
 */
export interface CompraDetalle extends Compra {
  proveedor: Proveedor | null;
  lineas: LoteCompraDetalle[];
  totalPagado: number;
  saldoPendiente: number;
  estadoPago: EstadoPago;
  /** Suma de las líneas; se compara con `valorFactura` para avisar de desajustes. */
  totalLineas: number;
  totalComprado: number;
  totalDisponible: number;
}

export interface NuevaLineaCompra {
  productoId: ID;
  cantidadComprada: number;
  precioUnitario: number;
}

export interface NuevaCompra {
  proveedorId: ID;
  fecha: FechaISO;
  numeroFactura: string | null;
  valorFactura: number;
  lineas: NuevaLineaCompra[];
}

export interface NuevoPagoProveedor {
  compraId: ID;
  fecha: FechaISO;
  monto: number;
}

/**
 * Filtro de listado de compras.
 *
 * Los campos que Postgres puede resolver (`desde`, `hasta`, `proveedorId`,
 * `productoIds`, `limite`) los aplica el repositorio. Los derivados
 * (`soloProducto`, `estadoPago`, `busqueda`) los resuelve el caso de uso sobre
 * el resultado, porque dependen de datos calculados que no existen como columna.
 */
export interface FiltroCompras extends RangoFechas {
  proveedorId?: ID;
  productoId?: ID;
  /** Resuelto por el caso de uso a partir de `soloProducto`. */
  productoIds?: ID[];
  /** Filtra por la clave de negocio del producto; lo usa "Control de aceite". */
  soloProducto?: "aceite" | "combustible";
  estadoPago?: EstadoPago;
  busqueda?: string;
  limite?: number;
}

/**
 * Filtro de líneas de inventario, para el cuadre y el selector de ventas.
 *
 * Es distinto de `FiltroCompras` porque aquí la unidad es la línea: filtrar
 * por producto significa quedarse con las líneas de ese producto, no con las
 * facturas que lo contienen.
 */
export interface FiltroLotes extends RangoFechas {
  proveedorId?: ID;
  productoId?: ID;
  productoIds?: ID[];
  soloProducto?: "aceite" | "combustible";
  /** Solo líneas con existencia > 0, para el selector de ventas. */
  soloDisponibles?: boolean;
  busqueda?: string;
  limite?: number;
}

/** Tope de filas por consulta, para que un listado sin filtros no traiga la tabla entera. */
export const LIMITE_LOTES_POR_DEFECTO = 500;

/** Tope de líneas por compra: no es un límite del negocio, es una guarda del formulario. */
export const MAXIMO_LINEAS_COMPRA = 30;

// --- Reglas ------------------------------------------------------------------

/** Valor de factura que se propone en el formulario antes de que el usuario lo ajuste. */
export function valorFacturaSugerido(lineas: readonly NuevaLineaCompra[]): number {
  return sumarMontos(
    lineas.map((linea) => linea.cantidadComprada * linea.precioUnitario),
  );
}

export function valorDeLinea(cantidad: number, precio: number): number {
  return redondearMonto(cantidad * precio);
}

export function saldoDeCompra(valorFactura: number, totalPagado: number): number {
  return redondearMonto(Math.max(valorFactura - totalPagado, 0));
}

export function estadoDePago(valorFactura: number, totalPagado: number): EstadoPago {
  if (esCero(totalPagado)) return "pendiente";
  if (totalPagado >= valorFactura - 0.005) return "pagado";
  return "parcial";
}

/** Cantidad ya despachada de la línea a través de ventas. */
export function cantidadDespachada(lote: LoteCompra): number {
  return redondearCantidad(Math.max(lote.cantidadComprada - lote.cantidadDisponible, 0));
}

/** Porcentaje de la línea consumido, para las barras de progreso del cuadre. */
export function porcentajeConsumido(lote: LoteCompra): number {
  if (lote.cantidadComprada <= 0) return 0;
  return Math.min(100, (cantidadDespachada(lote) / lote.cantidadComprada) * 100);
}

export function loteAgotado(lote: LoteCompra): boolean {
  return lote.cantidadDisponible <= 0.0001;
}

/**
 * Una compra sin líneas no existe: sería una factura de nada. Los errores de
 * cada línea se devuelven con la clave `lineas.<índice>.<campo>` para que el
 * formulario pueda pintarlos en la fila que les toca.
 */
export function validarNuevaCompra(datos: NuevaCompra): NuevaCompra {
  const campos: Record<string, string> = {};

  if (!datos.proveedorId) campos.proveedorId = "Selecciona el proveedor.";

  if (!datos.fecha || !esFechaISOValida(datos.fecha)) {
    campos.fecha = "Indica una fecha válida.";
  }

  const lineas = datos.lineas ?? [];
  if (lineas.length === 0) {
    campos.lineas = "Añade al menos un producto a la compra.";
  } else if (lineas.length > MAXIMO_LINEAS_COMPRA) {
    campos.lineas = `Una compra no puede pasar de ${MAXIMO_LINEAS_COMPRA} líneas.`;
  }

  const productosVistos = new Set<ID>();

  lineas.forEach((linea, indice) => {
    if (!linea.productoId) {
      campos[`lineas.${indice}.productoId`] = "Selecciona el producto.";
    } else if (productosVistos.has(linea.productoId)) {
      // Dos líneas del mismo producto darían dos lotes que compiten por la
      // misma existencia y confundirían el cuadre. Se suman en una.
      campos[`lineas.${indice}.productoId`] =
        "Este producto ya está en otra línea. Súmalo ahí.";
    } else {
      productosVistos.add(linea.productoId);
    }

    if (!Number.isFinite(linea.cantidadComprada) || linea.cantidadComprada <= 0) {
      campos[`lineas.${indice}.cantidadComprada`] =
        "La cantidad debe ser mayor que cero.";
    }

    if (!Number.isFinite(linea.precioUnitario) || linea.precioUnitario <= 0) {
      campos[`lineas.${indice}.precioUnitario`] =
        "El precio unitario debe ser mayor que cero.";
    }
  });

  if (!Number.isFinite(datos.valorFactura) || datos.valorFactura <= 0) {
    campos.valorFactura = "El valor de la factura debe ser mayor que cero.";
  }

  if (Object.keys(campos).length > 0) {
    throw new ErrorValidacion("Revisa los datos de la compra.", campos);
  }

  return {
    ...datos,
    numeroFactura: textoONulo(datos.numeroFactura),
    valorFactura: redondearMonto(datos.valorFactura),
    lineas: lineas.map((linea) => ({
      productoId: linea.productoId,
      cantidadComprada: redondearCantidad(linea.cantidadComprada),
      precioUnitario: redondearMonto(linea.precioUnitario),
    })),
  };
}

/**
 * Fila del reporte histórico de pago a proveedor (y de Control de aceite, que
 * es el mismo ledger filtrado a un producto).
 *
 * Reproduce cómo se anota en el cuaderno físico: una fila de "apertura" con la
 * factura completa, seguida de una fila por cada abono con su propia fecha,
 * cada una con el saldo que queda después de ese movimiento.
 */
export interface FilaLedgerProveedor {
  fecha: FechaISO;
  tipo: "apertura" | "abono";
  compraId: ID;
  numeroFactura: string | null;
  proveedor: Proveedor | null;
  /** Cantidad total de la factura; solo viene en la fila de apertura. */
  cantidad: number | null;
  /** Precio implícito (valorFactura ÷ cantidad); solo en la apertura. */
  precioUnitario: number | null;
  /** Cargo a la cuenta: el valor de la factura, solo en la apertura. */
  cargo: number | null;
  /** Abono aplicado a la factura; solo en las filas de abono. */
  abono: number | null;
  /** Saldo de la factura después de este movimiento. */
  saldo: number;
}

/**
 * Combina las facturas con sus abonos en un solo ledger cronológico.
 *
 * `aperturas` puede traer facturas fuera del rango de fechas que se está
 * reportando (se necesitan para saber el saldo de arrastre de un abono que sí
 * cae en el rango); el saldo se calcula igual, y luego el caso de uso decide
 * qué filas mostrar.
 */
export function construirLedgerProveedor(
  aperturas: readonly CompraDetalle[],
  pagos: readonly PagoProveedor[],
): FilaLedgerProveedor[] {
  const pagosPorCompra = new Map<ID, PagoProveedor[]>();
  for (const pago of pagos) {
    const lista = pagosPorCompra.get(pago.compraId) ?? [];
    lista.push(pago);
    pagosPorCompra.set(pago.compraId, lista);
  }

  const filas: FilaLedgerProveedor[] = [];

  for (const compra of aperturas) {
    const cantidad = redondearCantidad(
      compra.lineas.reduce((total, linea) => total + linea.cantidadComprada, 0),
    );
    let saldo = compra.valorFactura;

    filas.push({
      fecha: compra.fecha,
      tipo: "apertura",
      compraId: compra.id,
      numeroFactura: compra.numeroFactura,
      proveedor: compra.proveedor,
      cantidad,
      precioUnitario:
        cantidad > 0 ? redondearMonto(compra.valorFactura / cantidad) : null,
      cargo: compra.valorFactura,
      abono: null,
      saldo,
    });

    const pagosDeCompra = [...(pagosPorCompra.get(compra.id) ?? [])].sort((a, b) =>
      a.fecha === b.fecha
        ? a.creadoEn.localeCompare(b.creadoEn)
        : a.fecha.localeCompare(b.fecha),
    );

    for (const pago of pagosDeCompra) {
      saldo = redondearMonto(Math.max(saldo - pago.monto, 0));
      filas.push({
        fecha: pago.fecha,
        tipo: "abono",
        compraId: compra.id,
        numeroFactura: compra.numeroFactura,
        proveedor: compra.proveedor,
        cantidad: null,
        precioUnitario: null,
        cargo: null,
        abono: pago.monto,
        saldo,
      });
    }
  }

  return filas.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * Un abono nunca puede exceder el saldo de la factura: si lo permitiéramos, el
 * proveedor quedaría con saldo negativo y el cuadre dejaría de cerrar.
 */
export function validarAbonoProveedor(
  datos: NuevoPagoProveedor,
  saldoActual: number,
): NuevoPagoProveedor {
  const campos: Record<string, string> = {};

  if (!datos.compraId) campos.compraId = "Selecciona la compra.";

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
