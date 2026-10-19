import { alpha, Box, Card, Stack, Typography, type SxProps, type Theme } from "@mui/material";
import type { ReactNode } from "react";

export function Tarjeta({
  titulo,
  descripcion,
  acciones,
  children,
  className,
  sx,
  sinRelleno = false,
}: {
  titulo?: string;
  descripcion?: string;
  acciones?: ReactNode;
  children: ReactNode;
  className?: string;
  sx?: SxProps<Theme>;
  /** Para tarjetas que envuelven una tabla, que ya trae su propio borde. */
  sinRelleno?: boolean;
}) {
  return (
    <Card className={className} sx={[{ borderRadius: 4 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {(titulo || acciones) && (
        <Stack
          direction="row"
          sx={{
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.5,
            borderBottom: 1,
            borderColor: "divider",
            px: { xs: 2.5, sm: 3 },
            py: 2,
          }}
        >
          <Box>
            {titulo && (
              <Typography sx={{ fontSize: 16, fontWeight: 500 }}>{titulo}</Typography>
            )}
            {descripcion && (
              <Typography sx={{ mt: 0.5, fontSize: 14, color: "text.secondary" }}>
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
      )}
      <Box sx={sinRelleno ? undefined : { p: { xs: 2.5, sm: 3 } }}>{children}</Box>
    </Card>
  );
}

/** Tarjeta de métrica del panel: icono, etiqueta, valor y nota opcional. */
export function TarjetaMetrica({
  icono,
  etiqueta,
  valor,
  nota,
  tono = "neutro",
}: {
  icono: ReactNode;
  etiqueta: string;
  valor: string;
  nota?: ReactNode;
  tono?: "neutro" | "exito" | "advertencia" | "error";
}) {
  const tonos = {
    neutro: (tema: import("@mui/material").Theme) => ({
      bgcolor: tema.palette.action.selected,
      color: tema.palette.text.primary,
    }),
    exito: (tema: import("@mui/material").Theme) => ({
      bgcolor: alpha(tema.palette.success.main, 0.12),
      color: tema.palette.success.main,
    }),
    advertencia: (tema: import("@mui/material").Theme) => ({
      bgcolor: alpha(tema.palette.warning.main, 0.12),
      color: tema.palette.warning.main,
    }),
    error: (tema: import("@mui/material").Theme) => ({
      bgcolor: alpha(tema.palette.error.main, 0.12),
      color: tema.palette.error.main,
    }),
  } as const;

  return (
    <Stack
      direction="row"
      sx={{
        alignItems: "flex-start",
        gap: 1.5,
        borderRadius: 3,
        border: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        p: 2,
      }}
    >
      <Box
        sx={[
          {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            width: 36,
            height: 36,
            borderRadius: 2,
          },
          tonos[tono],
        ]}
      >
        {icono}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: 12, color: "text.secondary" }}>
          {etiqueta}
        </Typography>
        <Typography sx={{ mt: 0.25, fontSize: 20, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {valor}
        </Typography>
        {nota && (
          <Box
            sx={{
              mt: 0.5,
              fontSize: 12,
              color: "text.secondary",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {nota}
          </Box>
        )}
      </Box>
    </Stack>
  );
}
