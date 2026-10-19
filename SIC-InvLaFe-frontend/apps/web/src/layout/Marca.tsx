import { Box, Stack, Typography } from "@mui/material";
import logo from "../assets/logo-inversioneslafe.png";

/**
 * Identidad visual del sistema.
 *
 * Es un componente y no un `<img>` suelto en cada pantalla para poder
 * colapsarlo a solo el isotipo cuando la barra lateral está contraída.
 */
export function Marca({
  soloIsotipo = false,
  className,
}: {
  soloIsotipo?: boolean;
  className?: string;
}) {
  return (
    <Stack direction="row" className={className} sx={{ alignItems: "center", gap: 1.25 }}>
      <Box
        sx={{
          display: "flex",
          flexShrink: 0,
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          overflow: "hidden",
          borderRadius: 3,
          bgcolor: "#fff",
          border: 1,
          borderColor: "divider",
        }}
      >
        <Box component="img" src={logo} alt="Inversiones La Fe" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </Box>
      {!soloIsotipo && (
        <Stack sx={{ lineHeight: 1.2 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600 }}>Inversiones La Fe</Typography>
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>Control de inventario</Typography>
        </Stack>
      )}
    </Stack>
  );
}
