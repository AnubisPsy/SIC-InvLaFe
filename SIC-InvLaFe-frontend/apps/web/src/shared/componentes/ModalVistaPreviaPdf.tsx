import { Box } from "@mui/material";
import type { jsPDF } from "jspdf";
import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Alerta, Boton, Cargador, Modal } from "../ui";

/** Lo que le hace falta al diálogo para armar el documento y nombrar el archivo. */
export interface SolicitudVistaPreviaPdf {
  /** Encabezado del diálogo, p. ej. "Pago a proveedor" o "Cotización — Ferretería El Sol". */
  titulo: string;
  /** Nombre del archivo al descargar, sin extensión. */
  nombreArchivo: string;
  construir: () => Promise<jsPDF>;
}

/**
 * Estado de un diálogo de vista previa: `null` cerrado, o la solicitud a armar.
 *
 * Mismo patrón que `useModal`, pero cargando qué construir en vez de un
 * simple booleano: es lo que le hace falta al `<ModalVistaPreviaPdf>` para
 * generar el PDF correcto sin que le importe si es un reporte o una
 * cotización.
 */
export function usePrevisualizarPdf() {
  const [solicitud, setSolicitud] = useState<SolicitudVistaPreviaPdf | null>(null);

  return {
    solicitud,
    abrir: setSolicitud,
    cerrar: () => setSolicitud(null),
  };
}

/**
 * Genera el PDF en cuanto se abre y lo muestra dentro del propio diálogo
 * (visor nativo del navegador vía `blob:`), con la descarga como acción
 * aparte — así el usuario ve exactamente lo que va a descargar antes de
 * guardarlo.
 */
export function ModalVistaPreviaPdf({
  solicitud,
  alCerrar,
}: {
  solicitud: SolicitudVistaPreviaPdf | null;
  alCerrar: () => void;
}) {
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");
  const [url, setUrl] = useState<string | null>(null);
  const docRef = useRef<jsPDF | null>(null);

  useEffect(() => {
    if (!solicitud) return;

    let cancelado = false;
    let urlCreada: string | null = null;
    setEstado("cargando");
    setUrl(null);
    docRef.current = null;

    solicitud
      .construir()
      .then((doc) => {
        if (cancelado) return;
        docRef.current = doc;
        urlCreada = doc.output("bloburl") as unknown as string;
        setUrl(urlCreada);
        setEstado("listo");
      })
      .catch(() => {
        if (!cancelado) setEstado("error");
      });

    return () => {
      cancelado = true;
      if (urlCreada) URL.revokeObjectURL(urlCreada);
    };
  }, [solicitud]);

  function descargar() {
    if (!docRef.current || !solicitud) return;
    docRef.current.save(`${solicitud.nombreArchivo}.pdf`);
  }

  return (
    <Modal
      abierto={Boolean(solicitud)}
      alCerrar={alCerrar}
      titulo={solicitud ? `Vista previa · ${solicitud.titulo}` : "Vista previa"}
      ancho="xl"
      acciones={
        <>
          <Boton variante="contorno" onClick={alCerrar}>
            Cerrar
          </Boton>
          <Boton
            onClick={descargar}
            disabled={estado !== "listo"}
            iconoInicio={<Download size={16} aria-hidden />}
          >
            Descargar PDF
          </Boton>
        </>
      }
    >
      <Box
        sx={{
          display: "flex",
          height: "75vh",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          borderRadius: 2,
          border: 1,
          borderColor: "divider",
        }}
      >
        {estado === "cargando" && <Cargador etiqueta="Generando el PDF…" />}
        {estado === "error" && (
          <Box sx={{ p: 3 }}>
            <Alerta tipo="error" titulo="No se pudo generar el PDF">
              Intenta de nuevo. Si el problema sigue, revisa tu conexión.
            </Alerta>
          </Box>
        )}
        {estado === "listo" && url && (
          <Box component="iframe" src={url} title="Vista previa del PDF" sx={{ width: "100%", height: "100%", border: 0 }} />
        )}
      </Box>
    </Modal>
  );
}
