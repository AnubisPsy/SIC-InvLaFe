import { mensajeDeError, type DatosContacto } from "@invlafe/core";
import { Box } from "@mui/material";
import type { UseMutationResult } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Alerta, Boton, Campo, Entrada, Modal } from "../../../shared/ui";
import { erroresDeCampo } from "../../auth/utiles/errores";
import type { Contacto } from "./tipos";

const VACIO = { nombre: "", telefono: "" };

/**
 * Alta y edición de un contacto del catálogo.
 *
 * Sirve igual para clientes y para proveedores porque los dos son la misma
 * forma —nombre y teléfono opcional—, hasta el punto de que el dominio ya los
 * valida con una sola función (`validarContacto`, parametrizada por etiqueta).
 * Duplicar esta pantalla solo duplicaría el sitio donde corregir un error.
 */
export function ModalContacto({
  abierto,
  contacto,
  singular,
  crear,
  actualizar,
  alCerrar,
}: {
  abierto: boolean;
  /** `null` para dar de alta uno nuevo. */
  contacto: Contacto | null;
  /** "cliente" o "proveedor", en minúsculas: se usa dentro de las frases. */
  singular: string;
  crear: UseMutationResult<Contacto, Error, DatosContacto>;
  actualizar: UseMutationResult<Contacto, Error, { id: string; datos: DatosContacto }>;
  alCerrar: () => void;
}) {
  const [formulario, setFormulario] = useState(VACIO);

  const mutacion = contacto ? actualizar : crear;
  const campos = erroresDeCampo(mutacion.error);
  const errorGeneral =
    mutacion.error && Object.keys(campos).length === 0
      ? mensajeDeError(mutacion.error)
      : null;

  useEffect(() => {
    if (!abierto) return;

    setFormulario(
      contacto
        ? { nombre: contacto.nombre, telefono: contacto.telefono ?? "" }
        : VACIO,
    );
  }, [abierto, contacto]);

  function cerrarYLimpiar() {
    crear.reset();
    actualizar.reset();
    alCerrar();
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();

    const datos: DatosContacto = {
      nombre: formulario.nombre,
      telefono: formulario.telefono.trim() || null,
    };

    if (contacto) {
      actualizar.mutate({ id: contacto.id, datos }, { onSuccess: cerrarYLimpiar });
    } else {
      crear.mutate(datos, { onSuccess: cerrarYLimpiar });
    }
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={cerrarYLimpiar}
      titulo={contacto ? `Editar ${singular}` : `Nuevo ${singular}`}
      ancho="sm"
      acciones={
        <>
          <Boton variante="contorno" onClick={cerrarYLimpiar}>
            Cancelar
          </Boton>
          <Boton
            type="submit"
            form="formulario-contacto"
            cargando={mutacion.isPending}
          >
            {contacto ? "Guardar cambios" : `Crear ${singular}`}
          </Boton>
        </>
      }
    >
      <Box
        component="form"
        id="formulario-contacto"
        onSubmit={enviar}
        noValidate
        sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}
      >
        {errorGeneral && <Alerta tipo="error">{errorGeneral}</Alerta>}

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
      </Box>
    </Modal>
  );
}
