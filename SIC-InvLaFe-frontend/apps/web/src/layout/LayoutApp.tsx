import { Box } from "@mui/material";
import { Outlet } from "react-router";
import {
  ProveedorBarraLateral,
  useBarraLateral,
} from "../contextos/BarraLateralContexto";
import { BarraLateral } from "./BarraLateral";
import { Cortina, Encabezado } from "./Encabezado";

function Contenido() {
  const { expandida, sobrevolada } = useBarraLateral();
  const anchoBarra = expandida || sobrevolada;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <BarraLateral />
      <Cortina />

      <Box
        sx={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          transition: (tema) => tema.transitions.create("margin-left"),
          // El margen solo existe en escritorio: en móvil la barra flota encima.
          ml: { xs: 0, lg: anchoBarra ? "280px" : "88px" },
        }}
      >
        <Encabezado />
        <Box component="main" sx={{ mx: "auto", width: "100%", maxWidth: "1536px", flex: 1, p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}

export function LayoutApp() {
  return (
    <ProveedorBarraLateral>
      <Contenido />
    </ProveedorBarraLateral>
  );
}
