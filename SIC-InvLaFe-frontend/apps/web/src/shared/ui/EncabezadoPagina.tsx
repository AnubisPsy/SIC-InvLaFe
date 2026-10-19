import { Box, Breadcrumbs, Link as MuiLink, Stack, Typography } from "@mui/material";
import { ChevronRight } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Link } from "react-router";

/** Fija el `<title>` del documento mientras la pantalla está montada. */
export function useTituloDocumento(titulo: string) {
  useEffect(() => {
    const anterior = document.title;
    document.title = `${titulo} · Inversiones La Fe`;
    return () => {
      document.title = anterior;
    };
  }, [titulo]);
}

export function EncabezadoPagina({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
}) {
  useTituloDocumento(titulo);

  return (
    <Stack
      direction="row"
      sx={{ flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 2, mb: 3 }}
    >
      <Box>
        <Breadcrumbs
          separator={<ChevronRight size={16} aria-hidden />}
          aria-label="Ruta de navegación"
          sx={{ mb: 0.5, fontSize: 14, color: "text.secondary" }}
        >
          <MuiLink component={Link} to="/" underline="hover" color="inherit">
            Inicio
          </MuiLink>
          <Typography sx={{ fontSize: 14, color: "text.primary" }}>{titulo}</Typography>
        </Breadcrumbs>
        <Typography variant="h1" sx={{ fontSize: 20, fontWeight: 600 }}>
          {titulo}
        </Typography>
        {descripcion && (
          <Typography sx={{ mt: 0.5, maxWidth: 640, fontSize: 14, color: "text.secondary" }}>
            {descripcion}
          </Typography>
        )}
      </Box>
      {acciones && (
        <Stack direction="row" sx={{ flexWrap: "wrap", alignItems: "center", gap: 1 }}>
          {acciones}
        </Stack>
      )}
    </Stack>
  );
}
