import { mensajeDeError, type DatosProducto, type Producto } from "@invlafe/core";
import { Box } from "@mui/material";
import type { UseMutationResult } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Alerta, Boton, Campo, Entrada, Modal } from "../../../shared/ui";
import { erroresDeCampo } from "../../auth/utiles/errores";

const VACIO = { nombre: "" };

/** Alta y edición de un producto del catálogo: solo tiene nombre. */
export function ModalProducto({
  abierto,
  producto,
  crear,
  actualizar,
  alCerrar,
}: {
  abierto: boolean;
  /** `null` para dar de alta uno nuevo. */
  producto: Producto | null;
  crear: UseMutationResult<Producto, Error, DatosProducto>;
  actualizar: UseMutationResult<Producto, Error, { id: string; datos: DatosProducto }>;
  alCerrar: () => void;
}) {
  const [formulario, setFormulario] = useState(VACIO);

  const mutacion = producto ? actualizar : crear;
  const campos = erroresDeCampo(mutacion.error);
  const errorGeneral =
    mutacion.error && Object.keys(campos).length === 0
      ? mensajeDeError(mutacion.error)
      : null;

  useEffect(() => {
    if (!abierto) return;
    setFormulario(producto ? { nombre: producto.nombre } : VACIO);
  }, [abierto, producto]);

  function cerrarYLimpiar() {
    crear.reset();
    actualizar.reset();
    alCerrar();
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();

    const datos: DatosProducto = { nombre: formulario.nombre };

    if (producto) {
      actualizar.mutate({ id: producto.id, datos }, { onSuccess: cerrarYLimpiar });
    } else {
      crear.mutate(datos, { onSuccess: cerrarYLimpiar });
    }
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={cerrarYLimpiar}
      titulo={producto ? "Editar producto" : "Nuevo producto"}
      ancho="sm"
      acciones={
        <>
          <Boton variante="contorno" onClick={cerrarYLimpiar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="formulario-producto" cargando={mutacion.isPending}>
            {producto ? "Guardar cambios" : "Crear producto"}
          </Boton>
        </>
      }
    >
      <Box
        component="form"
        id="formulario-producto"
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
              placeholder="Ej.: Diesel, Regular, Kero, Aceite"
              error={Boolean(campos.nombre)}
              onChange={(evento) => setFormulario({ nombre: evento.target.value })}
            />
          )}
        </Campo>
      </Box>
    </Modal>
  );
}
