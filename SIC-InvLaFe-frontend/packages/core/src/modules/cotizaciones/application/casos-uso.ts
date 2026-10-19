import { ErrorConflicto, ErrorNoEncontrado } from "../../../shared/errores";
import { normalizar } from "../../../shared/texto";
import type { ID } from "../../../shared/tipos";
import type { CasosUsoVentas } from "../../ventas/application/casos-uso";
import type { Venta } from "../../ventas/domain/entidades";
import type {
  Cotizacion,
  CotizacionDetalle,
  DatosConversion,
  DatosCotizacion,
  EstadoCotizacion,
  FiltroCotizaciones,
} from "../domain/entidades";
import {
  ESTADOS_COTIZACION,
  estaConvertida,
  puedeConvertirseEnVenta,
  validarConversion,
  validarCotizacion,
} from "../domain/entidades";
import type { RepositorioCotizaciones } from "../domain/repositorios";

export interface ResultadoConversion {
  cotizacion: Cotizacion;
  /** Una venta por línea cotizada, en el mismo orden. */
  ventas: Venta[];
}

export interface CasosUsoCotizaciones {
  listar(filtro?: FiltroCotizaciones): Promise<CotizacionDetalle[]>;
  obtener(id: ID): Promise<CotizacionDetalle>;
  crear(datos: DatosCotizacion): Promise<Cotizacion>;
  actualizar(id: ID, datos: DatosCotizacion): Promise<Cotizacion>;
  cambiarEstado(id: ID, estado: EstadoCotizacion): Promise<Cotizacion>;
  eliminar(id: ID): Promise<void>;
  /** Marca la cotización como aceptada y genera una venta por cada línea. */
  convertirEnVenta(id: ID, datos: DatosConversion): Promise<ResultadoConversion>;
}

export function crearCasosUsoCotizaciones(deps: {
  cotizaciones: RepositorioCotizaciones;
  ventas: CasosUsoVentas;
}): CasosUsoCotizaciones {
  const { cotizaciones, ventas } = deps;

  async function obtener(id: ID): Promise<CotizacionDetalle> {
    const cotizacion = await cotizaciones.obtener(id);
    if (!cotizacion) throw new ErrorNoEncontrado("la cotización", id);
    return cotizacion;
  }

  return {
    async listar(filtro = {}) {
      let items = await cotizaciones.listar(filtro);

      if (filtro.estado) {
        items = items.filter((cotizacion) => cotizacion.estado === filtro.estado);
      }

      if (filtro.productoId) {
        items = items.filter((cotizacion) =>
          cotizacion.lineas.some((linea) => linea.productoId === filtro.productoId),
        );
      }

      const busqueda = normalizar(filtro.busqueda);
      if (busqueda) {
        items = items.filter((cotizacion) =>
          [
            cotizacion.nota,
            cotizacion.cliente?.nombre,
            ...cotizacion.lineas.map((linea) => linea.producto?.nombre),
          ]
            .map(normalizar)
            .some((campo) => campo.includes(busqueda)),
        );
      }

      return items;
    },

    obtener,

    crear(datos) {
      return cotizaciones.crear(validarCotizacion(datos));
    },

    async actualizar(id, datos) {
      const actual = await obtener(id);
      if (estaConvertida(actual)) {
        throw new ErrorConflicto(
          "Esta cotización ya se convirtió en venta y no se puede modificar.",
        );
      }
      return cotizaciones.actualizar(id, validarCotizacion(datos));
    },

    async cambiarEstado(id, estado) {
      const actual = await obtener(id);
      if (estaConvertida(actual)) {
        throw new ErrorConflicto(
          "Esta cotización ya se convirtió en venta y no se puede modificar.",
        );
      }
      return cotizaciones.cambiarEstado(id, estado);
    },

    async eliminar(id) {
      const actual = await obtener(id);
      if (estaConvertida(actual)) {
        throw new ErrorConflicto(
          "Esta cotización ya se convirtió en venta. Anula primero las ventas asociadas.",
        );
      }
      await cotizaciones.eliminar(id);
    },

    /**
     * Convertir una cotización de tres productos emite tres ventas, cada una
     * contra el lote de su producto: el inventario se lleva por lote y no hay
     * forma de descontar diésel y aceite de la misma fila.
     *
     * Es todo o nada. Si la segunda venta falla, se anulan las que ya se
     * emitieron —lo que devuelve su existencia al lote— en vez de dejar la
     * cotización facturada a medias, que es un estado que nadie sabría leer
     * después.
     *
     * Las ventas se crean antes de enlazarlas, y por el mismo motivo que antes:
     * una venta huérfana se recupera a mano, mientras que una cotización que
     * apunta a una venta inexistente rompe la pantalla al abrirla.
     */
    async convertirEnVenta(id, datos) {
      const cotizacion = await obtener(id);

      if (estaConvertida(cotizacion)) {
        throw new ErrorConflicto("Esta cotización ya tiene ventas asociadas.");
      }

      // Convertir implica aceptar: si el usuario la convierte desde el estado
      // pendiente, se acepta en el mismo paso en vez de exigirle dos clics.
      if (cotizacion.estado !== ESTADOS_COTIZACION.ACEPTADA) {
        await cotizaciones.cambiarEstado(id, ESTADOS_COTIZACION.ACEPTADA);
        cotizacion.estado = ESTADOS_COTIZACION.ACEPTADA;
      }

      if (!puedeConvertirseEnVenta(cotizacion)) {
        throw new ErrorConflicto(
          "La cotización no está en un estado que permita convertirla en venta.",
        );
      }

      const validos = validarConversion(datos, cotizacion.lineas);
      const porLinea = new Map(
        validos.lineas.map((linea) => [linea.lineaId, linea]),
      );

      const emitidas: { lineaId: ID; venta: Venta }[] = [];

      try {
        for (const cotizada of cotizacion.lineas) {
          // `validarConversion` ya garantizó que existe; el `continue` es solo
          // para que el tipo no sea opcional aquí abajo.
          const conversion = porLinea.get(cotizada.id);
          if (!conversion) continue;

          const venta = await ventas.registrarVenta({
            clienteId: cotizacion.clienteId,
            loteCompraId: conversion.loteCompraId,
            fecha: validos.fecha,
            numeroFactura: validos.numeroFactura,
            cantidad: conversion.cantidad,
            precioUnitario: conversion.precioUnitario,
          });

          emitidas.push({ lineaId: cotizada.id, venta });
        }
      } catch (error) {
        for (const { venta } of emitidas.reverse()) {
          await ventas.anularVenta(venta.id).catch(() => undefined);
        }
        throw error;
      }

      // Los enlaces van después de que todas las ventas existan: si uno falla,
      // las ventas siguen siendo válidas y solo se pierde la trazabilidad, que
      // es reparable.
      for (const { lineaId, venta } of emitidas) {
        await cotizaciones.enlazarVentaDeLinea(lineaId, venta.id).catch(() => undefined);
      }

      const primera = emitidas[0];
      const enlazada = primera
        ? await cotizaciones.enlazarVenta(id, primera.venta.id)
        : cotizacion;

      return { cotizacion: enlazada, ventas: emitidas.map((item) => item.venta) };
    },
  };
}
