import { mensajeDeError } from "@invlafe/core";
import { useCambiarContrasena, useSesion } from "@invlafe/query";
import { Stack, Typography } from "@mui/material";
import { KeyRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { LayoutAuth } from "../../../layout/LayoutAuth";
import { Alerta, Boton, Campo, Cargador, Entrada } from "../../../shared/ui";
import { erroresDeCampo } from "../utiles/errores";

/**
 * Pantalla a la que llega el usuario desde el enlace del correo.
 *
 * Supabase canjea el token de la URL por una sesión temporal antes de que este
 * componente monte (`detectSessionInUrl`), así que aquí basta con comprobar
 * que existe sesión: sin ella el enlace caducó o ya se usó.
 */
export function RestablecerContrasena() {
  const [contrasena, setContrasena] = useState("");
  const [confirmacion, setConfirmacion] = useState("");

  const { data: sesion, isPending } = useSesion();
  const cambiar = useCambiarContrasena();
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

  return (
    <LayoutAuth
      titulo="Nueva contraseña"
      descripcion="Define la contraseña con la que entrarás de ahora en adelante."
    >
      {isPending ? (
        <Cargador etiqueta="Validando el enlace…" />
      ) : !sesion ? (
        <Stack spacing={3}>
          <Alerta tipo="error" titulo="El enlace no es válido">
            Puede haber caducado o haberse usado ya. Solicita uno nuevo desde la
            pantalla de recuperación.
          </Alerta>
          <Typography
            component={Link}
            to="/recuperar-contrasena"
            sx={{
              fontSize: 14,
              fontWeight: 500,
              color: "primary.500",
              textDecoration: "none",
              transition: "color 0.2s",
              "&:hover": { color: "primary.600" },
            }}
          >
            Pedir un enlace nuevo
          </Typography>
        </Stack>
      ) : (
        <Stack component="form" onSubmit={enviar} spacing={2.5} noValidate>
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
            Guardar contraseña
          </Boton>
        </Stack>
      )}
    </LayoutAuth>
  );
}
