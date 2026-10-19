import { CONFIG_SESION } from "@invlafe/core";
import { useCerrarSesion, useSesion } from "@invlafe/query";
import { alpha, Box, Stack, Typography } from "@mui/material";
import { Clock } from "lucide-react";
import { useEffect, useRef } from "react";
import { Boton, Modal } from "../../../shared/ui";
import {
  limpiarActividad,
  marcarSesionExpirada,
  useInactividad,
} from "../utiles/inactividad";

function formatearCuentaAtras(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return `${minutos}:${String(resto).padStart(2, "0")}`;
}

/**
 * Cierra la sesión tras una hora sin actividad, avisando antes.
 *
 * Se monta dentro del guardián de rutas privadas, así que vigila todas las
 * pantallas con sesión y ninguna sin ella. El cierre es de verdad —invalida el
 * token en Supabase— y no solo un borrado local: un token vivo en
 * `localStorage` seguiría sirviendo aunque la aplicación hubiera olvidado que
 * existe.
 */
export function VigilanteInactividad() {
  const { data: sesion } = useSesion();
  // Se toma `mutate` suelto porque es estable entre renders; el objeto de la
  // mutación no lo es, y como dependencia relanzaría el efecto en cada uno.
  const { mutate: cerrarSesion } = useCerrarSesion();
  const { fase, segundosRestantes, reanudar } = useInactividad(Boolean(sesion));

  // El cierre solo puede dispararse una vez: la fase sigue en "expirada"
  // durante los renders que tarda la mutación en resolverse.
  const cerrando = useRef(false);

  useEffect(() => {
    if (fase !== "expirada" || cerrando.current) return;

    cerrando.current = true;
    limpiarActividad();
    marcarSesionExpirada();

    // Sin `onError`: si la red falla, la caché ya se limpió y el guardián
    // devuelve al login igualmente.
    cerrarSesion();
  }, [fase, cerrarSesion]);

  useEffect(() => {
    if (!sesion) cerrando.current = false;
  }, [sesion]);

  return (
    <Modal
      abierto={fase === "avisando"}
      alCerrar={reanudar}
      titulo="¿Sigues ahí?"
      descripcion={`Tu sesión se cerrará por seguridad tras ${CONFIG_SESION.minutosLimite} minutos sin actividad.`}
      ancho="sm"
      acciones={
        <Boton onClick={reanudar} anchoCompleto>
          Sigo aquí
        </Boton>
      }
    >
      <Stack sx={{ alignItems: "center", gap: 1.5, py: 1, textAlign: "center" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            borderRadius: "50%",
            bgcolor: (tema) => alpha(tema.palette.warning.main, 0.12),
            color: "warning.main",
          }}
        >
          <Clock size={24} aria-hidden />
        </Box>
        <Typography
          sx={{
            fontSize: 30,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            color: "text.primary",
          }}
          aria-live="polite"
        >
          {formatearCuentaAtras(segundosRestantes)}
        </Typography>
        <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
          Pulsa «Sigo aquí» para seguir trabajando. Si no, tendrás que volver a
          entrar y perderás lo que no hayas guardado.
        </Typography>
      </Stack>
    </Modal>
  );
}
