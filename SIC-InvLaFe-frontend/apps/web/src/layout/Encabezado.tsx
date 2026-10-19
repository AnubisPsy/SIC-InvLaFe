import { iniciales } from "@invlafe/core";
import { useCerrarSesion, useSesion } from "@invlafe/query";
import {
  Avatar,
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import { LogOut, Menu as MenuIcon, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { limpiarActividad } from "../modules/auth/utiles/inactividad";
import { useBarraLateral } from "../contextos/BarraLateralContexto";
import { useTema } from "../contextos/TemaContexto";

export function Encabezado() {
  const { abiertaMovil, alternar, alternarMovil } = useBarraLateral();
  const { tema, alternar: alternarTema } = useTema();

  return (
    <Stack
      component="header"
      direction="row"
      sx={{
        alignItems: "center",
        gap: 1.5,
        position: "sticky",
        top: 0,
        zIndex: 40,
        height: 64,
        width: "100%",
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        px: { xs: 2, sm: 3 },
      }}
    >
      <IconButton
        onClick={alternarMovil}
        aria-label={abiertaMovil ? "Cerrar menú" : "Abrir menú"}
        sx={{ display: { lg: "none" } }}
      >
        <MenuIcon size={20} />
      </IconButton>

      <IconButton
        onClick={alternar}
        aria-label="Alternar menú"
        sx={{ display: { xs: "none", lg: "flex" }, border: 1, borderColor: "divider", borderRadius: 2 }}
      >
        <MenuIcon size={20} />
      </IconButton>

      <Stack direction="row" sx={{ alignItems: "center", gap: 1, ml: "auto" }}>
        <IconButton
          onClick={alternarTema}
          aria-label={tema === "claro" ? "Activar modo oscuro" : "Activar modo claro"}
          sx={{ border: 1, borderColor: "divider", borderRadius: 2 }}
        >
          {tema === "claro" ? <Moon size={20} /> : <Sun size={20} />}
        </IconButton>

        <MenuUsuario />
      </Stack>
    </Stack>
  );
}

function MenuUsuario() {
  const { data: sesion } = useSesion();
  const cerrarSesion = useCerrarSesion();
  const navegar = useNavigate();
  const [anclaje, setAnclaje] = useState<HTMLElement | null>(null);

  const nombre = sesion?.usuario?.nombre ?? sesion?.auth.correo ?? "Usuario";
  const rol = sesion?.usuario?.rol?.nombre;

  return (
    <>
      <Stack
        component="button"
        type="button"
        direction="row"
        onClick={(evento: React.MouseEvent<HTMLButtonElement>) => setAnclaje(evento.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={Boolean(anclaje)}
        sx={{
          alignItems: "center",
          gap: 1.25,
          border: 0,
          bgcolor: "transparent",
          borderRadius: 2,
          py: 0.5,
          pl: 0.5,
          pr: 1,
          cursor: "pointer",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Avatar sx={{ width: 36, height: 36, fontSize: 14, fontWeight: 600, bgcolor: "primary.main" }}>
          {iniciales(nombre)}
        </Avatar>
        <Box sx={{ display: { xs: "none", sm: "block" }, textAlign: "left" }}>
          <Typography noWrap sx={{ maxWidth: 160, fontSize: 14, fontWeight: 500, color: "text.primary" }}>
            {nombre}
          </Typography>
          {rol && (
            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{rol}</Typography>
          )}
        </Box>
      </Stack>

      <Menu
        anchorEl={anclaje}
        open={Boolean(anclaje)}
        onClose={() => setAnclaje(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { width: 240 } } }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography noWrap sx={{ fontSize: 14, fontWeight: 500 }}>
            {nombre}
          </Typography>
          <Typography noWrap sx={{ fontSize: 12, color: "text.secondary" }}>
            {sesion?.auth.correo}
          </Typography>
        </Box>
        <Divider />
        <MenuItem
          disabled={cerrarSesion.isPending}
          onClick={() => {
            // Sin esto, la marca de actividad sobreviviría al cierre y quien
            // volviera a entrar una hora después caducaría al instante.
            limpiarActividad();
            cerrarSesion.mutate(undefined, {
              onSuccess: () => navegar("/iniciar-sesion", { replace: true }),
            });
          }}
        >
          <ListItemIcon>
            <LogOut size={16} />
          </ListItemIcon>
          Cerrar sesión
        </MenuItem>
      </Menu>
    </>
  );
}

/** Capa oscura tras la barra lateral en móvil. */
export function Cortina() {
  const { abiertaMovil, cerrarMovil } = useBarraLateral();
  if (!abiertaMovil) return null;

  return (
    <Box
      component="button"
      type="button"
      aria-label="Cerrar menú"
      onClick={cerrarMovil}
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        border: 0,
        bgcolor: "rgba(16, 24, 40, 0.4)",
        backdropFilter: "blur(2px)",
        display: { lg: "none" },
      }}
    />
  );
}
