import { CONFIG_SESION, mensajeDeError, type ErrorValidacion } from "@invlafe/core";
import { useIniciarSesion } from "@invlafe/query";
import { Box, IconButton, Stack } from "@mui/material";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router";
import { LayoutAuth } from "../../../layout/LayoutAuth";
import { Alerta, Boton, Campo, Entrada } from "../../../shared/ui";
import { erroresDeCampo } from "../utiles/errores";
import { consumirSesionExpirada } from "../utiles/inactividad";

interface EstadoUbicacion {
  desde?: { pathname: string };
}

export function IniciarSesion() {
  const [identificador, setIdentificador] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [verContrasena, setVerContrasena] = useState(false);
  /*
    Se consume en el inicializador, una sola vez: si se leyera en cada render,
    el aviso desaparecería al primer teclazo o reaparecería al recargar.
  */
  const [expiroPorInactividad] = useState(consumirSesionExpirada);

  const iniciarSesion = useIniciarSesion();
  const navegar = useNavigate();
  const ubicacion = useLocation();

  const campos = erroresDeCampo(iniciarSesion.error as ErrorValidacion | null);
  // Un fallo de credenciales no es de campo: se muestra como alerta general.
  const errorGeneral =
    iniciarSesion.error && Object.keys(campos).length === 0
      ? mensajeDeError(iniciarSesion.error)
      : null;

  function enviar(evento: FormEvent) {
    evento.preventDefault();

    iniciarSesion.mutate(
      { identificador, contrasena },
      {
        onSuccess: () => {
          const destino =
            (ubicacion.state as EstadoUbicacion | null)?.desde?.pathname ?? "/";
          navegar(destino, { replace: true });
        },
      },
    );
  }

  return (
    <LayoutAuth
      titulo="Iniciar sesión"
      descripcion="Entra con tu usuario o tu correo y la contraseña que te asignó el administrador."
    >
      <Stack component="form" onSubmit={enviar} spacing={2.5} noValidate>
        {expiroPorInactividad && !errorGeneral && (
          <Alerta tipo="advertencia" titulo="Tu sesión se cerró por inactividad">
            Pasaron {CONFIG_SESION.minutosLimite} minutos sin actividad. Vuelve a
            entrar para seguir trabajando.
          </Alerta>
        )}

        {errorGeneral && <Alerta tipo="error">{errorGeneral}</Alerta>}

        {/*
          `type="text"`, no `type="email"`: el campo acepta las dos cosas y el
          navegador rechazaría un nombre de usuario por no llevar arroba.
        */}
        <Campo etiqueta="Usuario o correo" requerido error={campos.identificador}>
          {(props) => (
            <Entrada
              {...props}
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="tuusuario o tucorreo@ejemplo.com"
              value={identificador}
              error={Boolean(campos.identificador)}
              onChange={(evento) => setIdentificador(evento.target.value)}
            />
          )}
        </Campo>

        <Campo etiqueta="Contraseña" requerido error={campos.contrasena}>
          {(props) => (
            <Box sx={{ position: "relative" }}>
              <Entrada
                {...props}
                type={verContrasena ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Tu contraseña"
                value={contrasena}
                error={Boolean(campos.contrasena)}
                sx={{ "& input": { pr: 6 } }}
                onChange={(evento) => setContrasena(evento.target.value)}
              />
              <IconButton
                type="button"
                onClick={() => setVerContrasena((valor) => !valor)}
                aria-label={
                  verContrasena ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                size="small"
                sx={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "text.disabled",
                  "&:hover": { color: "text.secondary" },
                }}
              >
                {verContrasena ? <EyeOff size={20} /> : <Eye size={20} />}
              </IconButton>
            </Box>
          )}
        </Campo>

        <Boton
          type="submit"
          anchoCompleto
          cargando={iniciarSesion.isPending}
          iconoInicio={<LogIn size={16} aria-hidden />}
        >
          Entrar
        </Boton>
      </Stack>
    </LayoutAuth>
  );
}
