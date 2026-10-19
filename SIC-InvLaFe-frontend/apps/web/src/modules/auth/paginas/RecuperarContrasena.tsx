import { mensajeDeError } from "@invlafe/core";
import { useEnviarCorreoRecuperacion } from "@invlafe/query";
import { Box, Stack, Typography } from "@mui/material";
import { ArrowLeft, MailCheck, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { leerEntorno } from "../../../config/entorno";
import { LayoutAuth } from "../../../layout/LayoutAuth";
import { Alerta, Boton, Campo, Entrada } from "../../../shared/ui";
import { erroresDeCampo } from "../utiles/errores";

export function RecuperarContrasena() {
  const [correo, setCorreo] = useState("");
  const enviarCorreo = useEnviarCorreoRecuperacion();

  const campos = erroresDeCampo(enviarCorreo.error);
  const errorGeneral =
    enviarCorreo.error && Object.keys(campos).length === 0
      ? mensajeDeError(enviarCorreo.error)
      : null;

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    enviarCorreo.mutate({
      correo,
      urlRedireccion: leerEntorno().urlRestablecerContrasena,
    });
  }

  return (
    <LayoutAuth
      titulo="Recuperar contraseña"
      descripcion="Te enviamos un enlace para que definas una contraseña nueva."
    >
      {enviarCorreo.isSuccess ? (
        <Stack spacing={3}>
          <Alerta tipo="exito" titulo="Revisa tu correo">
            <Stack direction="row" sx={{ alignItems: "flex-start", gap: 1 }}>
              <Box component="span" sx={{ mt: "2px", flexShrink: 0, display: "inline-flex" }}>
                <MailCheck size={16} aria-hidden />
              </Box>
              <Typography component="span" sx={{ fontSize: "inherit" }}>
                Si <strong>{correo}</strong> corresponde a una cuenta registrada,
                recibirás un enlace para restablecer la contraseña. Revisa
                también la carpeta de spam.
              </Typography>
            </Stack>
          </Alerta>
          <VolverAlLogin />
        </Stack>
      ) : (
        <Stack component="form" onSubmit={enviar} spacing={2.5} noValidate>
          {errorGeneral && <Alerta tipo="error">{errorGeneral}</Alerta>}

          <Campo etiqueta="Correo" requerido error={campos.correo}>
            {(props) => (
              <Entrada
                {...props}
                type="email"
                autoComplete="username"
                placeholder="tucorreo@ejemplo.com"
                value={correo}
                error={Boolean(campos.correo)}
                onChange={(evento) => setCorreo(evento.target.value)}
              />
            )}
          </Campo>

          <Boton
            type="submit"
            anchoCompleto
            cargando={enviarCorreo.isPending}
            iconoInicio={<Send size={16} aria-hidden />}
          >
            Enviar enlace
          </Boton>

          <VolverAlLogin />
        </Stack>
      )}
    </LayoutAuth>
  );
}

function VolverAlLogin() {
  return (
    <Box
      component={Link}
      to="/iniciar-sesion"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        fontSize: 14,
        fontWeight: 500,
        color: "text.secondary",
        textDecoration: "none",
        transition: "color 0.2s",
        "&:hover": { color: "text.primary" },
      }}
    >
      <ArrowLeft size={16} aria-hidden />
      Volver a iniciar sesión
    </Box>
  );
}
