import { usePermisos } from "@invlafe/query";
import { alpha, Box, Stack, Typography } from "@mui/material";
import { MoreHorizontal } from "lucide-react";
import { NavLink } from "react-router";
import { NAVEGACION, RUTA_INICIO } from "../app/navegacion";
import { useBarraLateral } from "../contextos/BarraLateralContexto";
import { Marca } from "./Marca";

const ANCHO_EXPANDIDA = 280;
const ANCHO_COLAPSADA = 88;

export function BarraLateral() {
  const { expandida, abiertaMovil, sobrevolada, setSobrevolada, cerrarMovil } =
    useBarraLateral();
  const { puedeVer } = usePermisos();

  // El menú solo lista lo que el rol puede ver: esconder la entrada evita que
  // el usuario navegue a una pantalla que RLS le va a devolver vacía.
  const visibles = NAVEGACION.filter((entrada) => puedeVer(entrada.modulo));
  const mostrarTexto = expandida || sobrevolada || abiertaMovil;

  return (
    <Box
      component="aside"
      onMouseEnter={() => !expandida && setSobrevolada(true)}
      onMouseLeave={() => setSobrevolada(false)}
      sx={{
        position: "fixed",
        left: 0,
        top: 0,
        zIndex: 50,
        display: "flex",
        height: "100vh",
        flexDirection: "column",
        borderRight: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        px: 2,
        width: mostrarTexto ? ANCHO_EXPANDIDA : ANCHO_COLAPSADA,
        transition: (tema) => tema.transitions.create(["width", "transform"]),
        transform: { xs: abiertaMovil ? "translateX(0)" : "translateX(-100%)", lg: "translateX(0)" },
      }}
    >
      <Box
        sx={{
          display: "flex",
          height: 64,
          flexShrink: 0,
          alignItems: "center",
          justifyContent: mostrarTexto ? "flex-start" : "center",
        }}
      >
        <NavLink to="/" onClick={cerrarMovil}>
          <Marca soloIsotipo={!mostrarTexto} />
        </NavLink>
      </Box>

      <Stack
        component="nav"
        className="no-scrollbar"
        sx={{ flex: 1, gap: 0.5, overflowY: "auto", pb: 3 }}
      >
        <Box
          sx={{
            mb: 1,
            mt: 2,
            display: "flex",
            justifyContent: mostrarTexto ? "flex-start" : "center",
            px: mostrarTexto ? 1.5 : 0,
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            color: "text.disabled",
          }}
        >
          {mostrarTexto ? "Menú" : <MoreHorizontal size={20} aria-hidden />}
        </Box>

        <EnlaceMenu
          to={RUTA_INICIO.ruta}
          icono={<RUTA_INICIO.icono size={20} aria-hidden />}
          etiqueta={RUTA_INICIO.etiqueta}
          mostrarTexto={mostrarTexto}
          alNavegar={cerrarMovil}
          exacta
        />

        {visibles.map((entrada) => (
          <EnlaceMenu
            key={entrada.modulo}
            to={entrada.ruta}
            icono={<entrada.icono size={20} aria-hidden />}
            etiqueta={entrada.etiqueta}
            mostrarTexto={mostrarTexto}
            alNavegar={cerrarMovil}
          />
        ))}

        {visibles.length === 0 && mostrarTexto && (
          <Typography sx={{ px: 1.5, py: 2, fontSize: 12, lineHeight: 1.6, color: "text.secondary" }}>
            Tu rol todavía no tiene módulos asignados. Pide al administrador que
            configure tus permisos.
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

function EnlaceMenu({
  to,
  icono,
  etiqueta,
  mostrarTexto,
  alNavegar,
  exacta = false,
}: {
  to: string;
  icono: React.ReactNode;
  etiqueta: string;
  mostrarTexto: boolean;
  alNavegar: () => void;
  exacta?: boolean;
}) {
  return (
    <Box
      component={NavLink}
      to={to}
      end={exacta}
      onClick={alNavegar}
      title={mostrarTexto ? undefined : etiqueta}
      sx={{
        position: "relative",
        display: "flex",
        width: "100%",
        alignItems: "center",
        justifyContent: mostrarTexto ? "flex-start" : "center",
        gap: 1.5,
        borderRadius: 2,
        px: 1.5,
        py: 1,
        fontSize: 14,
        fontWeight: 500,
        textDecoration: "none",
        color: "text.secondary",
        "&:hover": { bgcolor: "action.hover", color: "text.primary" },
        "&.active": {
          bgcolor: (tema) => alpha(tema.palette.primary.main, tema.palette.mode === "light" ? 0.08 : 0.16),
          color: "primary.main",
        },
      }}
    >
      <Box
        component="span"
        sx={{
          display: "flex",
          color: "inherit",
        }}
      >
        {icono}
      </Box>
      {mostrarTexto && (
        <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {etiqueta}
        </Box>
      )}
    </Box>
  );
}
