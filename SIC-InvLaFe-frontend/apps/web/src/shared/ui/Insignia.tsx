import { Chip, alpha, type SxProps, type Theme } from "@mui/material";
import type { ReactNode } from "react";

export type ColorInsignia =
  | "primario"
  | "exito"
  | "error"
  | "advertencia"
  | "info"
  | "neutro";

const TONOS: Record<ColorInsignia, (tema: Theme) => { bgcolor: string; color: string }> = {
  primario: (tema) => ({ bgcolor: alpha(tema.palette.primary.main, 0.1), color: tema.palette.primary.main }),
  exito: (tema) => ({ bgcolor: alpha(tema.palette.success.main, 0.12), color: tema.palette.success.main }),
  error: (tema) => ({ bgcolor: alpha(tema.palette.error.main, 0.12), color: tema.palette.error.main }),
  advertencia: (tema) => ({ bgcolor: alpha(tema.palette.warning.main, 0.12), color: tema.palette.warning.main }),
  info: (tema) => ({ bgcolor: alpha(tema.palette.info.main, 0.12), color: tema.palette.info.main }),
  neutro: (tema) => ({ bgcolor: tema.palette.action.selected, color: tema.palette.text.secondary }),
};

export function Insignia({
  color = "neutro",
  icono,
  children,
  className,
  sx,
}: {
  color?: ColorInsignia;
  icono?: ReactNode;
  children: ReactNode;
  className?: string;
  sx?: SxProps<Theme>;
}) {
  return (
    <Chip
      className={className}
      size="small"
      icon={icono as React.ReactElement | undefined}
      label={children}
      sx={[
        { fontSize: 12, height: 22, "& .MuiChip-label": { px: 1 } },
        TONOS[color],
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  );
}
