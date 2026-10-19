import type { ClienteApi } from "../../../infrastructure/http/cliente";
import { conFiltros, id } from "../../../infrastructure/http/consulta";
import {
  aFecha,
  aId,
  aIdOpcional,
  aNumero,
  type FilaCliente,
  type FilaCotizacion,
  type FilaCotizacionItem,
  type FilaProducto,
} from "../../../infrastructure/supabase/tablas";
import { redondearCantidad } from "../../../shared/numeros";
import type { ID } from "../../../shared/tipos";
import type {
  Cotizacion,
  CotizacionDetalle,
  DatosCotizacion,
  EstadoCotizacion,
  FiltroCotizaciones,
  LineaCotizacionDetalle,
} from "../domain/entidades";
import { normalizarEstado, subtotalDeLinea, totalCotizado } from "../domain/entidades";
import type { RepositorioCotizaciones } from "../domain/repositorios";

/**
 * Cotizaciones a través del backend. Crear y editar van en una transacción
 * del lado del servidor: nunca queda una cotización a medias.
 */

interface FilaCotizacionExpandida extends FilaCotizacion {
  cliente: FilaCliente | null;
  lineas: (FilaCotizacionItem & { producto: FilaProducto | null })[] | null;
}

function aLinea(
  fila: FilaCotizacionItem & { producto: FilaProducto | null },
): LineaCotizacionDetalle {
  const cantidad = aNumero(fila.cantidad);
  const precioUnitario = aNumero(fila.precio_unitario);

  return {
    id: aId(fila.id),
    cotizacionId: aId(fila.cotizacion_id),
    productoId: aId(fila.producto_id),
    cantidad,
    precioUnitario,
    ventaId: aIdOpcional(fila.venta_id),
    creadoEn: fila.creado_en,
    producto: fila.producto
      ? { id: aId(fila.producto.id), nombre: fila.producto.nombre }
      : null,
    subtotal: subtotalDeLinea(cantidad, precioUnitario),
  };
}

function aCotizacion(fila: FilaCotizacion): Cotizacion {
  return {
    id: aId(fila.id),
    clienteId: aId(fila.cliente_id),
    fecha: aFecha(fila.fecha),
    nota: fila.detalle,
    estado: normalizarEstado(fila.estado),
    ventaId: aIdOpcional(fila.venta_id),
    creadoEn: fila.creado_en,
  };
}

function aCotizacionDetalle(fila: FilaCotizacionExpandida): CotizacionDetalle {
  // PostgREST no garantiza el orden de un recurso embebido; se ordena por id
  // para que las líneas no bailen entre recargas.
  const lineas = (fila.lineas ?? [])
    .map(aLinea)
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  return {
    ...aCotizacion(fila),
    cliente: fila.cliente
      ? {
          id: aId(fila.cliente.id),
          nombre: fila.cliente.nombre,
          telefono: fila.cliente.telefono,
          creadoEn: fila.cliente.creado_en,
        }
      : null,
    lineas,
    total: totalCotizado(lineas),
    totalCantidad: redondearCantidad(
      lineas.reduce((total, linea) => total + linea.cantidad, 0),
    ),
  };
}

function cuerpoCotizacion(datos: DatosCotizacion) {
  return {
    clienteId: datos.clienteId,
    fecha: datos.fecha,
    nota: datos.nota,
    estado: datos.estado,
    lineas: datos.lineas.map((linea) => ({
      productoId: linea.productoId,
      cantidad: linea.cantidad,
      precioUnitario: linea.precioUnitario,
    })),
  };
}

export function crearRepositorioCotizaciones(api: ClienteApi): RepositorioCotizaciones {
  return {
    async listar(filtro: FiltroCotizaciones = {}) {
      // `estado` y `productoId` se filtran en el caso de uso, igual que antes.
      const r = await api.solicitar<{ filas: FilaCotizacionExpandida[] }>(
        conFiltros("/api/cotizaciones", {
          desde: filtro.desde,
          hasta: filtro.hasta,
          clienteId: filtro.clienteId,
        }),
        { contexto: "cargar las cotizaciones" },
      );
      return r.filas.map(aCotizacionDetalle);
    },

    async obtener(cotizacionId: ID) {
      const r = await api.solicitar<{ fila: FilaCotizacionExpandida | null }>(
        `/api/cotizaciones/${id(cotizacionId)}`,
        { contexto: "cargar la cotización" },
      );
      return r.fila ? aCotizacionDetalle(r.fila) : null;
    },

    async crear(datos: DatosCotizacion) {
      const r = await api.solicitar<{ fila: FilaCotizacion }>("/api/cotizaciones", {
        metodo: "POST",
        contexto: "crear la cotización",
        cuerpo: cuerpoCotizacion(datos),
      });
      return aCotizacion(r.fila);
    },

    async actualizar(cotizacionId: ID, datos: DatosCotizacion) {
      const r = await api.solicitar<{ fila: FilaCotizacion }>(`/api/cotizaciones/${id(cotizacionId)}`, {
        metodo: "PUT",
        contexto: "actualizar la cotización",
        cuerpo: cuerpoCotizacion(datos),
      });
      return aCotizacion(r.fila);
    },

    async cambiarEstado(cotizacionId: ID, estado: EstadoCotizacion) {
      const r = await api.solicitar<{ fila: FilaCotizacion }>(
        `/api/cotizaciones/${id(cotizacionId)}/estado`,
        { metodo: "PATCH", contexto: "cambiar el estado de la cotización", cuerpo: { estado } },
      );
      return aCotizacion(r.fila);
    },

    async enlazarVenta(cotizacionId: ID, ventaId: ID) {
      const r = await api.solicitar<{ fila: FilaCotizacion }>(
        `/api/cotizaciones/${id(cotizacionId)}/venta`,
        { metodo: "PATCH", contexto: "enlazar la cotización con la venta", cuerpo: { ventaId } },
      );
      return aCotizacion(r.fila);
    },

    async enlazarVentaDeLinea(lineaId: ID, ventaId: ID) {
      await api.solicitar<void>(`/api/cotizaciones/lineas/${id(lineaId)}/venta`, {
        metodo: "PATCH",
        contexto: "enlazar la línea con su venta",
        cuerpo: { ventaId },
      });
    },

    async eliminar(cotizacionId: ID) {
      await api.solicitar<void>(`/api/cotizaciones/${id(cotizacionId)}`, {
        metodo: "DELETE",
        contexto: "eliminar la cotización",
      });
    },
  };
}
