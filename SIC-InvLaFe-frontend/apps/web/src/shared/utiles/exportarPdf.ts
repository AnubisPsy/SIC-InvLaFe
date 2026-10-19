import { formatearCantidad, formatearFecha, formatearMonto, hoyISO } from "@invlafe/core";
import { jsPDF } from "jspdf";
import autoTable, { type HookData } from "jspdf-autotable";
import { cargarLogo } from "./logo";
import { AZUL_MARCA, GRIS_CLARO, GRIS_RAYA, GRIS_TEXTO, NEGRO_AZULADO } from "./paletaPdf";
import {
  nombreArchivoReporte,
  type CeldaReporte,
  type ColumnaReporte,
  type ReporteExportable,
} from "./reportes";

/** Formatea una celda cruda según el tipo de su columna, para el texto del PDF. */
function textoCelda(valor: CeldaReporte, columna: ColumnaReporte): string {
  if (valor === null) return "—";
  switch (columna.tipo) {
    case "fecha":
      return valor instanceof Date ? formatearFecha(aISO(valor)) : String(valor);
    case "cantidad":
      return typeof valor === "number" ? formatearCantidad(valor) : String(valor);
    case "moneda":
      return typeof valor === "number" ? formatearMonto(valor) : String(valor);
    default:
      return String(valor);
  }
}

function aISO(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

const MARGEN = 40;

/**
 * Arma el documento sin descargarlo, para que la vista previa y la descarga
 * directa compartan exactamente el mismo PDF.
 */
export async function construirDocumentoPdf(reporte: ReporteExportable): Promise<jsPDF> {
  const { titulo, desde, hasta, columnas, filas, totales } = reporte;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const anchoPagina = doc.internal.pageSize.getWidth();

  const logo = await cargarLogo();

  function dibujarEncabezado() {
    let cursorX = MARGEN;
    const altoLogo = 30;

    if (logo) {
      const anchoLogo = (logo.ancho / logo.alto) * altoLogo;
      doc.addImage(logo.dataUrl, "PNG", MARGEN, 20, anchoLogo, altoLogo);
      cursorX = MARGEN + anchoLogo + 12;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...NEGRO_AZULADO);
    doc.text("INVERSIONES LA FE", cursorX, 36);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...GRIS_TEXTO);
    doc.text("Combustibles y lubricantes", cursorX, 48);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NEGRO_AZULADO);
    doc.text(titulo, anchoPagina - MARGEN, 32, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...GRIS_TEXTO);
    doc.text(
      `Periodo: ${formatearFecha(desde)} – ${formatearFecha(hasta)}`,
      anchoPagina - MARGEN,
      44,
      { align: "right" },
    );
    doc.text(`Generado el ${formatearFecha(hoyISO())}`, anchoPagina - MARGEN, 56, {
      align: "right",
    });

    doc.setDrawColor(...AZUL_MARCA);
    doc.setLineWidth(1.5);
    doc.line(MARGEN, 64, anchoPagina - MARGEN, 64);
  }

  dibujarEncabezado();

  autoTable(doc, {
    startY: 78,
    margin: { left: MARGEN, right: MARGEN, top: 78, bottom: 46 },
    head: [columnas.map((columna) => columna.encabezado)],
    body: filas.map((fila) => fila.map((celda, indice) => textoCelda(celda, columnas[indice]))),
    foot: totales
      ? [totales.map((celda, indice) => textoCelda(celda, columnas[indice]))]
      : undefined,
    theme: "striped",
    styles: { fontSize: 8.5, cellPadding: 5, textColor: NEGRO_AZULADO },
    headStyles: { fillColor: AZUL_MARCA, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: GRIS_CLARO },
    footStyles: { fillColor: GRIS_RAYA, textColor: NEGRO_AZULADO, fontStyle: "bold" },
    columnStyles: Object.fromEntries(
      columnas.map((columna, indice) => [
        indice,
        { halign: columna.alineacion ?? (columna.tipo === "texto" ? "left" : "right") },
      ]),
    ),
    // La cabecera se repite en cada página nueva de una tabla larga; el pie
    // (regla + crédito) también, pero el número de página se resuelve aparte
    // porque acá todavía no se sabe cuántas páginas va a tener el documento.
    didDrawPage: (data: HookData) => {
      if (data.pageNumber > 1) dibujarEncabezado();

      const alturaPagina = doc.internal.pageSize.getHeight();
      doc.setDrawColor(...GRIS_RAYA);
      doc.setLineWidth(0.75);
      doc.line(MARGEN, alturaPagina - 32, anchoPagina - MARGEN, alturaPagina - 32);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...GRIS_TEXTO);
      doc.text(
        "Inversiones La Fe · Reporte generado por el sistema de inventario",
        MARGEN,
        alturaPagina - 18,
      );
    },
  });

  const totalPaginas = doc.getNumberOfPages();
  const alturaPagina = doc.internal.pageSize.getHeight();
  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    doc.setPage(pagina);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRIS_TEXTO);
    doc.text(`Página ${pagina} de ${totalPaginas}`, anchoPagina - MARGEN, alturaPagina - 18, {
      align: "right",
    });
  }

  return doc;
}

/** Construye y descarga de una vez, para quien no necesita la vista previa. */
export async function exportarReportePdf(reporte: ReporteExportable): Promise<void> {
  const doc = await construirDocumentoPdf(reporte);
  doc.save(`${nombreArchivoReporte(reporte)}.pdf`);
}
