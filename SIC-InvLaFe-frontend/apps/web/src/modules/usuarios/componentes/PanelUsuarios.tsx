import {
  MODULOS,
  formatearFecha,
  iniciales,
  mensajeDeError,
  type UsuarioDetalle,
} from "@invlafe/core";
import {
  useCambiarActivoUsuario,
  useEliminarUsuario,
  useUsuarios,
} from "@invlafe/query";
import { alpha, Box, Stack, Typography } from "@mui/material";
import { Pencil, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import {
  Alerta,
  Boton,
  Cabecera,
  Celda,
  Cuerpo,
  EstadoConsulta,
  EstadoVacio,
  Fila,
  Insignia,
  Modal,
  Tabla,
  usePuede,
  useModal,
} from "../../../shared/ui";
import { ModalUsuario } from "./ModalUsuario";

export function PanelUsuarios() {
  const [enEdicion, setEnEdicion] = useState<UsuarioDetalle | null>(null);
  const [aEliminar, setAEliminar] = useState<UsuarioDetalle | null>(null);

  const permisos = usePuede(MODULOS.USUARIOS_ROLES);
  const modalUsuario = useModal();
  const consulta = useUsuarios();
  const cambiarActivo = useCambiarActivoUsuario();
  const eliminar = useEliminarUsuario();

  function abrirNuevo() {
    setEnEdicion(null);
    modalUsuario.abrir();
  }

  return (
    <>
      <Box sx={{ mb: 2, display: "flex", justifyContent: "flex-end" }}>
        {permisos.crear && (
          <Boton onClick={abrirNuevo} iconoInicio={<Plus size={16} aria-hidden />}>
            Nuevo usuario
          </Boton>
        )}
      </Box>

      {eliminar.error && (
        <Alerta tipo="error" sx={{ mb: 2 }} titulo="No se pudo eliminar">
          {mensajeDeError(eliminar.error)}
        </Alerta>
      )}

      {cambiarActivo.error && (
        <Alerta tipo="error" sx={{ mb: 2 }} titulo="No se pudo cambiar el estado">
          {mensajeDeError(cambiarActivo.error)}
        </Alerta>
      )}

      <Tabla anchoMinimo="md">
        <Cabecera>
          <Fila>
            <Celda cabecera>Usuario</Celda>
            <Celda cabecera>Correo</Celda>
            <Celda cabecera>Teléfono</Celda>
            <Celda cabecera>Rol</Celda>
            <Celda cabecera>Estado</Celda>
            <Celda cabecera>Alta</Celda>
            <Celda cabecera alineacion="derecha">Acciones</Celda>
          </Fila>
        </Cabecera>
        <Cuerpo>
          <EstadoConsulta
            enTabla
            cargando={consulta.isPending}
            error={consulta.error}
            datos={consulta.data}
            vacio={
              <Fila>
                <Celda colSpan={7}>
                  <EstadoVacio
                    icono={<Users size={24} aria-hidden />}
                    titulo="No hay usuarios registrados"
                    descripcion="Crea el primer usuario del sistema y asígnale un rol."
                    accion={
                      permisos.crear && (
                        <Boton
                          onClick={abrirNuevo}
                          iconoInicio={<UserPlus size={16} aria-hidden />}
                        >
                          Nuevo usuario
                        </Boton>
                      )
                    }
                  />
                </Celda>
              </Fila>
            }
          >
            {(items) =>
              items.map((usuario) => (
                <Fila key={usuario.id}>
                  <Celda>
                    <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
                      <Box
                        component="span"
                        sx={{
                          display: "flex",
                          width: 36,
                          height: 36,
                          flexShrink: 0,
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "50%",
                          bgcolor: (tema) => alpha(tema.palette.primary.main, tema.palette.mode === "light" ? 0.08 : 0.18),
                          fontSize: 12,
                          fontWeight: 600,
                          color: "primary.main",
                        }}
                      >
                        {iniciales(usuario.nombre)}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography component="span" sx={{ display: "block", fontWeight: 500, color: "text.primary" }}>
                          {usuario.nombre}
                        </Typography>
                        {/*
                          Debajo del nombre y no en una columna aparte: es un
                          dato que casi siempre se consulta junto al nombre, y
                          ahorra ensanchar una tabla que ya va justa.
                        */}
                        {usuario.usuario && (
                          <Typography
                            component="span"
                            sx={{
                              display: "block",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: 12,
                              color: "text.secondary",
                            }}
                          >
                            {usuario.usuario}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  </Celda>
                  <Celda>{usuario.correo}</Celda>
                  <Celda>{usuario.telefono ?? "—"}</Celda>
                  <Celda>
                    {usuario.rol ? (
                      <Insignia color="primario">{usuario.rol.nombre}</Insignia>
                    ) : (
                      <Insignia color="error">Sin rol</Insignia>
                    )}
                  </Celda>
                  <Celda>
                    <Insignia color={usuario.activo ? "exito" : "neutro"}>
                      {usuario.activo ? "Activo" : "Inactivo"}
                    </Insignia>
                  </Celda>
                  <Celda sx={{ whiteSpace: "nowrap" }}>
                    {formatearFecha(usuario.creadoEn)}
                  </Celda>
                  <Celda alineacion="derecha">
                    <Stack direction="row" sx={{ justifyContent: "flex-end", gap: 0.5 }}>
                      {permisos.editar && (
                        <>
                          <Boton
                            variante="fantasma"
                            tamano="sm"
                            onClick={() =>
                              cambiarActivo.mutate({
                                id: usuario.id,
                                activo: !usuario.activo,
                              })
                            }
                          >
                            {usuario.activo ? "Desactivar" : "Activar"}
                          </Boton>
                          <Boton
                            variante="fantasma"
                            tamano="sm"
                            aria-label={`Editar ${usuario.nombre}`}
                            onClick={() => {
                              setEnEdicion(usuario);
                              modalUsuario.abrir();
                            }}
                            iconoInicio={<Pencil size={16} aria-hidden />}
                          />
                        </>
                      )}
                      {permisos.eliminar && (
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          aria-label={`Eliminar ${usuario.nombre}`}
                          onClick={() => setAEliminar(usuario)}
                          iconoInicio={
                            <Box component="span" sx={{ display: "flex", color: "error.500" }}>
                              <Trash2 size={16} color="currentColor" aria-hidden />
                            </Box>
                          }
                        />
                      )}
                    </Stack>
                  </Celda>
                </Fila>
              ))
            }
          </EstadoConsulta>
        </Cuerpo>
      </Tabla>

      <ModalUsuario
        abierto={modalUsuario.abierto}
        usuario={enEdicion}
        alCerrar={() => {
          modalUsuario.cerrar();
          setEnEdicion(null);
        }}
      />

      <Modal
        abierto={Boolean(aEliminar)}
        alCerrar={() => setAEliminar(null)}
        titulo="Eliminar usuario"
        ancho="sm"
        acciones={
          <>
            <Boton variante="contorno" onClick={() => setAEliminar(null)}>
              Cancelar
            </Boton>
            <Boton
              variante="peligro"
              cargando={eliminar.isPending}
              onClick={() => {
                if (!aEliminar) return;
                eliminar.mutate(aEliminar.id, {
                  onSuccess: () => setAEliminar(null),
                });
              }}
            >
              Eliminar
            </Boton>
          </>
        }
      >
        <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
          Se eliminará <strong>{aEliminar?.nombre}</strong> del sistema junto con
          su cuenta de acceso, así que dejará de poder iniciar sesión. Esta
          acción no se puede deshacer.
        </Typography>
        <Typography sx={{ mt: 1.5, fontSize: 14, color: "text.secondary" }}>
          Si solo quieres retirarle el acceso temporalmente,{" "}
          <strong>desactívalo</strong> en lugar de eliminarlo: conserva su
          historial y puedes reactivarlo cuando haga falta.
        </Typography>
      </Modal>
    </>
  );
}
