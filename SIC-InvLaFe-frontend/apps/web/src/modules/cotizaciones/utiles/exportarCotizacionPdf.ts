import {
  formatearCantidad,
  formatearFecha,
  formatearMonto,
  type CotizacionDetalle,
} from "@invlafe/core";
import { jsPDF } from "jspdf";
import autoTable, { type HookData } from "jspdf-autotable";
import { cargarLogo } from "../../../shared/utiles/logo";
import {
  AZUL_MARCA,
  GRIS_CLARO,
  GRIS_RAYA,
  GRIS_TEXTO,
  NEGRO_AZULADO,
} from "../../../shared/utiles/paletaPdf";

const MARGEN = 40;

/** Referencia corta y legible: no hay numeración correlativa en la base. */
export function referenciaCotizacion(cotizacion: CotizacionDetalle): string {
  return `COT-${cotizacion.id.slice(0, 8).toUpperCase()}`;
}

export function nombreArchivoCotizacion(cotizacion: CotizacionDetalle): string {
  const cliente = (cotizacion.cliente?.nombre ?? "cliente")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `cotizacion-${cliente || "cliente"}-${cotizacion.fecha}`;
}

/**
 * Documento formal de una cotización: encabezado con logo, datos del
 * cliente, la tabla de productos con su total, notas del pedido si las trae
 * y un espacio de firma — pensado para entregarse tal cual al cliente, no
 * solo para uso interno.
 */
export async function construirDocumentoCotizacion(
  cotizacion: CotizacionDetalle,
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const anchoPagina = doc.internal.pageSize.getWidth();
  const alturaPagina = doc.internal.pageSize.getHeight();

  const logo = await cargarLogo();

  function dibujarEncabezado() {
    let cursorX = MARGEN;
    const altoLogo = 34;

    if (logo) {
      const anchoLogo = (logo.ancho / logo.alto) * altoLogo;
      doc.addImage(logo.dataUrl, "PNG", MARGEN, 24, anchoLogo, altoLogo);
      cursorX = MARGEN + anchoLogo + 12;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...NEGRO_AZULADO);
    doc.text("INVERSIONES LA FE", cursorX, 40);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...GRIS_TEXTO);
    doc.text("Combustibles y lubricantes", cursorX, 52);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...AZUL_MARCA);
    doc.text("COTIZACIÓN", anchoPagina - MARGEN, 36, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GRIS_TEXTO);
    doc.text(referenciaCotizacion(cotizacion), anchoPagina - MARGEN, 50, { align: "right" });
    doc.text(`Fecha: ${formatearFecha(cotizacion.fecha)}`, anchoPagina - MARGEN, 62, {
      align: "right",
    });

    doc.setDrawColor(...AZUL_MARCA);
    doc.setLineWidth(1.5);
    doc.line(MARGEN, 74, anchoPagina - MARGEN, 74);
  }

  function dibujarPie() {
    doc.setDrawColor(...GRIS_RAYA);
    doc.setLineWidth(0.75);
    doc.line(MARGEN, alturaPagina - 32, anchoPagina - MARGEN, alturaPagina - 32);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRIS_TEXTO);
    doc.text(
      "Inversiones La Fe · Cotización generada por el sistema de inventario",
      MARGEN,
      alturaPagina - 18,
    );
  }

  dibujarEncabezado();

  // Bloque "cotizado a": nombre y teléfono del cliente.
  let cursorY = 96;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...GRIS_TEXTO);
  doc.text("COTIZADO A", MARGEN, cursorY);

  cursorY += 17;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(...NEGRO_AZULADO);
  doc.text(cotizacion.cliente?.nombre ?? "Cliente sin registrar", MARGEN, cursorY);

  if (cotizacion.cliente?.telefono) {
    cursorY += 15;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...GRIS_TEXTO);
    doc.text(cotizacion.cliente.telefono, MARGEN, cursorY);
  }

  cursorY += 22;

  const filas = cotizacion.lineas.map((linea) => [
    linea.producto?.nombre ?? "—",
    formatearCantidad(linea.cantidad),
    formatearMonto(linea.precioUnitario),
    formatearMonto(linea.subtotal),
  ]);

  // El punto donde quedó el cursor tras la última fila se recalcula en cada
  // página dibujada: es la única forma fiable de saber dónde sigue el
  // contenido después de una tabla que puede o no partirse en varias páginas.
  let finY = cursorY;

  autoTable(doc, {
    startY: cursorY,
    margin: { left: MARGEN, right: MARGEN, top: 78, bottom: 46 },
    head: [["Producto", "Cantidad", "Precio unitario", "Subtotal"]],
    body: filas,
    foot: [["", "", "Total", formatearMonto(cotizacion.total)]],
    theme: "striped",
    styles: { fontSize: 9.5, cellPadding: 6, textColor: NEGRO_AZULADO },
    headStyles: { fillColor: AZUL_MARCA, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: GRIS_CLARO },
    footStyles: {
      fillColor: GRIS_RAYA,
      textColor: NEGRO_AZULADO,
      fontStyle: "bold",
      fontSize: 10.5,
    },
    columnStyles: {
      0: { halign: "left" },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
    },
    didDrawPage: (data: HookData) => {
      if (data.pageNumber > 1) dibujarEncabezado();
      dibujarPie();
      if (data.cursor) finY = data.cursor.y;
    },
  });

  // Notas y firmas van después de la tabla; si no caben en lo que queda de la
  // página, se abre una nueva en vez de encimarlas con el pie.
  const notas = cotizacion.nota
    ? doc.splitTextToSize(cotizacion.nota, anchoPagina - MARGEN * 2)
    : [];
  const altoNotas = cotizacion.nota ? 16 + notas.length * 12 + 24 : 0;
  const altoFirmas = 60;

  let cursorFinal = finY + 28;
  if (alturaPagina - 50 - cursorFinal < altoNotas + altoFirmas) {
    doc.addPage();
    dibujarEncabezado();
    dibujarPie();
    cursorFinal = 96;
  }

  if (cotizacion.nota) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...GRIS_TEXTO);
    doc.text("NOTAS Y CONDICIONES", MARGEN, cursorFinal);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...NEGRO_AZULADO);
    doc.text(notas, MARGEN, cursorFinal + 16);
    cursorFinal += 16 + notas.length * 12 + 24;
  }

  cursorFinal += 30;
  const anchoFirma = (anchoPagina - MARGEN * 2 - 40) / 2;
  doc.setDrawColor(...GRIS_RAYA);
  doc.setLineWidth(0.75);
  doc.line(MARGEN, cursorFinal, MARGEN + anchoFirma, cursorFinal);
  doc.line(anchoPagina - MARGEN - anchoFirma, cursorFinal, anchoPagina - MARGEN, cursorFinal);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRIS_TEXTO);
  doc.text("Cotizado por", MARGEN, cursorFinal + 14);
  doc.text("Aceptado por", anchoPagina - MARGEN - anchoFirma, cursorFinal + 14);

  const totalPaginas = doc.getNumberOfPages();
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
