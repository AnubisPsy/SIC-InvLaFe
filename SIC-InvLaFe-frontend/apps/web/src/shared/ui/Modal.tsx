import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  type DialogProps,
} from "@mui/material";
import { X } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";

export function useModal(inicial = false) {
  const [abierto, setAbierto] = useState(inicial);

  const abrir = useCallback(() => setAbierto(true), []);
  const cerrar = useCallback(() => setAbierto(false), []);

  return { abierto, abrir, cerrar };
}

export interface PropsModal {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  descripcion?: string;
  children: ReactNode;
  /** Botonera inferior; se separa del cuerpo para que quede fija bajo el scroll. */
  acciones?: ReactNode;
  ancho?: "sm" | "md" | "lg" | "xl";
}

const ANCHO_A_MUI: Record<NonNullable<PropsModal["ancho"]>, DialogProps["maxWidth"]> = {
  sm: "xs",
  md: "sm",
  lg: "md",
  xl: "lg",
};

export function Modal({
  abierto,
  alCerrar,
  titulo,
  descripcion,
  children,
  acciones,
  ancho = "md",
}: PropsModal) {
  return (
    <Dialog
      open={abierto}
      onClose={alCerrar}
      fullWidth
      maxWidth={ANCHO_A_MUI[ancho]}
      aria-label={titulo}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
        <div>
          <Typography sx={{ fontSize: 16, fontWeight: 600 }}>{titulo}</Typography>
          {descripcion && (
            <Typography sx={{ mt: 0.5, fontSize: 14, color: "text.secondary" }}>
              {descripcion}
            </Typography>
          )}
        </div>
        <IconButton aria-label="Cerrar" onClick={alCerrar} size="small" sx={{ mt: -0.5, mr: -1 }}>
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers className="custom-scrollbar">
        {children}
      </DialogContent>

      {acciones && (
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Stack direction={{ xs: "column-reverse", sm: "row" }} sx={{ gap: 1, width: { xs: "100%", sm: "auto" } }}>
            {acciones}
          </Stack>
        </DialogActions>
      )}
    </Dialog>
  );
}
