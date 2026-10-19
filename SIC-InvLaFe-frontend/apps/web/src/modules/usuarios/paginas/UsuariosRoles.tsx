import { Box, Stack } from "@mui/material";
import { ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { EncabezadoPagina } from "../../../shared/ui";
import { PanelRoles } from "../componentes/PanelRoles";
import { PanelUsuarios } from "../componentes/PanelUsuarios";

type Pestana = "usuarios" | "roles";

const PESTANAS = [
  { clave: "usuarios" as const, etiqueta: "Usuarios", icono: Users },
  { clave: "roles" as const, etiqueta: "Roles y permisos", icono: ShieldCheck },
];

export function UsuariosRoles() {
  const [pestana, setPestana] = useState<Pestana>("usuarios");

  return (
    <>
      <EncabezadoPagina
        titulo="Usuarios y roles"
        descripcion="Da de alta usuarios, crea roles y define qué puede hacer cada rol en cada módulo."
      />

      <Stack
        direction="row"
        role="tablist"
        aria-label="Secciones de administración"
        sx={{
          display: "inline-flex",
          mb: 3,
          borderRadius: 3,
          border: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          p: 0.5,
        }}
      >
        {PESTANAS.map(({ clave, etiqueta, icono: Icono }) => (
          <Box
            component="button"
            key={clave}
            type="button"
            role="tab"
            aria-selected={pestana === clave}
            onClick={() => setPestana(clave)}
            sx={[
              {
                display: "flex",
                alignItems: "center",
                gap: 1,
                border: 0,
                cursor: "pointer",
                borderRadius: 2,
                px: 2,
                py: 1,
                fontSize: 14,
                fontWeight: 500,
                transition: "background-color 0.15s, color 0.15s",
              },
              pestana === clave
                ? { bgcolor: "primary.500", color: "primary.contrastText", boxShadow: 1 }
                : {
                    bgcolor: "transparent",
                    color: "text.secondary",
                    "&:hover": { bgcolor: "action.hover" },
                  },
            ]}
          >
            <Icono size={16} aria-hidden />
            {etiqueta}
          </Box>
        ))}
      </Stack>

      {pestana === "usuarios" ? <PanelUsuarios /> : <PanelRoles />}
    </>
  );
}
