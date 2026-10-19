import { formatearFecha } from "@invlafe/core";
import type ExcelJS from "exceljs";
import logoUrl from "../../assets/logo-inversioneslafe.png";
import {
  nombreArchivoReporte,
  type CeldaReporte,
  type ColumnaReporte,
  type ReporteExportable,
  type TipoColumnaReporte,
} from "./reportes";

const AZUL_MARCA = "FF0369A1";
const BLANCO = "FFFFFFFF";
const GRIS_TEXTO = "FF64748B";
const NEGRO_AZULADO = "FF111827";
const GRIS_RAYA = "FFE2E8F0";

const ANCHO_COLUMNA: Record<TipoColumnaReporte, number> = {
  texto: 22,
  fecha: 13,
  cantidad: 12,
  moneda: 15,
};

let logoBufferPromise: Promise<ArrayBuffer> | null = null;

/** Mismo logo que el PDF, cacheado una sola vez. Si falla, el Excel sale sin él. */
function cargarLogoBuffer(): Promise<ArrayBuffer> {
  logoBufferPromise ??= fetch(logoUrl).then((respuesta) => respuesta.arrayBuffer());
  return logoBufferPromise;
}

function aplicarValorCelda(celda: ExcelJS.Cell, valor: CeldaReporte, columna: ColumnaReporte) {
  if (valor === null) return;

  switch (columna.tipo) {
    case "fecha":
      celda.value = valor as Date;
      celda.numFmt = "dd/mm/yyyy";
      celda.alignment = { horizontal: "right" };
      break;
    case "cantidad":
      celda.value = valor as number;
      celda.numFmt = "#,##0.00";
      celda.alignment = { horizontal: "right" };
      break;
    case "moneda":
      celda.value = valor as number;
      celda.numFmt = '"L" #,##0.00';
      celda.alignment = { horizontal: "right" };
      break;
    default:
      celda.value = valor as string;
      celda.alignment = { horizontal: "left" };
  }
}

function descargarBlob(blob: Blob, nombreArchivo: string) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

/**
 * Arma y descarga un `.xlsx` de verdad: fechas y montos quedan como valores
 * nativos de Excel (no texto), así que "Fecha" trae encima el filtro de
 * columna de Excel y se puede filtrar/ordenar por rango como cualquier otra
 * tabla, no solo leerse.
 */
export async function exportarReporteExcel(reporte: ReporteExportable): Promise<void> {
  const { titulo, desde, hasta, columnas, filas, totales } = reporte;

  // `exceljs` pesa bastante (arrastra su propio zip); se carga solo cuando
  // alguien realmente pide el Excel, no de entrada al abrir Reportes.
  const { default: Excel } = await import("exceljs");
  const workbook = new Excel.Workbook();
  workbook.creator = "Inversiones La Fe";
  workbook.created = new Date();

  const hoja = workbook.addWorksheet(titulo.slice(0, 31) || "Reporte", {
    views: [{ state: "frozen", ySplit: 4 }],
  });

  hoja.columns = columnas.map((columna) => ({
    width: Math.max(ANCHO_COLUMNA[columna.tipo], columna.encabezado.length + 2),
  }));

  // Fila 1: nombre del negocio (arranca en la columna B; la A queda libre
  // para el logo, que se ancla encima como imagen flotante).
  hoja.getRow(1).height = 34;
  hoja.mergeCells(1, 2, 1, Math.max(columnas.length, 2));
  const celdaNombre = hoja.getCell(1, 2);
  celdaNombre.value = "INVERSIONES LA FE";
  celdaNombre.font = { bold: true, size: 14, color: { argb: NEGRO_AZULADO } };
  celdaNombre.alignment = { vertical: "middle" };

  // Fila 2: título del reporte y periodo filtrado.
  hoja.mergeCells(2, 2, 2, Math.max(columnas.length, 2));
  const celdaSubtitulo = hoja.getCell(2, 2);
  celdaSubtitulo.value = `${titulo}  ·  Periodo: ${formatearFecha(desde)} – ${formatearFecha(hasta)}`;
  celdaSubtitulo.font = { size: 10, color: { argb: GRIS_TEXTO } };

  // Fila 3 queda vacía como separador visual antes del encabezado.

  // Fila 4: encabezados de columna, con el estilo que Excel resalta al filtrar.
  const filaEncabezado = hoja.getRow(4);
  filaEncabezado.height = 20;
  columnas.forEach((columna, indice) => {
    const celda = filaEncabezado.getCell(indice + 1);
    celda.value = columna.encabezado;
    celda.font = { bold: true, color: { argb: BLANCO } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_MARCA } };
    celda.alignment = {
      horizontal: columna.tipo === "texto" ? "left" : "right",
      vertical: "middle",
    };
  });

  // Filas de datos, desde la 5. Cada celda queda con su tipo nativo.
  filas.forEach((fila, indiceFila) => {
    const filaExcel = hoja.getRow(5 + indiceFila);
    fila.forEach((valor, indiceColumna) => {
      aplicarValorCelda(filaExcel.getCell(indiceColumna + 1), valor, columnas[indiceColumna]);
    });
  });

  if (totales) {
    const filaExcel = hoja.getRow(5 + filas.length);
    totales.forEach((valor, indiceColumna) => {
      const celda = filaExcel.getCell(indiceColumna + 1);
      aplicarValorCelda(celda, valor, columnas[indiceColumna]);
      celda.font = { ...(celda.font ?? {}), bold: true };
      celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS_RAYA } };
    });
  }

  // Filtro nativo de Excel: cubre el encabezado y los datos, pero no la fila
  // de totales, así que esta última no desaparece si el usuario filtra.
  if (filas.length > 0) {
    hoja.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: 4 + filas.length, column: columnas.length },
    };
  }

  try {
    const buffer = await cargarLogoBuffer();
    const imageId = workbook.addImage({ buffer, extension: "png" });
    hoja.addImage(imageId, {
      tl: { col: 0.15, row: 0.1 },
      ext: { width: 46, height: 46 },
    });
  } catch {
    // Sin logo no es crítico: el archivo sigue siendo un reporte válido.
  }

  const bufferSalida = await workbook.xlsx.writeBuffer();
  const blob = new Blob([bufferSalida], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  descargarBlob(blob, `${nombreArchivoReporte(reporte)}.xlsx`);
}
