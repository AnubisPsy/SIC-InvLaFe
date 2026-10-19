import { Box, IconButton, Stack, Typography } from "@mui/material";
import { Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { useTema } from "../contextos/TemaContexto";
import { Marca } from "./Marca";

/**
 * Marco de las pantallas sin sesión (login y recuperación).
 *
 * Dos columnas en escritorio: el formulario a la izquierda y un panel de marca
 * a la derecha que desaparece por debajo de `lg`, donde el formulario ocupa
 * todo el ancho.
 */
export function LayoutAuth({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion: string;
  children: ReactNode;
}) {
  const { tema, alternar } = useTema();

  return (
    <Stack
      direction={{ xs: "column", lg: "row" }}
      sx={{ position: "relative", minHeight: "100vh", bgcolor: "background.paper" }}
    >
      <Stack sx={{ flex: 1, justifyContent: "center", px: { xs: 3, sm: 5 }, py: 6 }}>
        <Box sx={{ mx: "auto", width: "100%", maxWidth: 420 }}>
          <Box sx={{ mb: 4, display: { lg: "none" } }}>
            <Marca />
          </Box>

          <Typography variant="h1" sx={{ fontSize: 30, fontWeight: 600 }}>
            {titulo}
          </Typography>
          <Typography sx={{ mt: 1, fontSize: 14, color: "text.secondary" }}>
            {descripcion}
          </Typography>

          <Box sx={{ mt: 4 }}>{children}</Box>
        </Box>
      </Stack>

      <Stack
        sx={{
          alignItems: "center",
          justifyContent: "center",
          display: { xs: "none", lg: "flex" },
          width: "50%",
          bgcolor: "#161950",
          p: 6,
        }}
      >
        <Box sx={{ maxWidth: 340, textAlign: "center" }}>
          <Box
            sx={{
              mx: "auto",
              display: "flex",
              width: 64,
              height: 64,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 4,
              bgcolor: "rgba(255,255,255,0.1)",
            }}
          >
            <Marca soloIsotipo />
          </Box>
          <Typography sx={{ mt: 3, fontSize: 30, fontWeight: 600, color: "#fff" }}>
            Inversiones La Fe
          </Typography>
          <Typography sx={{ mt: 1.5, fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.6)" }}>
            Control de compras, despachos, cobros y cuadre de inventario de
            combustible en un solo lugar.
          </Typography>
        </Box>
      </Stack>

      <IconButton
        onClick={alternar}
        aria-label={tema === "claro" ? "Activar modo oscuro" : "Activar modo claro"}
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 50,
          bgcolor: "grey.800",
          color: "#fff",
          boxShadow: 6,
          "&:hover": { bgcolor: "grey.700" },
        }}
      >
        {tema === "claro" ? <Moon size={20} /> : <Sun size={20} />}
      </IconButton>
    </Stack>
  );
}
