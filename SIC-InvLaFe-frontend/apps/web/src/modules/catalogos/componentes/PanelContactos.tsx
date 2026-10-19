import {
  formatearFecha,
  mensajeDeError,
  type ClaveModulo,
  type DatosContacto,
} from "@invlafe/core";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { Box, Stack, Typography } from "@mui/material";
import { Pencil, Plus, Trash2, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Alerta,
  Boton,
  Cabecera,
  Celda,
  Cuerpo,
  Entrada,
  EstadoConsulta,
  EstadoVacio,
  Fila,
  Modal,
  Tabla,
  useModal,
  usePuede,
} from "../../../shared/ui";
import { ModalContacto } from "./ModalContacto";
import type { Contacto } from "./tipos";

export interface PropsPanelContactos {
  modulo: ClaveModulo;
  /** En minúsculas: se incrusta en frases ("Nuevo cliente", "Eliminar cliente"). */
  singular: string;
  plural: string;
  icono: LucideIcon;
  /**
   * Hooks del catálogo correspondiente.
   *
   * Se reciben como props y se invocan aquí dentro, siempre y en el mismo
   * orden. Es seguro porque cada página pasa funciones de módulo, estables
   * entre renders, y porque cambiar de `/clientes` a `/proveedores` desmonta
   * este componente en lugar de reconfigurarlo.
   */
  usarLista: () => UseQueryResult<Contacto[]>;
  usarCrear: () => UseMutationResult<Contacto, Error, DatosContacto>;
  usarActualizar: () => UseMutationResult<
    Contacto,
    Error,
    { id: string; datos: DatosContacto }
  >;
  usarEliminar: () => UseMutationResult<void, Error, string>;
}

export function PanelContactos({
  modulo,
  singular,
  plural,
  icono: Icono,
  usarLista,
  usarCrear,
  usarActualizar,
  usarEliminar,
}: PropsPanelContactos) {
  const [enEdicion, setEnEdicion] = useState<Contacto | null>(null);
  const [aEliminar, setAEliminar] = useState<Contacto | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const permisos = usePuede(modulo);
  const modalContacto = useModal();

  const consulta = usarLista();
  const crear = usarCrear();
  const actualizar = usarActualizar();
  const eliminar = usarEliminar();

  /**
   * El catálogo se filtra en memoria y no en la base: son listas de decenas de
   * filas que ya vienen enteras para llenar los desplegables de ventas y lotes,
   * así que pedirlas otra vez por cada letra tecleada sería peor.
   */
  const visibles = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    const lista = consulta.data ?? [];
    if (!termino) return lista;

    return lista.filter(
      (contacto) =>
        contacto.nombre.toLowerCase().includes(termino) ||
        (contacto.telefono ?? "").toLowerCase().includes(termino),
    );
  }, [consulta.data, busqueda]);

  function abrirNuevo() {
    setEnEdicion(null);
    modalContacto.abrir();
  }

  return (
    <>
      <Stack
        direction="row"
        sx={{ mb: 2, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}
      >
        <Box sx={{ width: { xs: "100%", sm: "auto" }, maxWidth: { sm: 320 } }}>
          <Entrada
            type="search"
            value={busqueda}
            placeholder={`Buscar ${plural}…`}
            aria-label={`Buscar ${plural}`}
            onChange={(evento) => setBusqueda(evento.target.value)}
          />
        </Box>

        {permisos.crear && (
          <Boton onClick={abrirNuevo} iconoInicio={<Plus size={16} aria-hidden />}>
            Nuevo {singular}
          </Boton>
        )}
      </Stack>

      {eliminar.error && (
        <Alerta tipo="error" sx={{ mb: 2 }} titulo="No se pudo eliminar">
          {mensajeDeError(eliminar.error)}
        </Alerta>
      )}

      <Tabla>
        <Cabecera>
          <Fila>
            <Celda cabecera>Nombre</Celda>
            <Celda cabecera>Teléfono</Celda>
            <Celda cabecera>Alta</Celda>
            <Celda cabecera alineacion="derecha">Acciones</Celda>
          </Fila>
        </Cabecera>
        <Cuerpo>
          <EstadoConsulta
            enTabla
            cargando={consulta.isPending}
            error={consulta.error}
            datos={visibles}
            vacio={
              <Fila>
                <Celda colSpan={4}>
                  <EstadoVacio
                    icono={<Icono size={24} aria-hidden />}
                    titulo={
                      busqueda.trim()
                        ? `Ningún ${singular} coincide con la búsqueda`
                        : `Todavía no hay ${plural}`
                    }
                    descripcion={
                      busqueda.trim()
                        ? "Prueba con otro nombre o número de teléfono."
                        : `Da de alta el primero para poder seleccionarlo al registrar movimientos.`
                    }
                    accion={
                      permisos.crear &&
                      !busqueda.trim() && (
                        <Boton onClick={abrirNuevo} iconoInicio={<Plus size={16} aria-hidden />}>
                          Nuevo {singular}
                        </Boton>
                      )
                    }
                  />
                </Celda>
              </Fila>
            }
          >
            {(items) =>
              items.map((contacto) => (
                <Fila key={contacto.id}>
                  <Celda>
                    <Typography sx={{ fontSize: "inherit", fontWeight: 500, color: "text.primary" }}>
                      {contacto.nombre}
                    </Typography>
                  </Celda>
                  <Celda>{contacto.telefono ?? "—"}</Celda>
                  <Celda sx={{ whiteSpace: "nowrap" }}>
                    {formatearFecha(contacto.creadoEn)}
                  </Celda>
                  <Celda alineacion="derecha">
                    <Stack direction="row" sx={{ justifyContent: "flex-end", gap: 0.5 }}>
                      {permisos.editar && (
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          aria-label={`Editar ${contacto.nombre}`}
                          onClick={() => {
                            setEnEdicion(contacto);
                            modalContacto.abrir();
                          }}
                          iconoInicio={<Pencil size={16} aria-hidden />}
                        />
                      )}
                      {permisos.eliminar && (
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          aria-label={`Eliminar ${contacto.nombre}`}
                          onClick={() => setAEliminar(contacto)}
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

      <ModalContacto
        abierto={modalContacto.abierto}
        contacto={enEdicion}
        singular={singular}
        crear={crear}
        actualizar={actualizar}
        alCerrar={() => {
          modalContacto.cerrar();
          setEnEdicion(null);
        }}
      />

      <Modal
        abierto={Boolean(aEliminar)}
        alCerrar={() => setAEliminar(null)}
        titulo={`Eliminar ${singular}`}
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
          Se eliminará <strong>{aEliminar?.nombre}</strong> del catálogo. Los
          movimientos ya registrados a su nombre no se borran, pero la base puede
          rechazar el borrado si todavía hay alguno que lo referencia.
        </Typography>
      </Modal>
    </>
  );
}
