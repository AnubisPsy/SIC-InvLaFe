import type { EstadoCobro, EstadoCotizacion, EstadoPago } from "@invlafe/core";
import { Insignia, type ColorInsignia } from "../ui";

const PAGO: Record<EstadoPago, { etiqueta: string; color: ColorInsignia }> = {
  pendiente: { etiqueta: "Sin abonar", color: "error" },
  parcial: { etiqueta: "Abonado", color: "advertencia" },
  pagado: { etiqueta: "Saldado", color: "exito" },
};

const COBRO: Record<EstadoCobro, { etiqueta: string; color: ColorInsignia }> = {
  pendiente: { etiqueta: "Sin cobrar", color: "error" },
  abonada: { etiqueta: "Abonada", color: "advertencia" },
  saldada: { etiqueta: "Saldada", color: "exito" },
};

const COTIZACION: Record<
  EstadoCotizacion,
  { etiqueta: string; color: ColorInsignia }
> = {
  pendiente: { etiqueta: "Pendiente", color: "advertencia" },
  aceptada: { etiqueta: "Aceptada", color: "exito" },
  rechazada: { etiqueta: "Rechazada", color: "error" },
  vencida: { etiqueta: "Vencida", color: "neutro" },
};

export function InsigniaPago({ estado }: { estado: EstadoPago }) {
  const { etiqueta, color } = PAGO[estado];
  return <Insignia color={color}>{etiqueta}</Insignia>;
}

export function InsigniaCobro({ estado }: { estado: EstadoCobro }) {
  const { etiqueta, color } = COBRO[estado];
  return <Insignia color={color}>{etiqueta}</Insignia>;
}

export function InsigniaCotizacion({ estado }: { estado: EstadoCotizacion }) {
  const { etiqueta, color } = COTIZACION[estado];
  return <Insignia color={color}>{etiqueta}</Insignia>;
}

export const ETIQUETAS_ESTADO_PAGO = PAGO;
export const ETIQUETAS_ESTADO_COTIZACION = COTIZACION;
