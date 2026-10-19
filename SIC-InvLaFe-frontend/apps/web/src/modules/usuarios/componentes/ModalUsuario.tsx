import {
  AYUDA_NOMBRE_USUARIO,
  LARGO_MINIMO_CONTRASENA,
  mensajeDeError,
  type UsuarioDetalle,
} from "@invlafe/core";
import { useActualizarUsuario, useCrearUsuario, useRoles } from "@invlafe/query";
import { Box, Stack, Typography } from "@mui/material";
import { useEffect, useState, type FormEvent } from "react";
import {
  Alerta,
  Boton,
  Campo,
  Casilla,
  Entrada,
  Modal,
  Selector,
} from "../../../shared/ui";
import { erroresDeCampo } from "../../auth/utiles/errores";

const VACIO = {
  nombre: "",
  correo: "",
  usuario: "",
  telefono: "",
  rolId: "",
  activo: true,
  contrasena: "",
  // Marcado por defecto al crear: la contraseña del alta la elige el
  // administrador, así que hasta que el usuario la cambie hay dos que la saben.
  debeCambiarContrasena: true,
};

export function ModalUsuario({
  abierto,
  usuario,
  alCerrar,
}: {
  abierto: boolean;
  usuario: UsuarioDetalle | null;
  alCerrar: () => void;
}) {
  const [formulario, setFormulario] = useState(VACIO);

  const roles = useRoles();
  const crear = useCrearUsuario();
  const actualizar = useActualizarUsuario();

  const mutacion = usuario ? actualizar : crear;
  const campos = erroresDeCampo(mutacion.error);
  const errorGeneral =
    mutacion.error && Object.keys(campos).length === 0
      ? mensajeDeError(mutacion.error)
      : null;

  useEffect(() => {
    if (!abierto) return;

    setFormulario(
      usuario
        ? {
            nombre: usuario.nombre,
            correo: usuario.correo,
            usuario: usuario.usuario ?? "",
            telefono: usuario.telefono ?? "",
            rolId: usuario.rolId ?? "",
            activo: usuario.activo,
            // Nunca se precarga: el sistema no conoce la contraseña actual,
            // solo puede reemplazarla.
            contrasena: "",
            debeCambiarContrasena: usuario.debeCambiarContrasena,
          }
        : VACIO,
    );
  }, [abierto, usuario]);

  function cerrarYLimpiar() {
    crear.reset();
    actualizar.reset();
    alCerrar();
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();

    const datos = {
      nombre: formulario.nombre,
      correo: formulario.correo,
      // En blanco significa «sin nombre de usuario»: entrará solo por correo.
      usuario: formulario.usuario.trim() || null,
      telefono: formulario.telefono,
      rolId: formulario.rolId || null,
      activo: formulario.activo,
      contrasena: formulario.contrasena,
      debeCambiarContrasena: formulario.debeCambiarContrasena,
    };

    if (usuario) {
      actualizar.mutate({ id: usuario.id, datos }, { onSuccess: cerrarYLimpiar });
    } else {
      crear.mutate(datos, { onSuccess: cerrarYLimpiar });
    }
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={cerrarYLimpiar}
      titulo={usuario ? "Editar usuario" : "Nuevo usuario"}
      ancho="md"
      acciones={
        <>
          <Boton variante="contorno" onClick={cerrarYLimpiar}>
            Cancelar
          </Boton>
          <Boton
            type="submit"
            form="formulario-usuario"
            cargando={mutacion.isPending}
          >
            {usuario ? "Guardar cambios" : "Crear usuario"}
          </Boton>
        </>
      }
    >
      <Box
        component="form"
        id="formulario-usuario"
        onSubmit={enviar}
        noValidate
        sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}
      >
        {errorGeneral && <Alerta tipo="error">{errorGeneral}</Alerta>}

        {!usuario && (
          <Alerta tipo="info">
            Se creará el usuario del sistema <strong>y su cuenta de acceso</strong>:
            podrá iniciar sesión de inmediato con esta contraseña y con su correo
            o su nombre de usuario, si le asignas uno.
          </Alerta>
        )}

        <Campo etiqueta="Nombre" requerido error={campos.nombre}>
          {(props) => (
            <Entrada
              {...props}
              value={formulario.nombre}
              error={Boolean(campos.nombre)}
              onChange={(evento) =>
                setFormulario((f) => ({ ...f, nombre: evento.target.value }))
              }
            />
          )}
        </Campo>

        <Campo etiqueta="Correo" requerido error={campos.correo}>
          {(props) => (
            <Entrada
              {...props}
              type="email"
              value={formulario.correo}
              error={Boolean(campos.correo)}
              onChange={(evento) =>
                setFormulario((f) => ({ ...f, correo: evento.target.value }))
              }
            />
          )}
        </Campo>

        <Campo
          etiqueta="Nombre de usuario"
          error={campos.usuario}
          ayuda={`Opcional: le permite entrar sin escribir el correo. ${AYUDA_NOMBRE_USUARIO}`}
        >
          {(props) => (
            <Entrada
              {...props}
              value={formulario.usuario}
              placeholder="Opcional"
              autoCapitalize="none"
              spellCheck={false}
              error={Boolean(campos.usuario)}
              onChange={(evento) =>
                setFormulario((f) => ({ ...f, usuario: evento.target.value }))
              }
            />
          )}
        </Campo>

        <Campo
          etiqueta={usuario ? "Nueva contraseña" : "Contraseña"}
          requerido={!usuario}
          error={campos.contrasena}
          ayuda={
            usuario
              ? "Déjala en blanco para conservar la contraseña actual."
              : `Mínimo ${LARGO_MINIMO_CONTRASENA} caracteres.`
          }
        >
          {(props) => (
            <Entrada
              {...props}
              type="password"
              value={formulario.contrasena}
              autoComplete="new-password"
              placeholder={usuario ? "Sin cambios" : ""}
              error={Boolean(campos.contrasena)}
              onChange={(evento) =>
                setFormulario((f) => ({ ...f, contrasena: evento.target.value }))
              }
            />
          )}
        </Campo>

        <Box
          sx={{
            display: "grid",
            gap: 2.5,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          }}
        >
          <Campo etiqueta="Teléfono" error={campos.telefono}>
            {(props) => (
              <Entrada
                {...props}
                value={formulario.telefono}
                placeholder="Opcional"
                error={Boolean(campos.telefono)}
                onChange={(evento) =>
                  setFormulario((f) => ({ ...f, telefono: evento.target.value }))
                }
              />
            )}
          </Campo>

          <Campo etiqueta="Rol" requerido error={campos.rolId}>
            {(props) => (
              <Selector
                {...props}
                opciones={(roles.data ?? []).map((rol) => ({
                  valor: rol.id,
                  etiqueta: rol.nombre,
                }))}
                marcador={roles.isPending ? "Cargando…" : "Selecciona el rol"}
                value={formulario.rolId}
                error={Boolean(campos.rolId)}
                onChange={(evento) =>
                  setFormulario((f) => ({ ...f, rolId: evento.target.value }))
                }
              />
            )}
          </Campo>
        </Box>

        {/*
          Columna y no un `gap` heredado del formulario: `Casilla` es
          `inline-flex`, así que como hermanas sueltas fluirían en la misma línea.
        */}
        <Stack sx={{ alignItems: "flex-start", gap: 1.5 }}>
          <Casilla
            checked={formulario.activo}
            onChange={(activo) => setFormulario((f) => ({ ...f, activo }))}
            etiqueta="Usuario activo"
          />

          <Casilla
            checked={formulario.debeCambiarContrasena}
            onChange={(debeCambiarContrasena) =>
              setFormulario((f) => ({ ...f, debeCambiarContrasena }))
            }
            etiqueta="Debe cambiar la contraseña al entrar"
          />
        </Stack>

        <Typography sx={{ mt: -1, fontSize: 12, color: "text.secondary" }}>
          {formulario.debeCambiarContrasena
            ? "Al entrar solo verá la pantalla de cambio de contraseña, hasta que defina una propia."
            : "Podrá seguir usando la contraseña que le asignes aquí de forma indefinida."}
        </Typography>
      </Box>
    </Modal>
  );
}
