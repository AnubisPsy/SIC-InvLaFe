import {
  ACCIONES,
  ETIQUETA_ACCION,
  ETIQUETA_MODULO,
  MODULOS,
  mensajeDeError,
  type Accion,
  type AccionesPermitidas,
  type ID,
  type PermisoEditable,
  type Rol,
} from "@invlafe/core";
import {
  useCrearRol,
  useEliminarRol,
  useGuardarPermisos,
  useMatrizPermisos,
  useRoles,
} from "@invlafe/query";
import { alpha, Box, Stack, Typography } from "@mui/material";
import { Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  Alerta,
  Boton,
  Cabecera,
  Campo,
  Cargador,
  Casilla,
  Celda,
  Cuerpo,
  Entrada,
  Fila,
  Modal,
  Tabla,
  Tarjeta,
  usePuede,
  useModal,
} from "../../../shared/ui";
import { erroresDeCampo } from "../../auth/utiles/errores";

export function PanelRoles() {
  const [rolSeleccionado, setRolSeleccionado] = useState<ID | null>(null);
  const [aEliminar, setAEliminar] = useState<Rol | null>(null);

  const permisos = usePuede(MODULOS.USUARIOS_ROLES);
  const modalRol = useModal();
  const roles = useRoles();
  const eliminar = useEliminarRol();

  // Selecciona el primer rol en cuanto cargan, para que el panel no arranque vacío.
  useEffect(() => {
    if (!rolSeleccionado && roles.data?.length) {
      setRolSeleccionado(roles.data[0].id);
    }
  }, [roles.data, rolSeleccionado]);

  return (
    <Box
      sx={{
        display: "grid",
        gap: 3,
        gridTemplateColumns: { xs: "1fr", lg: "18rem 1fr" },
      }}
    >
      <Tarjeta
        titulo="Roles"
        acciones={
          permisos.crear && (
            <Boton
              tamano="sm"
              onClick={modalRol.abrir}
              iconoInicio={<Plus size={16} aria-hidden />}
            >
              Nuevo
            </Boton>
          )
        }
        sinRelleno
      >
        {eliminar.error && (
          <Box sx={{ p: 2 }}>
            <Alerta tipo="error">{mensajeDeError(eliminar.error)}</Alerta>
          </Box>
        )}

        {roles.isPending ? (
          <Cargador etiqueta="Cargando roles…" />
        ) : roles.data && roles.data.length > 0 ? (
          <Stack component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
            {roles.data.map((rol) => (
              <Stack
                component="li"
                direction="row"
                key={rol.id}
                sx={{
                  alignItems: "center",
                  gap: 0.5,
                  pr: 1,
                  borderBottom: 1,
                  borderColor: "divider",
                  "&:last-of-type": { borderBottom: 0 },
                }}
              >
                <Box
                  component="button"
                  type="button"
                  onClick={() => setRolSeleccionado(rol.id)}
                  sx={[
                    {
                      flex: 1,
                      border: 0,
                      background: "none",
                      cursor: "pointer",
                      px: 2.5,
                      py: 1.5,
                      textAlign: "left",
                      fontSize: 14,
                      transition: "background-color 0.15s, color 0.15s",
                    },
                    rol.id === rolSeleccionado
                      ? {
                          bgcolor: (tema: import("@mui/material").Theme) =>
                            alpha(tema.palette.primary.main, tema.palette.mode === "light" ? 0.08 : 0.18),
                          fontWeight: 500,
                          color: "primary.main",
                        }
                      : {
                          color: "text.secondary",
                          "&:hover": { bgcolor: "action.hover" },
                        },
                  ]}
                >
                  {rol.nombre}
                </Box>
                {permisos.eliminar && (
                  <Boton
                    variante="fantasma"
                    tamano="sm"
                    aria-label={`Eliminar rol ${rol.nombre}`}
                    onClick={() => setAEliminar(rol)}
                    iconoInicio={
                      <Box component="span" sx={{ display: "flex", color: "error.500" }}>
                        <Trash2 size={16} color="currentColor" aria-hidden />
                      </Box>
                    }
                  />
                )}
              </Stack>
            ))}
          </Stack>
        ) : (
          <Typography sx={{ px: 2.5, py: 4, textAlign: "center", fontSize: 14, color: "text.secondary" }}>
            Todavía no hay roles. Crea uno para poder asignar permisos.
          </Typography>
        )}
      </Tarjeta>

      {rolSeleccionado ? (
        <MatrizPermisos rolId={rolSeleccionado} puedeEditar={permisos.editar} />
      ) : (
        <Tarjeta>
          <Typography sx={{ py: 4, textAlign: "center", fontSize: 14, color: "text.secondary" }}>
            Selecciona un rol para configurar sus permisos.
          </Typography>
        </Tarjeta>
      )}

      <ModalRol abierto={modalRol.abierto} alCerrar={modalRol.cerrar} />

      <Modal
        abierto={Boolean(aEliminar)}
        alCerrar={() => setAEliminar(null)}
        titulo="Eliminar rol"
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
                  onSuccess: () => {
                    if (rolSeleccionado === aEliminar.id) setRolSeleccionado(null);
                    setAEliminar(null);
                  },
                });
              }}
            >
              Eliminar
            </Boton>
          </>
        }
      >
        <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
          Se eliminará el rol <strong>{aEliminar?.nombre}</strong> y sus permisos.
          No es posible si todavía hay usuarios con ese rol asignado.
        </Typography>
      </Modal>
    </Box>
  );
}

function ModalRol({
  abierto,
  alCerrar,
}: {
  abierto: boolean;
  alCerrar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const crear = useCrearRol();

  const campos = erroresDeCampo(crear.error);
  const errorGeneral =
    crear.error && Object.keys(campos).length === 0
      ? mensajeDeError(crear.error)
      : null;

  function cerrarYLimpiar() {
    setNombre("");
    crear.reset();
    alCerrar();
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    crear.mutate({ nombre }, { onSuccess: cerrarYLimpiar });
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={cerrarYLimpiar}
      titulo="Nuevo rol"
      descripcion="Crea el rol y luego marca qué puede hacer en cada módulo."
      ancho="sm"
      acciones={
        <>
          <Boton variante="contorno" onClick={cerrarYLimpiar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="formulario-rol" cargando={crear.isPending}>
            Crear rol
          </Boton>
        </>
      }
    >
      <form id="formulario-rol" onSubmit={enviar} noValidate>
        {errorGeneral && (
          <Alerta tipo="error" sx={{ mb: 2 }}>
            {errorGeneral}
          </Alerta>
        )}

        <Campo etiqueta="Nombre del rol" requerido error={campos.nombre}>
          {(props) => (
            <Entrada
              {...props}
              value={nombre}
              placeholder="Ej.: Administrador, Despachador, Cobrador"
              error={Boolean(campos.nombre)}
              onChange={(evento) => setNombre(evento.target.value)}
            />
          )}
        </Campo>
      </form>
    </Modal>
  );
}

type Borrador = Record<string, AccionesPermitidas>;

/**
 * Matriz módulo × acción del rol.
 *
 * Se edita sobre un borrador local y se guarda en bloque: marcar diez casillas
 * dispararía diez escrituras si cada una se persistiera al vuelo.
 */
function MatrizPermisos({
  rolId,
  puedeEditar,
}: {
  rolId: ID;
  puedeEditar: boolean;
}) {
  const consulta = useMatrizPermisos(rolId);
  const guardar = useGuardarPermisos();
  const [borrador, setBorrador] = useState<Borrador>({});

  useEffect(() => {
    if (!consulta.data) return;

    setBorrador(
      Object.fromEntries(
        consulta.data.filas.map((fila) => [
          fila.modulo.id,
          {
            ver: fila.ver,
            crear: fila.crear,
            editar: fila.editar,
            eliminar: fila.eliminar,
          },
        ]),
      ),
    );
  }, [consulta.data]);

  if (consulta.isPending) return <Cargador etiqueta="Cargando permisos…" />;

  if (consulta.error) {
    return (
      <Alerta tipo="error" titulo="No se pudieron cargar los permisos">
        {mensajeDeError(consulta.error)}
      </Alerta>
    );
  }

  const matriz = consulta.data;
  if (!matriz) return null;

  function alternar(moduloId: ID, accion: Accion) {
    setBorrador((actual) => {
      const fila = actual[moduloId] ?? {
        ver: false,
        crear: false,
        editar: false,
        eliminar: false,
      };
      const siguiente = { ...fila, [accion]: !fila[accion] };

      // Desmarcar "ver" apaga el resto: sin lectura las demás acciones no
      // tienen sentido y dejarlas marcadas confundiría al administrador.
      if (accion === "ver" && !siguiente.ver) {
        return {
          ...actual,
          [moduloId]: { ver: false, crear: false, editar: false, eliminar: false },
        };
      }
      // Y marcar cualquier otra implica poder ver.
      if (accion !== "ver" && siguiente[accion]) siguiente.ver = true;

      return { ...actual, [moduloId]: siguiente };
    });
  }

  function guardarCambios() {
    const permisos: PermisoEditable[] = matriz!.filas.map((fila) => ({
      moduloId: fila.modulo.id,
      ...(borrador[fila.modulo.id] ?? {
        ver: false,
        crear: false,
        editar: false,
        eliminar: false,
      }),
    }));

    guardar.mutate({ rolId, permisos });
  }

  return (
    <Tarjeta
      titulo={`Permisos de ${matriz.rol.nombre}`}
      descripcion="Marca qué puede hacer este rol en cada módulo. Sin «Ver», el módulo ni siquiera aparece en el menú."
      acciones={
        puedeEditar && (
          <Boton
            onClick={guardarCambios}
            cargando={guardar.isPending}
            iconoInicio={<Save size={16} aria-hidden />}
          >
            Guardar permisos
          </Boton>
        )
      }
    >
      <Stack sx={{ gap: 2 }}>
        {guardar.isSuccess && !guardar.isPending && (
          <Alerta tipo="exito">Permisos guardados.</Alerta>
        )}
        {guardar.error && (
          <Alerta tipo="error">{mensajeDeError(guardar.error)}</Alerta>
        )}

        {matriz.sinConfigurar.length > 0 && (
          <Alerta tipo="advertencia" titulo="Módulos sin fila en la base">
            <Typography sx={{ fontSize: "inherit" }}>
              Estos módulos existen en la aplicación pero no en la tabla{" "}
              <code>modulos</code>, así que no se les puede conceder permiso:
            </Typography>
            <Box component="ul" sx={{ mt: 1, pl: 2.5, listStyleType: "disc" }}>
              {matriz.sinConfigurar.map((clave) => (
                <li key={clave}>{ETIQUETA_MODULO[clave]}</li>
              ))}
            </Box>
          </Alerta>
        )}

        <Tabla>
          <Cabecera>
            <Fila>
              <Celda cabecera>Módulo</Celda>
              {ACCIONES.map((accion) => (
                <Celda cabecera alineacion="centro" key={accion}>
                  {ETIQUETA_ACCION[accion]}
                </Celda>
              ))}
            </Fila>
          </Cabecera>
          <Cuerpo>
            {matriz.filas.map((fila) => {
              const estado = borrador[fila.modulo.id];
              const reconocido = fila.modulo.clave !== null;

              return (
                <Fila key={fila.modulo.id}>
                  <Celda>
                    <Typography sx={{ fontSize: 14, fontWeight: 500, color: "text.primary" }}>
                      {fila.modulo.clave
                        ? ETIQUETA_MODULO[fila.modulo.clave]
                        : fila.modulo.nombre}
                    </Typography>
                    {!reconocido && (
                      <Typography sx={{ fontSize: 12, color: "warning.600" }}>
                        «{fila.modulo.nombre}» no corresponde a ningún módulo de
                        la app; sus permisos se ignoran.
                      </Typography>
                    )}
                  </Celda>
                  {ACCIONES.map((accion) => (
                    <Celda alineacion="centro" key={accion}>
                      <Casilla
                        checked={estado?.[accion] ?? false}
                        disabled={!puedeEditar}
                        onChange={() => alternar(fila.modulo.id, accion)}
                      />
                    </Celda>
                  ))}
                </Fila>
              );
            })}
          </Cuerpo>
        </Tabla>

        {matriz.filas.length === 0 && (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <ShieldCheck size={24} style={{ margin: "0 auto 8px" }} aria-hidden />
            <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
              La tabla <code>modulos</code> está vacía. Créala con una fila por
              módulo para poder asignar permisos.
            </Typography>
          </Box>
        )}
      </Stack>
    </Tarjeta>
  );
}
