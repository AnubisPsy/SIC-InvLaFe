import type { ClienteApi } from "../../../infrastructure/http/cliente";
import { conFiltros, id } from "../../../infrastructure/http/consulta";
import {
  aFecha,
  aId,
  aNumero,
  type FilaCliente,
  type FilaPagoCliente,
  type FilaVenta,
} from "../../../infrastructure/supabase/tablas";
import type { ID } from "../../../shared/tipos";
import {
  aLoteDetalleDesdeLinea,
  type FilaLoteExpandida,
} from "../../compras/infrastructure/repositorios.http";
import type {
  FiltroVentas,
  NuevaVenta,
  NuevoPagoCliente,
  PagoCliente,
  Venta,
  VentaDetalle,
} from "../domain/entidades";
import {
  LIMITE_VENTAS_POR_DEFECTO,
  estadoDeCobro,
  totalCobrado,
} from "../domain/entidades";
import type {
  RepositorioPagosCliente,
  RepositorioVentas,
} from "../domain/repositorios";

/**
 * Ventas y cobros a clientes a través del backend. Igual que en compras, las
 * filas llegan con la forma de Supabase y se convierten con las mismas
 * funciones de antes.
 */

interface FilaVentaExpandida extends FilaVenta {
  cliente: FilaCliente | null;
  lote: FilaLoteExpandida | null;
}

function aVenta(fila: FilaVenta): Venta {
  return {
    id: aId(fila.id),
    loteCompraId: aId(fila.lote_compra_id),
    clienteId: aId(fila.cliente_id),
    fecha: aFecha(fila.fecha),
    numeroFactura: fila.numero_factura,
    cantidad: aNumero(fila.cantidad),
    precioUnitario: aNumero(fila.precio_unitario),
    valorTotal: aNumero(fila.valor_total),
    saldoPendiente: aNumero(fila.saldo_pendiente),
    detalle: fila.detalle,
    creadoEn: fila.creado_en,
  };
}

function aVentaDetalle(fila: FilaVentaExpandida): VentaDetalle {
  const venta = aVenta(fila);

  return {
    ...venta,
    cliente: fila.cliente
      ? {
          id: aId(fila.cliente.id),
          nombre: fila.cliente.nombre,
          telefono: fila.cliente.telefono,
          creadoEn: fila.cliente.creado_en,
        }
      : null,
    lote: fila.lote ? aLoteDetalleDesdeLinea(fila.lote) : null,
    totalCobrado: totalCobrado(venta),
    estadoCobro: estadoDeCobro(venta.valorTotal, venta.saldoPendiente),
  };
}

const aPagoCliente = (fila: FilaPagoCliente): PagoCliente => ({
  id: aId(fila.id),
  ventaId: aId(fila.venta_id),
  fecha: aFecha(fila.fecha),
  monto: aNumero(fila.monto),
  creadoEn: fila.creado_en,
});

export function crearRepositorioVentas(api: ClienteApi): RepositorioVentas {
  async function porLotes(loteCompraIds: readonly ID[], contexto: string) {
    if (loteCompraIds.length === 0) return [];
    const r = await api.solicitar<{ filas: FilaVentaExpandida[] }>("/api/ventas/por-lotes", {
      metodo: "POST",
      contexto,
      cuerpo: { loteCompraIds },
    });
    return r.filas.map(aVentaDetalle);
  }

  return {
    async listar(filtro: FiltroVentas = {}) {
      const r = await api.solicitar<{ filas: FilaVentaExpandida[] }>(
        conFiltros("/api/ventas", {
          desde: filtro.desde,
          hasta: filtro.hasta,
          clienteId: filtro.clienteId,
          loteCompraId: filtro.loteCompraId,
          soloConSaldo: filtro.soloConSaldo,
          limite: filtro.limite ?? LIMITE_VENTAS_POR_DEFECTO,
        }),
        { contexto: "cargar las ventas" },
      );
      return r.filas.map(aVentaDetalle);
    },

    listarPorLote: (loteCompraId: ID) => porLotes([loteCompraId], "cargar las ventas del lote"),

    listarPorLotes: (loteCompraIds: readonly ID[]) =>
      porLotes(loteCompraIds, "cargar las ventas de los lotes"),

    async obtener(ventaId: ID) {
      const r = await api.solicitar<{ fila: FilaVentaExpandida | null }>(`/api/ventas/${id(ventaId)}`, {
        contexto: "cargar la venta",
      });
      return r.fila ? aVentaDetalle(r.fila) : null;
    },

    async crear(datos: NuevaVenta, valorTotal: number) {
      const r = await api.solicitar<{ fila: FilaVenta }>("/api/ventas", {
        metodo: "POST",
        contexto: "registrar la venta",
        cuerpo: {
          loteCompraId: datos.loteCompraId,
          clienteId: datos.clienteId,
          fecha: datos.fecha,
          numeroFactura: datos.numeroFactura,
          cantidad: datos.cantidad,
          precioUnitario: datos.precioUnitario,
          valorTotal,
          detalle: datos.detalle ?? null,
        },
      });
      return aVenta(r.fila);
    },

    async eliminar(ventaId: ID) {
      await api.solicitar<void>(`/api/ventas/${id(ventaId)}`, {
        metodo: "DELETE",
        contexto: "eliminar la venta",
      });
    },

    /** Mismo bloqueo optimista que el descuento de existencia del lote. */
    async descontarSaldo(ventaId, monto, saldoEsperado) {
      const r = await api.solicitar<{ fila: FilaVenta | null }>(
        `/api/ventas/${id(ventaId)}/descontar-saldo`,
        {
          metodo: "POST",
          contexto: "actualizar el saldo de la venta",
          cuerpo: { monto, saldoEsperado },
        },
      );
      return r.fila ? aVenta(r.fila) : null;
    },

    async restituirSaldo(ventaId, monto) {
      await api.solicitar<void>(`/api/ventas/${id(ventaId)}/restituir-saldo`, {
        metodo: "POST",
        contexto: "restituir el saldo de la venta",
        cuerpo: { monto },
      });
    },
  };
}

export function crearRepositorioPagosCliente(api: ClienteApi): RepositorioPagosCliente {
  return {
    async listarPorVenta(ventaId: ID) {
      const r = await api.solicitar<{ filas: FilaPagoCliente[] }>(`/api/ventas/${id(ventaId)}/pagos`, {
        contexto: "cargar los abonos de la venta",
      });
      return r.filas.map(aPagoCliente);
    },

    async listarEnRango(filtro) {
      if (filtro.ventaIds && filtro.ventaIds.length === 0) return [];

      const r = await api.solicitar<{ filas: FilaPagoCliente[] }>("/api/pagos-cliente/consulta-rango", {
        metodo: "POST",
        contexto: "cargar los abonos del periodo",
        cuerpo: { desde: filtro.desde, hasta: filtro.hasta, ventaIds: filtro.ventaIds },
      });
      return r.filas.map(aPagoCliente);
    },

    async crear(datos: NuevoPagoCliente) {
      const r = await api.solicitar<{ fila: FilaPagoCliente }>("/api/pagos-cliente", {
        metodo: "POST",
        contexto: "registrar el abono del cliente",
        cuerpo: { ventaId: datos.ventaId, fecha: datos.fecha, monto: datos.monto },
      });
      return aPagoCliente(r.fila);
    },

    async eliminar(pagoId: ID) {
      await api.solicitar<void>(`/api/pagos-cliente/${id(pagoId)}`, {
        metodo: "DELETE",
        contexto: "eliminar el abono",
      });
    },
  };
}
