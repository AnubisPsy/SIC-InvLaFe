import { ETIQUETA_MODULO, type ClaveModulo } from "@invlafe/core";
import { usePermisos, useSesion } from "@invlafe/query";
import { Box, Stack, Typography } from "@mui/material";
import { Lock, UserX } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { VigilanteInactividad } from "../modules/auth/componentes/VigilanteInactividad";
import { Alerta, Cargador } from "../shared/ui";

/**
 * Exige sesión iniciada.
 *
 * Guarda la ruta de origen en el `state` para devolver al usuario donde estaba
 * después del login, en vez de dejarlo siempre en el panel de inicio.
 */
export function RutaPrivada() {
  const { data: sesion, isPending } = useSesion();
  const ubicacion = useLocation();

  if (isPending) return <PantallaCarga />;

  if (!sesion) {
    return <Navigate to="/iniciar-sesion" replace state={{ desde: ubicacion }} />;
  }

  /*
    El cambio obligatorio se comprueba antes que los permisos: mientras esté
    pendiente, no hay ninguna pantalla del sistema a la que se pueda entrar.
    La ruta de destino queda fuera de este guardián, así que no hay bucle.
  */
  if (sesion.usuario?.debeCambiarContrasena) {
    return <Navigate to="/cambiar-contrasena" replace />;
  }

  /*
    El vigilante va aquí y no en el layout: así cubre cualquier pantalla con
    sesión, incluidas las que en el futuro se cuelguen fuera de `LayoutApp`, y
    ninguna sin ella.
  */
  return (
    <>
      <VigilanteInactividad />
      <Outlet />
    </>
  );
}

/** Impide volver al login con la sesión ya abierta. */
export function RutaPublica() {
  const { data: sesion, isPending } = useSesion();

  if (isPending) return <PantallaCarga />;
  if (sesion) return <Navigate to="/" replace />;

  return <Outlet />;
}

/**
 * Exige permiso de lectura sobre un módulo.
 *
 * Muestra una explicación en lugar de redirigir: si el usuario llegó por un
 * enlace directo, un salto silencioso al inicio parecería un fallo de la app.
 */
export function RutaModulo({
  modulo,
  children,
}: {
  modulo: ClaveModulo;
  children: ReactNode;
}) {
  const { puedeVer, cargando } = usePermisos();

  if (cargando) return <PantallaCarga />;

  if (!puedeVer(modulo)) {
    return (
      <Box sx={{ mx: "auto", maxWidth: 576, py: 5 }}>
        <Alerta tipo="advertencia" titulo="Sin acceso a este módulo">
          <Stack direction="row" sx={{ alignItems: "flex-start", gap: 1 }}>
            <Box component="span" sx={{ mt: "2px", flexShrink: 0, display: "inline-flex" }}>
              <Lock size={16} aria-hidden />
            </Box>
            <Typography component="span" sx={{ fontSize: "inherit" }}>
              Tu rol no tiene permiso para ver{" "}
              <strong>{ETIQUETA_MODULO[modulo]}</strong>. Pide al administrador
              que lo habilite desde Usuarios y roles.
            </Typography>
          </Stack>
        </Alerta>
      </Box>
    );
  }

  return <>{children}</>;
}

/**
 * Aviso para quien tiene cuenta en Auth pero no una fila utilizable en
 * `usuarios`. Sin esto vería la app entera vacía sin saber por qué.
 */
export function AvisoSinAcceso() {
  const { sinUsuarioDeNegocio, sinAcceso } = usePermisos();

  if (!sinUsuarioDeNegocio && !sinAcceso) return null;

  return (
    <Alerta
      tipo="advertencia"
      titulo={
        sinUsuarioDeNegocio
          ? "Tu cuenta aún no está dada de alta"
          : "Tu cuenta está sin rol o desactivada"
      }
      sx={{ mb: 3 }}
    >
      <Stack direction="row" sx={{ alignItems: "flex-start", gap: 1 }}>
        <Box component="span" sx={{ mt: "2px", flexShrink: 0, display: "inline-flex" }}>
          <UserX size={16} aria-hidden />
        </Box>
        <Typography component="span" sx={{ fontSize: "inherit" }}>
          {sinUsuarioDeNegocio
            ? "Puedes iniciar sesión, pero no hay un usuario del sistema asociado a tu correo. El administrador debe crearlo en Usuarios y roles con ese mismo correo."
            : "El administrador debe activarte y asignarte un rol para que puedas trabajar."}
        </Typography>
      </Stack>
    </Alerta>
  );
}

function PantallaCarga() {
  return (
    <Box sx={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
      <Cargador etiqueta="Cargando tu sesión…" />
    </Box>
  );
}
