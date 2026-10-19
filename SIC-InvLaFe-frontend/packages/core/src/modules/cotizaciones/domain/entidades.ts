import { ErrorValidacion } from "../../../shared/errores";
import { esFechaISOValida } from "../../../shared/fechas";
import { redondearCantidad, redondearMonto, sumarMontos } from "../../../shared/numeros";
import { normalizar, textoONulo } from "../../../shared/texto";
import type { FechaHoraISO, FechaISO, ID, RangoFechas } from "../../../shared/tipos";
import type { Cliente, Producto } from "../../catalogos/domain/entidades";

export const ESTADOS_COTIZACION = {
  PENDIENTE: "pendiente",
  ACEPTADA: "aceptada",
  RECHAZADA: "rechazada",
  VENCIDA: "vencida",
} as const;

export type EstadoCotizacion =
  (typeof ESTADOS_COTIZACION)[keyof typeof ESTADOS_COTIZACION];

export const ESTADOS_COTIZACION_LISTA: readonly EstadoCotizacion[] = [
  ESTADOS_COTIZACION.PENDIENTE,
  ESTADOS_COTIZACION.ACEPTADA,
  ESTADOS_COTIZACION.RECHAZADA,
  ESTADOS_COTIZACION.VENCIDA,
];

/** Tope de líneas por cotización: no es una regla del negocio, es una guarda del formulario. */
export const MAXIMO_LINEAS_COTIZACION = 30;

/**
 * `cotizaciones.estado` es texto libre en la base. Se normaliza al leer para
 * que un `"Aceptada"` o `"ACEPTADO"` heredado no rompa la UI.
 */
export function normalizarEstado(valor: string | null | undefined): EstadoCotizacion {
  const clave = normalizar(valor);
  switch (clave) {
    case "aceptada":
    case "aceptado":
    case "aprobada":
    case "aprobado":
      return ESTADOS_COTIZACION.ACEPTADA;
    case "rechazada":
    case "rechazado":
    case "cancelada":
    case "cancelado":
      return ESTADOS_COTIZACION.RECHAZADA;
    case "vencida":
    case "vencido":
    case "expirada":
      return ESTADOS_COTIZACION.VENCIDA;
    default:
      return ESTADOS_COTIZACION.PENDIENTE;
  }
}

export interface Cotizacion {
  id: ID;
  clienteId: ID;
  fecha: FechaISO;
  /** Condiciones de entrega, plazos… lo que no cabe en una línea. */
  nota: string | null;
  estado: EstadoCotizacion;
  /**
   * Primera venta generada al convertir. Se conserva porque es la marca de
   * «esta cotización ya se facturó»; el enlace fino está en cada línea.
   */
  ventaId: ID | null;
  creadoEn: FechaHoraISO;
}

/** Un producto cotizado, con la cantidad y el precio ofertados. */
export interface LineaCotizacion {
  id: ID;
  cotizacionId: ID;
  productoId: ID;
  cantidad: number;
  precioUnitario: number;
  /** La venta que salió de esta línea al convertir la cotización. */
  ventaId: ID | null;
  creadoEn: FechaHoraISO;
}

export interface LineaCotizacionDetalle extends LineaCotizacion {
  producto: Producto | null;
  subtotal: number;
}

export interface CotizacionDetalle extends Cotizacion {
  cliente: Cliente | null;
  lineas: LineaCotizacionDetalle[];
  /** Suma de los subtotales de las líneas. */
  total: number;
  totalCantidad: number;
}

/** Lo que el formulario envía por línea; sin ids, porque se reemplazan enteras. */
export interface LineaCotizacionEntrada {
  productoId: ID;
  cantidad: number;
  precioUnitario: number;
}

export interface DatosCotizacion {
  clienteId: ID;
  fecha: FechaISO;
  nota: string | null;
  estado: EstadoCotizacion;
  lineas: LineaCotizacionEntrada[];
}

export interface FiltroCotizaciones extends RangoFechas {
  clienteId?: ID;
  estado?: EstadoCotizacion;
  productoId?: ID;
  busqueda?: string;
}

/** Una línea cotizada, resuelta contra el lote del que va a salir. */
export interface LineaConversion {
  lineaId: ID;
  loteCompraId: ID;
  cantidad: number;
  precioUnitario: number;
}

export interface DatosConversion {
  fecha: FechaISO;
  numeroFactura: string | null;
  lineas: LineaConversion[];
}

// --- Reglas ------------------------------------------------------------------

/** Una cotización ya convertida en venta queda congelada: no se edita ni se borra. */
export function estaConvertida(cotizacion: Cotizacion): boolean {
  return cotizacion.ventaId !== null;
}

export function puedeEditarse(cotizacion: Cotizacion): boolean {
  return !estaConvertida(cotizacion);
}

/** Solo se convierte lo que el cliente aceptó, aún no se facturó y tiene líneas. */
export function puedeConvertirseEnVenta(cotizacion: CotizacionDetalle): boolean {
  return (
    cotizacion.estado === ESTADOS_COTIZACION.ACEPTADA &&
    !estaConvertida(cotizacion) &&
    cotizacion.lineas.length > 0
  );
}

export function subtotalDeLinea(cantidad: number, precio: number): number {
  return redondearMonto(cantidad * precio);
}

export function totalCotizado(
  lineas: readonly { cantidad: number; precioUnitario: number }[],
): number {
  return sumarMontos(
    lineas.map((linea) => subtotalDeLinea(linea.cantidad, linea.precioUnitario)),
  );
}

/**
 * Los errores de cada línea se devuelven con la clave `lineas.<índice>.<campo>`
 * para que el formulario pueda pintarlos en la fila que les toca.
 */
export function validarCotizacion(datos: DatosCotizacion): DatosCotizacion {
  const campos: Record<string, string> = {};

  if (!datos.clienteId) campos.clienteId = "Selecciona el cliente.";

  if (!datos.fecha || !esFechaISOValida(datos.fecha)) {
    campos.fecha = "Indica una fecha válida.";
  }

  if (!ESTADOS_COTIZACION_LISTA.includes(datos.estado)) {
    campos.estado = "Selecciona un estado válido.";
  }

  const nota = datos.nota?.trim() ?? "";
  if (nota.length > 2000) {
    campos.nota = "La nota no puede pasar de 2000 caracteres.";
  }

  const lineas = datos.lineas ?? [];
  if (lineas.length === 0) {
    campos.lineas = "Añade al menos un producto a la cotización.";
  } else if (lineas.length > MAXIMO_LINEAS_COTIZACION) {
    campos.lineas = `Una cotización no puede pasar de ${MAXIMO_LINEAS_COTIZACION} líneas.`;
  }

  const productosVistos = new Set<ID>();

  lineas.forEach((linea, indice) => {
    if (!linea.productoId) {
      campos[`lineas.${indice}.productoId`] = "Selecciona el producto.";
    } else if (productosVistos.has(linea.productoId)) {
      campos[`lineas.${indice}.productoId`] =
        "Este producto ya está en otra línea. Súmalo ahí.";
    } else {
      productosVistos.add(linea.productoId);
    }

    if (!Number.isFinite(linea.cantidad) || linea.cantidad <= 0) {
      campos[`lineas.${indice}.cantidad`] = "La cantidad debe ser mayor que cero.";
    }

    if (!Number.isFinite(linea.precioUnitario) || linea.precioUnitario <= 0) {
      campos[`lineas.${indice}.precioUnitario`] =
        "El precio unitario debe ser mayor que cero.";
    }
  });

  if (Object.keys(campos).length > 0) {
    throw new ErrorValidacion("Revisa los datos de la cotización.", campos);
  }

  return {
    ...datos,
    nota: textoONulo(nota),
    lineas: lineas.map((linea) => ({
      productoId: linea.productoId,
      cantidad: redondearCantidad(linea.cantidad),
      precioUnitario: redondearMonto(linea.precioUnitario),
    })),
  };
}

/**
 * Cada línea cotizada tiene que decir de qué lote sale antes de convertirse.
 *
 * Se valida aquí y no línea a línea al vuelo porque la conversión es todo o
 * nada: descubrir a mitad de camino que la tercera línea no tiene lote dejaría
 * dos ventas ya emitidas que habría que anular.
 */
export function validarConversion(
  datos: DatosConversion,
  lineasCotizadas: readonly LineaCotizacion[],
): DatosConversion {
  const campos: Record<string, string> = {};

  if (!datos.fecha || !esFechaISOValida(datos.fecha)) {
    campos.fecha = "Indica una fecha válida.";
  }

  if (lineasCotizadas.length === 0) {
    campos.lineas = "La cotización no tiene productos que facturar.";
  }

  const porId = new Map(datos.lineas.map((linea) => [linea.lineaId, linea]));

  lineasCotizadas.forEach((cotizada, indice) => {
    const conversion = porId.get(cotizada.id);

    if (!conversion) {
      campos[`lineas.${indice}.loteCompraId`] =
        "Falta indicar de qué lote sale este producto.";
      return;
    }

    if (!conversion.loteCompraId) {
      campos[`lineas.${indice}.loteCompraId`] = "Selecciona el lote de origen.";
    }

    if (!Number.isFinite(conversion.cantidad) || conversion.cantidad <= 0) {
      campos[`lineas.${indice}.cantidad`] = "La cantidad debe ser mayor que cero.";
    }

    if (!Number.isFinite(conversion.precioUnitario) || conversion.precioUnitario <= 0) {
      campos[`lineas.${indice}.precioUnitario`] =
        "El precio unitario debe ser mayor que cero.";
    }
  });

  if (Object.keys(campos).length > 0) {
    throw new ErrorValidacion("Revisa los datos de la conversión.", campos);
  }

  return {
    ...datos,
    numeroFactura: textoONulo(datos.numeroFactura),
    lineas: datos.lineas.map((linea) => ({
      ...linea,
      cantidad: redondearCantidad(linea.cantidad),
      precioUnitario: redondearMonto(linea.precioUnitario),
    })),
  };
}
