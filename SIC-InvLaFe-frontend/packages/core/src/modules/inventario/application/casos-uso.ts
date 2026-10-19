import { ErrorNoEncontrado } from "../../../shared/errores";
import type { ID } from "../../../shared/tipos";
import type { CasosUsoCompras } from "../../compras/application/casos-uso";
import type { FiltroLotes } from "../../compras/domain/entidades";
import type { RepositorioVentas } from "../../ventas/domain/repositorios";
import type { VentaDetalle } from "../../ventas/domain/entidades";
import type { CuadreLote, ResumenCuadre } from "../domain/entidades";
import { construirCuadre, resumirCuadre } from "../domain/entidades";

export interface CasosUsoInventario {
  /** Lotes con sus ventas anidadas: la vista de trazabilidad del cuadre. */
  cuadreDeLotes(filtro?: FiltroLotes): Promise<CuadreLote[]>;
  cuadreDeLote(loteId: ID): Promise<CuadreLote>;
  resumen(cuadres: readonly CuadreLote[]): ResumenCuadre;
}

export function crearCasosUsoInventario(deps: {
  compras: CasosUsoCompras;
  ventas: RepositorioVentas;
}): CasosUsoInventario {
  const { compras, ventas } = deps;

  return {
    /**
     * Dos consultas en total, no una por lote: se traen los lotes filtrados y
     * después todas sus ventas de golpe, agrupándolas en memoria.
     */
    async cuadreDeLotes(filtro) {
      const lotes = await compras.listarLotes(filtro);
      if (lotes.length === 0) return [];

      const ventasDeLotes = await ventas.listarPorLotes(lotes.map((lote) => lote.id));

      const porLote = new Map<ID, VentaDetalle[]>();
      for (const venta of ventasDeLotes) {
        const acumuladas = porLote.get(venta.loteCompraId);
        if (acumuladas) acumuladas.push(venta);
        else porLote.set(venta.loteCompraId, [venta]);
      }

      return lotes.map((lote) => construirCuadre(lote, porLote.get(lote.id) ?? []));
    },

    async cuadreDeLote(loteId) {
      const lote = await compras.obtenerLote(loteId);
      if (!lote) throw new ErrorNoEncontrado("el lote de compra", loteId);

      return construirCuadre(lote, await ventas.listarPorLote(loteId));
    },

    resumen: resumirCuadre,
  };
}
