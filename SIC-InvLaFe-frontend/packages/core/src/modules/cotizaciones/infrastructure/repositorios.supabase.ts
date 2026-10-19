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
  aIdOpcional,
  aNumero,
  type FilaCliente,
  type FilaCotizacion,
  type FilaCotizacionItem,
  type FilaProducto,
  type IdCrudo,
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
  LineaCotizacionEntrada,
} from "../domain/entidades";
import { normalizarEstado, subtotalDeLinea, totalCotizado } from "../domain/entidades";
import type { RepositorioCotizaciones } from "../domain/repositorios";

const SELECT_COTIZACION = `
  *,
  cliente:${TABLAS.CLIENTES}(*),
  lineas:${TABLAS.COTIZACION_ITEMS}(*, producto:${TABLAS.PRODUCTOS}(*))
` as const;

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

export function crearRepositorioCotizaciones(
  cliente: ClienteSupabase,
): RepositorioCotizaciones {
  const tabla = () => cliente.from(TABLAS.COTIZACIONES);
  const tablaItems = () => cliente.from(TABLAS.COTIZACION_ITEMS);

  const filasDeLineas = (cotizacionId: IdCrudo, lineas: readonly LineaCotizacionEntrada[]) =>
    lineas.map((linea) => ({
      cotizacion_id: cotizacionId,
      producto_id: linea.productoId,
      cantidad: linea.cantidad,
      precio_unitario: linea.precioUnitario,
    }));

  async function insertarLineas(
    cotizacionId: IdCrudo,
    lineas: readonly LineaCotizacionEntrada[],
  ) {
    if (lineas.length === 0) return;

    await ejecutarSinRetorno(
      tablaItems().insert(filasDeLineas(cotizacionId, lineas)),
      "guardar las líneas de la cotización",
    );
  }

  return {
    async listar(filtro: FiltroCotizaciones = {}) {
      let consulta = tabla().select(SELECT_COTIZACION);

      if (filtro.desde) consulta = consulta.gte("fecha", filtro.desde);
      if (filtro.hasta) consulta = consulta.lte("fecha", filtro.hasta);
      if (filtro.clienteId) consulta = consulta.eq("cliente_id", filtro.clienteId);
      // `estado` se filtra en el caso de uso: en base es texto libre y aquí ya
      // trabajamos con el valor normalizado. `productoId`, también: mira dentro
      // de las líneas y un inner join devolvería la cotización recortada.

      const filas = await ejecutar<FilaCotizacionExpandida[]>(
        consulta
          .order("fecha", { ascending: false })
          .order("creado_en", { ascending: false })
          .limit(500),
        "cargar las cotizaciones",
      );
      return filas.map(aCotizacionDetalle);
    },

    async obtener(id: ID) {
      const fila = await ejecutarOpcional<FilaCotizacionExpandida>(
        tabla().select(SELECT_COTIZACION).eq("id", id).single(),
        "cargar la cotización",
      );
      return fila ? aCotizacionDetalle(fila) : null;
    },

    async crear(datos: DatosCotizacion) {
      const fila = await ejecutar<FilaCotizacion>(
        tabla()
          .insert({
            cliente_id: datos.clienteId,
            fecha: datos.fecha,
            detalle: datos.nota,
            estado: datos.estado,
          })
          .select("*")
          .single(),
        "crear la cotización",
      );

      try {
        await insertarLineas(fila.id, datos.lineas);
      } catch (error) {
        await tabla().delete().eq("id", fila.id);
        throw error;
      }

      return aCotizacion(fila);
    },

    /**
     * Las líneas se reemplazan enteras en vez de reconciliarse una a una.
     *
     * Casar altas, bajas y cambios pediría ids en el formulario y una
     * comparación que, si se equivoca, deja líneas duplicadas. Borrar e
     * insertar es trivialmente correcto, y el único coste es que las líneas
     * cambian de id: nada apunta a ellas mientras la cotización no se haya
     * convertido, y una convertida no se puede editar.
     */
    async actualizar(id: ID, datos: DatosCotizacion) {
      const fila = await ejecutar<FilaCotizacion>(
        tabla()
          .update({
            cliente_id: datos.clienteId,
            fecha: datos.fecha,
            detalle: datos.nota,
            estado: datos.estado,
          })
          .eq("id", id)
          .select("*")
          .single(),
        "actualizar la cotización",
      );

      await ejecutarSinRetorno(
        tablaItems().delete().eq("cotizacion_id", id),
        "reemplazar las líneas de la cotización",
      );
      await insertarLineas(fila.id, datos.lineas);

      return aCotizacion(fila);
    },

    async cambiarEstado(id: ID, estado: EstadoCotizacion) {
      const fila = await ejecutar<FilaCotizacion>(
        tabla().update({ estado }).eq("id", id).select("*").single(),
        "cambiar el estado de la cotización",
      );
      return aCotizacion(fila);
    },

    async enlazarVenta(id: ID, ventaId: ID) {
      const fila = await ejecutar<FilaCotizacion>(
        tabla()
          .update({ venta_id: ventaId })
          .eq("id", id)
          .select("*")
          .single(),
        "enlazar la cotización con la venta",
      );
      return aCotizacion(fila);
    },

    async enlazarVentaDeLinea(lineaId: ID, ventaId: ID) {
      await ejecutarSinRetorno(
        tablaItems().update({ venta_id: ventaId }).eq("id", lineaId),
        "enlazar la línea con su venta",
      );
    },

    async eliminar(id: ID) {
      // Las líneas se van en cascada por la clave foránea.
      await ejecutarSinRetorno(
        tabla().delete().eq("id", id),
        "eliminar la cotización",
      );
    },
  };
}
