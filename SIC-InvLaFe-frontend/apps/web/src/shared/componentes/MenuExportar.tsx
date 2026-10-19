import { alpha, Box, CircularProgress, ListItemIcon, Menu, MenuItem } from "@mui/material";
import { ChevronDown, FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { Boton } from "../ui";

/**
 * Botón "Exportar" con un menú de dos formatos, PDF y Excel.
 */
export function MenuExportar({
  deshabilitado = false,
  alElegirPdf,
  alElegirExcel,
}: {
  deshabilitado?: boolean;
  alElegirPdf: () => void | Promise<void>;
  alElegirExcel: () => void | Promise<void>;
}) {
  const [anclaje, setAnclaje] = useState<HTMLElement | null>(null);
  const [procesando, setProcesando] = useState(false);

  async function elegir(accion: () => void | Promise<void>) {
    setAnclaje(null);
    setProcesando(true);
    try {
      await accion();
    } finally {
      setProcesando(false);
    }
  }

  const bloqueado = deshabilitado || procesando;

  return (
    <>
      <Boton
        variante="contorno"
        disabled={bloqueado}
        aria-haspopup="menu"
        aria-expanded={Boolean(anclaje)}
        onClick={(evento) => setAnclaje(evento.currentTarget)}
        iconoInicio={
          procesando ? (
            <CircularProgress size={16} />
          ) : (
            <ChevronDown
              size={16}
              style={{ transition: "transform 0.2s", transform: anclaje ? "rotate(180deg)" : undefined }}
              aria-hidden
            />
          )
        }
      >
        Exportar
      </Boton>

      <Menu
        anchorEl={anclaje}
        open={Boolean(anclaje)}
        onClose={() => setAnclaje(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { width: 176 } } }}
      >
        <MenuItem onClick={() => elegir(alElegirPdf)}>
          <ListItemIcon>
            <Box
              sx={{
                display: "flex",
                width: 32,
                height: 32,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 2,
                bgcolor: (tema) => alpha(tema.palette.error.main, 0.12),
                color: "error.main",
              }}
            >
              <FileText size={16} aria-hidden />
            </Box>
          </ListItemIcon>
          PDF
        </MenuItem>
        <MenuItem onClick={() => elegir(alElegirExcel)} divider sx={{ borderTop: 1, borderColor: "divider" }}>
          <ListItemIcon>
            <Box
              sx={{
                display: "flex",
                width: 32,
                height: 32,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 2,
                bgcolor: (tema) => alpha(tema.palette.success.main, 0.12),
                color: "success.main",
              }}
            >
              <FileSpreadsheet size={16} aria-hidden />
            </Box>
          </ListItemIcon>
          Excel
        </MenuItem>
      </Menu>
    </>
  );
}
