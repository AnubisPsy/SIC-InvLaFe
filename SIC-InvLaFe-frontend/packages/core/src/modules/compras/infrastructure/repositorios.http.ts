import type { ClienteApi } from "../../../infrastructure/http/cliente";
import { conFiltros, id } from "../../../infrastructure/http/consulta";
import {
  aFecha,
  aId,
  aNumero,
  type FilaCompra,
  type FilaLoteCompra,
  type FilaPagoProveedor,
  type FilaProducto,
  type FilaProveedor,
} from "../../../infrastructure/http/filas";
import { redondearCantidad, sumarMontos } from "../../../shared/numeros";
import type { ID } from "../../../shared/tipos";
import type { Proveedor } from "../../catalogos/domain/entidades";
import type {
  Compra,
  CompraDetalle,
  FiltroCompras,
  FiltroLotes,
  LoteCompra,
  LoteCompraDetalle,
  NuevaCompra,
  NuevoPagoProveedor,
  PagoProveedor,
} from "../domain/entidades";
import {
  LIMITE_LOTES_POR_DEFECTO,
  cantidadDespachada,
  estadoDePago,
  saldoDeCompra,
  valorDeLinea,
} from "../domain/entidades";
import type {
  RepositorioCompras,
  RepositorioLotes,
  RepositorioPagosProveedor,
} from "../domain/repositorios";

/**
 * Compras, lotes y pagos a proveedores a través del backend.
 *
 * El backend devuelve las filas en snake_case y con las relaciones anidadas,
 * así que las funciones de conversión de abajo son las mismas de antes: los saldos y estados se siguen calculando
 * aquí, con las reglas del dominio.
 */

interface FilaCompraExpandida extends FilaCompra {
  proveedor: FilaProveedor | null;
  lineas: (FilaLoteCompra & { producto: FilaProducto | null })[] | null;
  pagos: { monto: number | string }[] | null;
}

interface FilaLoteExpandida extends FilaLoteCompra {
  producto: FilaProducto | null;
  compra: (FilaCompra & { proveedor: FilaProveedor | null }) | null;
}

const aProveedor = (fila: FilaProveedor): Proveedor => ({
  id: aId(fila.id),
  nombre: fila.nombre,
  telefono: fila.telefono,
  creadoEn: fila.creado_en,
});

function aCompra(fila: FilaCompra): Compra {
  return {
    id: aId(fila.id),
    proveedorId: aId(fila.proveedor_id),
    fecha: aFecha(fila.fecha),
    numeroFactura: fila.numero_factura,
    valorFactura: aNumero(fila.valor_factura),
    creadoEn: fila.creado_en,
  };
}

/**
 * Compone la línea con los datos de su cabecera.
 *
 * `fecha`, `numeroFactura` y `proveedorId` se copian aquí en vez de obligar a
 * cada consumidor a navegar hasta la compra: para el inventario, la línea es
 * la entidad completa.
 */
function aLoteDetalle(
  fila: FilaLoteCompra & { producto: FilaProducto | null },
  cabecera: Compra,
  proveedor: Proveedor | null,
): LoteCompraDetalle {
  const cantidadComprada = aNumero(fila.cantidad_comprada);
  const precioUnitario = aNumero(fila.precio_unitario);

  const lote: LoteCompra = {
    id: aId(fila.id),
    compraId: aId(fila.compra_id),
    productoId: aId(fila.producto_id),
    cantidadComprada,
    precioUnitario,
    cantidadDisponible: aNumero(fila.cantidad_disponible),
    creadoEn: fila.creado_en,
    proveedorId: cabecera.proveedorId,
    fecha: cabecera.fecha,
    numeroFactura: cabecera.numeroFactura,
  };

  return {
    ...lote,
    proveedor,
    producto: fila.producto
      ? { id: aId(fila.producto.id), nombre: fila.producto.nombre }
      : null,
    cantidadDespachada: cantidadDespachada(lote),
    valorLinea: valorDeLinea(cantidadComprada, precioUnitario),
  };
}

/** Mapper de la consulta que arranca en la línea, no en la cabecera. */
function aLoteDetalleDesdeLinea(fila: FilaLoteExpandida): LoteCompraDetalle {
  const proveedor = fila.compra?.proveedor ? aProveedor(fila.compra.proveedor) : null;
  const cabecera: Compra = fila.compra
    ? aCompra(fila.compra)
    : {
        // Defensivo: `!inner` garantiza la cabecera, pero un lote huérfano de
        // una migración a medias no debería reventar la pantalla entera.
        id: aId(fila.compra_id),
        proveedorId: "",
        fecha: "",
        numeroFactura: null,
        valorFactura: 0,
        creadoEn: fila.creado_en,
      };

  return aLoteDetalle(fila, cabecera, proveedor);
}

function aCompraDetalle(fila: FilaCompraExpandida): CompraDetalle {
  const compra = aCompra(fila);
  const proveedor = fila.proveedor ? aProveedor(fila.proveedor) : null;
  const lineas = (fila.lineas ?? []).map((linea) =>
    aLoteDetalle(linea, compra, proveedor),
  );
  const totalPagado = sumarMontos((fila.pagos ?? []).map((pago) => aNumero(pago.monto)));

  return {
    ...compra,
    proveedor,
    lineas,
    totalPagado,
    saldoPendiente: saldoDeCompra(compra.valorFactura, totalPagado),
    estadoPago: estadoDePago(compra.valorFactura, totalPagado),
    totalLineas: sumarMontos(lineas.map((linea) => linea.valorLinea)),
    totalComprado: redondearCantidad(
      lineas.reduce((total, linea) => total + linea.cantidadComprada, 0),
    ),
    totalDisponible: redondearCantidad(
      lineas.reduce((total, linea) => total + linea.cantidadDisponible, 0),
    ),
  };
}

const aPagoProveedor = (fila: FilaPagoProveedor): PagoProveedor => ({
  id: aId(fila.id),
  compraId: aId(fila.compra_id),
  fecha: aFecha(fila.fecha),
  monto: aNumero(fila.monto),
  creadoEn: fila.creado_en,
});

export function crearRepositorioCompras(api: ClienteApi): RepositorioCompras {
  return {
    async listar(filtro: FiltroCompras = {}) {
      // El filtro por producto no se aplica en el servidor: mira dentro de las
      // líneas y recortaría la factura. Lo resuelve el caso de uso.
      const r = await api.solicitar<{ filas: FilaCompraExpandida[] }>(
        conFiltros("/api/compras", {
          desde: filtro.desde,
          hasta: filtro.hasta,
          proveedorId: filtro.proveedorId,
          limite: filtro.limite ?? LIMITE_LOTES_POR_DEFECTO,
        }),
        { contexto: "cargar las compras" },
      );
      return r.filas.map(aCompraDetalle);
    },

    async obtener(compraId: ID) {
      const r = await api.solicitar<{ fila: FilaCompraExpandida | null }>(
        `/api/compras/${id(compraId)}`,
        { contexto: "cargar la compra" },
      );
      return r.fila ? aCompraDetalle(r.fila) : null;
    },

    /** Cabecera y líneas: el backend las guarda en una sola transacción. */
    async crear(datos: NuevaCompra) {
      const r = await api.solicitar<{ fila: FilaCompra }>("/api/compras", {
        metodo: "POST",
        contexto: "registrar la compra",
        cuerpo: {
          proveedorId: datos.proveedorId,
          fecha: datos.fecha,
          numeroFactura: datos.numeroFactura,
          valorFactura: datos.valorFactura,
          lineas: datos.lineas.map((linea) => ({
            productoId: linea.productoId,
            cantidadComprada: linea.cantidadComprada,
            precioUnitario: linea.precioUnitario,
          })),
        },
      });
      return aCompra(r.fila);
    },

    async eliminar(compraId: ID) {
      await api.solicitar<void>(`/api/compras/${id(compraId)}`, {
        metodo: "DELETE",
        contexto: "eliminar la compra",
      });
    },
  };
}

export function crearRepositorioLotes(api: ClienteApi): RepositorioLotes {
  async function consultar(filtro: FiltroLotes = {}, contexto: string) {
    const r = await api.solicitar<{ filas: FilaLoteExpandida[] }>(
      conFiltros("/api/lotes", {
        desde: filtro.desde,
        hasta: filtro.hasta,
        proveedorId: filtro.proveedorId,
        productoId: filtro.productoId,
        productoIds: filtro.productoIds,
        soloDisponibles: filtro.soloDisponibles,
        limite: filtro.limite ?? LIMITE_LOTES_POR_DEFECTO,
      }),
      { contexto },
    );
    return r.filas.map(aLoteDetalleDesdeLinea);
  }

  return {
    listar: (filtro) => consultar(filtro, "cargar las líneas de compra"),

    listarDisponibles: (filtro) =>
      consultar({ ...filtro, soloDisponibles: true }, "cargar los lotes disponibles"),

    async obtener(loteId: ID) {
      const r = await api.solicitar<{ fila: FilaLoteExpandida | null }>(`/api/lotes/${id(loteId)}`, {
        contexto: "cargar el lote de compra",
      });
      return r.fila ? aLoteDetalleDesdeLinea(r.fila) : null;
    },

    /**
     * Bloqueo optimista: solo descuenta si la existencia sigue siendo la que se
     * leyó. Si otra venta se coló en medio, devuelve `false`.
     */
    async descontarExistencia(loteId, cantidad, disponibleEsperada) {
      const r = await api.solicitar<{ aplicado: boolean }>(`/api/lotes/${id(loteId)}/descontar`, {
        metodo: "POST",
        contexto: "descontar la existencia del lote",
        cuerpo: { cantidad, disponibleEsperada },
      });
      return r.aplicado;
    },

    async devolverExistencia(loteId, cantidad) {
      await api.solicitar<void>(`/api/lotes/${id(loteId)}/devolver`, {
        metodo: "POST",
        contexto: "devolver la existencia al lote",
        cuerpo: { cantidad },
      });
    },
  };
}

export function crearRepositorioPagosProveedor(api: ClienteApi): RepositorioPagosProveedor {
  return {
    async listarPorCompra(compraId: ID) {
      const r = await api.solicitar<{ filas: FilaPagoProveedor[] }>(
        `/api/compras/${id(compraId)}/pagos`,
        { contexto: "cargar los abonos de la compra" },
      );
      return r.filas.map(aPagoProveedor);
    },

    async listarEnRango(filtro) {
      if (filtro.compraIds && filtro.compraIds.length === 0) return [];

      const r = await api.solicitar<{ filas: FilaPagoProveedor[] }>(
        "/api/pagos-proveedor/consulta-rango",
        {
          metodo: "POST",
          contexto: "cargar los abonos del periodo",
          cuerpo: { desde: filtro.desde, hasta: filtro.hasta, compraIds: filtro.compraIds },
        },
      );
      return r.filas.map(aPagoProveedor);
    },

    async crear(datos: NuevoPagoProveedor) {
      const r = await api.solicitar<{ fila: FilaPagoProveedor }>("/api/pagos-proveedor", {
        metodo: "POST",
        contexto: "registrar el abono al proveedor",
        cuerpo: { compraId: datos.compraId, fecha: datos.fecha, monto: datos.monto },
      });
      return aPagoProveedor(r.fila);
    },

    async eliminar(pagoId: ID) {
      await api.solicitar<void>(`/api/pagos-proveedor/${id(pagoId)}`, {
        metodo: "DELETE",
        contexto: "eliminar el abono",
      });
    },
  };
}

/** Exportado para que el repositorio de ventas reutilice el mismo convertidor. */
export { aLoteDetalleDesdeLinea, type FilaLoteExpandida };
