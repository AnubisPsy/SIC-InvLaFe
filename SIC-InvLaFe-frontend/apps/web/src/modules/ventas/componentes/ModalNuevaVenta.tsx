import {
  calcularValorTotal,
  formatearCantidad,
  formatearMonto,
  hoyISO,
  mensajeDeError,
  parsearNumero,
  type LoteCompraDetalle,
} from "@invlafe/core";
import { useClientes, useRegistrarVenta } from "@invlafe/query";
import { Box, Stack, Typography } from "@mui/material";
import { useState, type FormEvent } from "react";
import {
  Alerta,
  Boton,
  Campo,
  Entrada,
  Modal,
  Selector,
} from "../../../shared/ui";
import { erroresDeCampo } from "../../auth/utiles/errores";
import { SelectorLote } from "./SelectorLote";

const VACIO = {
  clienteId: "",
  loteCompraId: "",
  fecha: hoyISO(),
  numeroFactura: "",
  cantidad: "",
  precioUnitario: "",
  detalle: "",
};

export function ModalNuevaVenta({
  abierto,
  alCerrar,
}: {
  abierto: boolean;
  alCerrar: () => void;
}) {
  const [formulario, setFormulario] = useState(VACIO);
  const [lote, setLote] = useState<LoteCompraDetalle | undefined>();

  const clientes = useClientes();
  const registrar = useRegistrarVenta();

  const campos = erroresDeCampo(registrar.error);
  const errorGeneral =
    registrar.error && Object.keys(campos).length === 0
      ? mensajeDeError(registrar.error)
      : null;

  const cantidad = parsearNumero(formulario.cantidad) ?? 0;
  const precio = parsearNumero(formulario.precioUnitario) ?? 0;
  const total = calcularValorTotal(cantidad, precio);
  const excedeExistencia = Boolean(lote) && cantidad > (lote?.cantidadDisponible ?? 0);

  function cerrarYLimpiar() {
    setFormulario({ ...VACIO, fecha: hoyISO() });
    setLote(undefined);
    registrar.reset();
    alCerrar();
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();

    registrar.mutate(
      {
        clienteId: formulario.clienteId,
        loteCompraId: formulario.loteCompraId,
        fecha: formulario.fecha,
        numeroFactura: formulario.numeroFactura,
        cantidad,
        precioUnitario: precio,
        detalle: formulario.detalle,
      },
      { onSuccess: cerrarYLimpiar },
    );
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={cerrarYLimpiar}
      titulo="Registrar carga"
      descripcion="Al guardar se descuenta la cantidad del lote y el cliente queda debiendo el total."
      ancho="lg"
      acciones={
        <>
          <Boton variante="contorno" onClick={cerrarYLimpiar}>
            Cancelar
          </Boton>
          <Boton
            type="submit"
            form="formulario-venta"
            cargando={registrar.isPending}
            disabled={excedeExistencia}
          >
            Registrar venta
          </Boton>
        </>
      }
    >
      <Stack component="form" id="formulario-venta" onSubmit={enviar} spacing={2.5} noValidate>
        {errorGeneral && <Alerta tipo="error">{errorGeneral}</Alerta>}

        <Campo etiqueta="Cliente" requerido error={campos.clienteId}>
          {(props) => (
            <Selector
              {...props}
              opciones={(clientes.data ?? []).map((cliente) => ({
                valor: cliente.id,
                etiqueta: cliente.nombre,
              }))}
              marcador={clientes.isPending ? "Cargando…" : "Selecciona el cliente"}
              value={formulario.clienteId}
              error={Boolean(campos.clienteId)}
              onChange={(evento) =>
                setFormulario((f) => ({ ...f, clienteId: evento.target.value }))
              }
            />
          )}
        </Campo>

        <Campo
          etiqueta="Lote de origen"
          requerido
          error={campos.loteCompraId}
          ayuda="El producto sale siempre de un lote de compra concreto."
        >
          {({ id, ...aria }) => (
            <SelectorLote
              id={id}
              ariaProps={aria}
              valor={formulario.loteCompraId}
              error={Boolean(campos.loteCompraId)}
              alCambiar={(loteId, seleccionado) => {
                setLote(seleccionado);
                setFormulario((f) => ({
                  ...f,
                  loteCompraId: loteId,
                  // Se propone el precio de compra como punto de partida; el
                  // encargado lo ajusta al precio de venta pactado.
                  precioUnitario:
                    f.precioUnitario ||
                    (seleccionado ? String(seleccionado.precioUnitario) : ""),
                }));
              }}
            />
          )}
        </Campo>

        <Box
          sx={{
            display: "grid",
            gap: 2.5,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
          }}
        >
          <Campo etiqueta="Fecha" requerido error={campos.fecha}>
            {(props) => (
              <Entrada
                {...props}
                type="date"
                value={formulario.fecha}
                error={Boolean(campos.fecha)}
                onChange={(evento) =>
                  setFormulario((f) => ({ ...f, fecha: evento.target.value }))
                }
              />
            )}
          </Campo>

          <Campo etiqueta="N.º de factura" error={campos.numeroFactura}>
            {(props) => (
              <Entrada
                {...props}
                value={formulario.numeroFactura}
                placeholder="Opcional"
                onChange={(evento) =>
                  setFormulario((f) => ({
                    ...f,
                    numeroFactura: evento.target.value,
                  }))
                }
              />
            )}
          </Campo>

          <Campo
            etiqueta="Cantidad"
            requerido
            error={
              campos.cantidad ??
              (excedeExistencia
                ? `El lote solo tiene ${formatearCantidad(lote?.cantidadDisponible ?? 0)}.`
                : undefined)
            }
            ayuda={
              lote
                ? `Disponible: ${formatearCantidad(lote.cantidadDisponible)}`
                : "En galones."
            }
          >
            {(props) => (
              <Entrada
                {...props}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                max={lote?.cantidadDisponible}
                value={formulario.cantidad}
                error={Boolean(campos.cantidad) || excedeExistencia}
                onChange={(evento) =>
                  setFormulario((f) => ({ ...f, cantidad: evento.target.value }))
                }
              />
            )}
          </Campo>

          <Campo etiqueta="Precio unitario" requerido error={campos.precioUnitario}>
            {(props) => (
              <Entrada
                {...props}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={formulario.precioUnitario}
                error={Boolean(campos.precioUnitario)}
                onChange={(evento) =>
                  setFormulario((f) => ({
                    ...f,
                    precioUnitario: evento.target.value,
                  }))
                }
              />
            )}
          </Campo>
        </Box>

        <Campo
          etiqueta="Detalle (barriles)"
          error={campos.detalle}
          ayuda="Cómo se reparte la cantidad en barriles, p. ej. «25x60» para 1500 galones en 25 barriles de 60."
        >
          {(props) => (
            <Entrada
              {...props}
              value={formulario.detalle}
              placeholder="Opcional, p. ej. 25x60"
              onChange={(evento) =>
                setFormulario((f) => ({ ...f, detalle: evento.target.value }))
              }
            />
          )}
        </Campo>

        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: 3,
            bgcolor: (tema) =>
              tema.palette.mode === "light" ? "grey.50" : "rgba(255,255,255,0.03)",
            px: 2,
            py: 1.5,
          }}
        >
          <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
            Total de la venta
          </Typography>
          <Typography
            sx={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "text.primary" }}
          >
            {formatearMonto(total)}
          </Typography>
        </Stack>
      </Stack>
    </Modal>
  );
}
