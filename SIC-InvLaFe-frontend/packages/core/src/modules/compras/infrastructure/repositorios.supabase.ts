import type { ClienteSupabase } from "../../../infrastructure/supabase/cliente";
import {
  ejecutar,
  ejecutarOpcional,
  ejecutarSinRetorno,
} from "../../../infrastructure/supabase/errores";
import {
  TABLAS,
  aFecha,
  aId,
  aNumero,
  type FilaCompra,
  type FilaLoteCompra,
  type FilaPagoProveedor,
  type FilaProducto,
  type FilaProveedor,
} from "../../../infrastructure/supabase/tablas";
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
 * La compra se pide con su proveedor, sus líneas y sus abonos en una sola
 * consulta: el saldo se deriva de los abonos y las líneas son lo que la
 * pantalla despliega, así que traerlos aparte sería una ida a la base por fila.
 */
const SELECT_COMPRA = `
  *,
  proveedor:${TABLAS.PROVEEDORES}(*),
  lineas:${TABLAS.LOTES_COMPRA}(*, producto:${TABLAS.PRODUCTOS}(*)),
  pagos:${TABLAS.PAGOS_PROVEEDOR}(monto)
` as const;

/**
 * La línea, en cambio, se pide con su cabecera colgando: es lo que necesitan
 * el cuadre y el selector de ventas, que razonan en unidades de inventario y
 * solo quieren saber de qué factura salió cada una.
 *
 * `!inner` no es decorativo: sin él PostgREST no deja filtrar ni por fecha ni
 * por proveedor, que ahora son columnas de la cabecera.
 */
const SELECT_LOTE = `
  *,
  producto:${TABLAS.PRODUCTOS}(*),
  compra:${TABLAS.COMPRAS}!inner(*, proveedor:${TABLAS.PROVEEDORES}(*))
` as const;

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

export function crearRepositorioCompras(
  cliente: ClienteSupabase,
): RepositorioCompras {
  const tabla = () => cliente.from(TABLAS.COMPRAS);

  return {
    async listar(filtro: FiltroCompras = {}) {
      let consulta = tabla().select(SELECT_COMPRA);

      if (filtro.desde) consulta = consulta.gte("fecha", filtro.desde);
      if (filtro.hasta) consulta = consulta.lte("fecha", filtro.hasta);
      if (filtro.proveedorId) {
        consulta = consulta.eq("proveedor_id", filtro.proveedorId);
      }
      // El filtro por producto no se aplica aquí: mira dentro de las líneas y
      // un `inner join` filtrado devolvería la factura recortada, ocultando lo
      // demás que venía en ella. Lo resuelve el caso de uso.

      const filas = await ejecutar<FilaCompraExpandida[]>(
        consulta
          .order("fecha", { ascending: false })
          .order("creado_en", { ascending: false })
          .limit(filtro.limite ?? LIMITE_LOTES_POR_DEFECTO),
        "cargar las compras",
      );
      return filas.map(aCompraDetalle);
    },

    async obtener(id: ID) {
      const fila = await ejecutarOpcional<FilaCompraExpandida>(
        tabla().select(SELECT_COMPRA).eq("id", id).single(),
        "cargar la compra",
      );
      return fila ? aCompraDetalle(fila) : null;
    },

    /**
     * Cabecera primero, líneas después, y si las líneas fallan se borra la
     * cabecera.
     *
     * Sin transacciones en el navegador, el orden importa: una factura sin
     * productos es basura recuperable —se borra y ya—, mientras que unas líneas
     * sin factura serían inventario fantasma que el cuadre contaría como
     * existencia real.
     */
    async crear(datos: NuevaCompra) {
      const cabecera = await ejecutar<FilaCompra>(
        tabla()
          .insert({
            proveedor_id: datos.proveedorId,
            fecha: datos.fecha,
            numero_factura: datos.numeroFactura,
            valor_factura: datos.valorFactura,
          })
          .select("*")
          .single(),
        "registrar la compra",
      );

      try {
        await ejecutarSinRetorno(
          cliente.from(TABLAS.LOTES_COMPRA).insert(
            datos.lineas.map((linea) => ({
              compra_id: cabecera.id,
              producto_id: linea.productoId,
              cantidad_comprada: linea.cantidadComprada,
              precio_unitario: linea.precioUnitario,
              // Una línea nace íntegra: todo lo comprado está disponible.
              cantidad_disponible: linea.cantidadComprada,
            })),
          ),
          "registrar las líneas de la compra",
        );
      } catch (error) {
        await tabla().delete().eq("id", cabecera.id);
        throw error;
      }

      return aCompra(cabecera);
    },

    async eliminar(id: ID) {
      await ejecutarSinRetorno(
        tabla().delete().eq("id", id),
        "eliminar la compra",
      );
    },
  };
}

export function crearRepositorioLotes(cliente: ClienteSupabase): RepositorioLotes {
  const tabla = () => cliente.from(TABLAS.LOTES_COMPRA);

  /** Aplica solo los filtros que Postgres puede resolver. */
  function consultar(filtro: FiltroLotes = {}) {
    let consulta = tabla().select(SELECT_LOTE);

    if (filtro.desde) consulta = consulta.gte("compra.fecha", filtro.desde);
    if (filtro.hasta) consulta = consulta.lte("compra.fecha", filtro.hasta);
    if (filtro.proveedorId) {
      consulta = consulta.eq("compra.proveedor_id", filtro.proveedorId);
    }
    if (filtro.productoId) consulta = consulta.eq("producto_id", filtro.productoId);
    if (filtro.productoIds?.length) {
      consulta = consulta.in("producto_id", filtro.productoIds);
    }
    if (filtro.soloDisponibles) consulta = consulta.gt("cantidad_disponible", 0);

    // Se ordena por `creado_en` de la línea y no por la fecha de la factura:
    // PostgREST no ordena el nivel superior por una columna embebida. El caso
    // de uso reordena por fecha, que es lo que el usuario espera ver.
    return consulta
      .order("creado_en", { ascending: false })
      .limit(filtro.limite ?? LIMITE_LOTES_POR_DEFECTO);
  }

  return {
    async listar(filtro) {
      const filas = await ejecutar<FilaLoteExpandida[]>(
        consultar(filtro),
        "cargar las líneas de compra",
      );
      return filas.map(aLoteDetalleDesdeLinea);
    },

    async listarDisponibles(filtro) {
      const filas = await ejecutar<FilaLoteExpandida[]>(
        consultar({ ...filtro, soloDisponibles: true }),
        "cargar los lotes disponibles",
      );
      return filas.map(aLoteDetalleDesdeLinea);
    },

    async obtener(id: ID) {
      const fila = await ejecutarOpcional<FilaLoteExpandida>(
        tabla().select(SELECT_LOTE).eq("id", id).single(),
        "cargar el lote de compra",
      );
      return fila ? aLoteDetalleDesdeLinea(fila) : null;
    },

    /**
     * Descuento con bloqueo optimista: el UPDATE solo aplica si
     * `cantidad_disponible` sigue valiendo lo que se leyó. Si otra venta se
     * coló en medio, no afecta ninguna fila y devolvemos `null` en vez de
     * dejar el inventario en negativo.
     */
    async descontarExistencia(id, cantidad, disponibleEsperada) {
      const filas = await ejecutar<FilaLoteCompra[]>(
        tabla()
          .update({
            cantidad_disponible: redondearCantidad(disponibleEsperada - cantidad),
          })
          .eq("id", id)
          .eq("cantidad_disponible", disponibleEsperada)
          .select("id"),
        "descontar la existencia del lote",
      );
      return filas.length > 0;
    },

    async devolverExistencia(id, cantidad) {
      // Compensación: se relee para no pisar cambios concurrentes con un valor viejo.
      const actual = await ejecutarOpcional<FilaLoteCompra>(
        tabla().select("*").eq("id", id).single(),
        "leer el lote para devolver la existencia",
      );
      if (!actual) return;

      await ejecutarSinRetorno(
        tabla()
          .update({
            cantidad_disponible: redondearCantidad(
              aNumero(actual.cantidad_disponible) + cantidad,
            ),
          })
          .eq("id", id),
        "devolver la existencia al lote",
      );
    },
  };
}

export function crearRepositorioPagosProveedor(
  cliente: ClienteSupabase,
): RepositorioPagosProveedor {
  const tabla = () => cliente.from(TABLAS.PAGOS_PROVEEDOR);

  return {
    async listarPorCompra(compraId: ID) {
      const filas = await ejecutar<FilaPagoProveedor[]>(
        tabla()
          .select("*")
          .eq("compra_id", compraId)
          .order("fecha", { ascending: false })
          .order("creado_en", { ascending: false }),
        "cargar los abonos de la compra",
      );
      return filas.map(aPagoProveedor);
    },

    async listarEnRango(filtro) {
      // Sin facturas que calcen el filtro de proveedor/producto, ni vale la
      // pena ir a la base: no habría ningún `compra_id` que pedir.
      if (filtro.compraIds && filtro.compraIds.length === 0) return [];

      let consulta = tabla().select("*");
      if (filtro.desde) consulta = consulta.gte("fecha", filtro.desde);
      if (filtro.hasta) consulta = consulta.lte("fecha", filtro.hasta);
      if (filtro.compraIds) consulta = consulta.in("compra_id", filtro.compraIds);

      const filas = await ejecutar<FilaPagoProveedor[]>(
        consulta.order("fecha", { ascending: true }).order("creado_en", { ascending: true }),
        "cargar los abonos del periodo",
      );
      return filas.map(aPagoProveedor);
    },

    async crear(datos: NuevoPagoProveedor) {
      const fila = await ejecutar<FilaPagoProveedor>(
        tabla()
          .insert({
            compra_id: datos.compraId,
            fecha: datos.fecha,
            monto: datos.monto,
          })
          .select("*")
          .single(),
        "registrar el abono al proveedor",
      );
      return aPagoProveedor(fila);
    },

    async eliminar(id: ID) {
      await ejecutarSinRetorno(tabla().delete().eq("id", id), "eliminar el abono");
    },
  };
}

/** Reexportado para que el repositorio de ventas reutilice el mismo mapper. */
export { aLoteDetalleDesdeLinea, SELECT_LOTE, type FilaLoteExpandida };
