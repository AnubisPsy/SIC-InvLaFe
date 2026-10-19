import { mensajeDeError } from "@invlafe/core";
import { useCambiarContrasenaObligatoria, useCerrarSesion, useSesion } from "@invlafe/query";
import { Box, Stack, Typography } from "@mui/material";
import { KeyRound, ShieldAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { LayoutAuth } from "../../../layout/LayoutAuth";
import { Alerta, Boton, Campo, Cargador, Entrada } from "../../../shared/ui";
import { erroresDeCampo } from "../utiles/errores";
import { limpiarActividad } from "../utiles/inactividad";

/**
 * Cambio de contraseña obligatorio antes de poder usar la aplicación.
 *
 * Aparece cuando el administrador marcó el usuario al darlo de alta: la
 * contraseña inicial la eligió otra persona, así que hasta que se sustituya hay
 * dos que la conocen.
 *
 * Es hermana de `RestablecerContrasena`, pero no la misma pantalla: aquella se
 * abre desde el enlace del correo y su duda es si el enlace sigue siendo
 * válido; esta se abre con una sesión normal y su trabajo es no dejar salir a
 * ningún sitio que no sea cerrar sesión.
 */
export function CambiarContrasenaInicial() {
  const [contrasena, setContrasena] = useState("");
  const [confirmacion, setConfirmacion] = useState("");

  const { data: sesion, isPending } = useSesion();
  const cambiar = useCambiarContrasenaObligatoria();
  const cerrarSesion = useCerrarSesion();
  const navegar = useNavigate();

  const campos = erroresDeCampo(cambiar.error);
  const errorGeneral =
    cambiar.error && Object.keys(campos).length === 0
      ? mensajeDeError(cambiar.error)
      : null;

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    cambiar.mutate(
      { nueva: contrasena, confirmacion },
      { onSuccess: () => navegar("/", { replace: true }) },
    );
  }

  if (isPending) {
    return (
      <LayoutAuth titulo="Nueva contraseña" descripcion="Comprobando tu sesión…">
        <Cargador etiqueta="Cargando tu sesión…" />
      </LayoutAuth>
    );
  }

  if (!sesion) return <Navigate to="/iniciar-sesion" replace />;

  // Sin cambio pendiente esta pantalla no pinta nada: se llegó por la barra de
  // direcciones o el cambio ya se completó en otra pestaña.
  if (!sesion.usuario?.debeCambiarContrasena) return <Navigate to="/" replace />;

  return (
    <LayoutAuth
      titulo="Cambia tu contraseña"
      descripcion="Es tu primer acceso: define una contraseña que solo conozcas tú."
    >
      <Stack component="form" onSubmit={enviar} spacing={2.5} noValidate>
        <Alerta tipo="advertencia">
          <Stack direction="row" sx={{ alignItems: "flex-start", gap: 1 }}>
            <Box component="span" sx={{ mt: "2px", flexShrink: 0, display: "inline-flex" }}>
              <ShieldAlert size={16} aria-hidden />
            </Box>
            <Typography component="span" sx={{ fontSize: "inherit" }}>
              La contraseña con la que entraste la fijó el administrador, así que
              él también la conoce. Cámbiala para poder continuar.
            </Typography>
          </Stack>
        </Alerta>

        {errorGeneral && <Alerta tipo="error">{errorGeneral}</Alerta>}

        <Campo
          etiqueta="Nueva contraseña"
          requerido
          error={campos.contrasena}
          ayuda="Mínimo 8 caracteres."
        >
          {(props) => (
            <Entrada
              {...props}
              type="password"
              autoComplete="new-password"
              value={contrasena}
              error={Boolean(campos.contrasena)}
              onChange={(evento) => setContrasena(evento.target.value)}
            />
          )}
        </Campo>

        <Campo etiqueta="Repite la contraseña" requerido error={campos.confirmacion}>
          {(props) => (
            <Entrada
              {...props}
              type="password"
              autoComplete="new-password"
              value={confirmacion}
              error={Boolean(campos.confirmacion)}
              onChange={(evento) => setConfirmacion(evento.target.value)}
            />
          )}
        </Campo>

        <Boton
          type="submit"
          anchoCompleto
          cargando={cambiar.isPending}
          iconoInicio={<KeyRound size={16} aria-hidden />}
        >
          Guardar y continuar
        </Boton>

        {/*
          Única salida que no es cambiar la contraseña. Sin esto, quien abra la
          sesión de otra persona por error queda encerrado en esta pantalla.
        */}
        <Typography
          component="button"
          type="button"
          onClick={() => {
            limpiarActividad();
            cerrarSesion.mutate();
          }}
          sx={{
            width: "100%",
            textAlign: "center",
            fontSize: 14,
            fontWeight: 500,
            color: "text.secondary",
            bgcolor: "transparent",
            border: 0,
            cursor: "pointer",
            transition: "color 0.2s",
            "&:hover": { color: "text.primary" },
          }}
        >
          Cerrar sesión
        </Typography>
      </Stack>
    </LayoutAuth>
  );
}
