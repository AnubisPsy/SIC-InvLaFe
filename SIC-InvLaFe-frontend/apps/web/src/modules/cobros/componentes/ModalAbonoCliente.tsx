import {
  formatearFecha,
  formatearMonto,
  hoyISO,
  mensajeDeError,
  parsearNumero,
  type VentaDetalle,
} from "@invlafe/core";
import { useAbonosCliente, useRegistrarAbonoCliente } from "@invlafe/query";
import { Box, Stack, Typography } from "@mui/material";
import { HandCoins } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  Alerta,
  Boton,
  Campo,
  Cargador,
  Entrada,
  Modal,
} from "../../../shared/ui";
import { erroresDeCampo } from "../../auth/utiles/errores";

export function ModalAbonoCliente({
  venta,
  alCerrar,
  puedeAbonar,
}: {
  venta: VentaDetalle | null;
  alCerrar: () => void;
  puedeAbonar: boolean;
}) {
  const [fecha, setFecha] = useState(hoyISO());
  const [monto, setMonto] = useState("");

  const abonos = useAbonosCliente(venta?.id);
  const registrar = useRegistrarAbonoCliente();

  const campos = erroresDeCampo(registrar.error);
  const errorGeneral =
    registrar.error && Object.keys(campos).length === 0
      ? mensajeDeError(registrar.error)
      : null;

  function cerrarYLimpiar() {
    setMonto("");
    setFecha(hoyISO());
    registrar.reset();
    alCerrar();
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!venta) return;

    registrar.mutate(
      { ventaId: venta.id, fecha, monto: parsearNumero(monto) ?? 0 },
      {
        onSuccess: () => {
          setMonto("");
          registrar.reset();
        },
      },
    );
  }

  const saldada = venta ? venta.saldoPendiente <= 0 : false;

  return (
    <Modal
      abierto={Boolean(venta)}
      alCerrar={cerrarYLimpiar}
      titulo="Cobro al cliente"
      descripcion={
        venta
          ? `${venta.cliente?.nombre ?? "Cliente"} · ${formatearFecha(venta.fecha)} · Factura ${venta.numeroFactura ?? "—"}`
          : undefined
      }
      ancho="lg"
      acciones={
        <Boton variante="contorno" onClick={cerrarYLimpiar}>
          Cerrar
        </Boton>
      }
    >
      {venta && (
        <Stack spacing={3}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 1.5,
              borderRadius: 3,
              border: 1,
              borderColor: "divider",
              p: 2,
            }}
          >
            <Dato etiqueta="Total venta" valor={formatearMonto(venta.valorTotal)} />
            <Dato etiqueta="Cobrado" valor={formatearMonto(venta.totalCobrado)} />
            <Dato
              etiqueta="Saldo"
              valor={formatearMonto(venta.saldoPendiente)}
              destacado={!saldada}
            />
          </Box>

          {saldada ? (
            <Alerta tipo="exito" titulo="Venta saldada">
              El cliente ya pagó el total de esta venta.
            </Alerta>
          ) : puedeAbonar ? (
            <Stack component="form" onSubmit={enviar} spacing={2} noValidate>
              {errorGeneral && <Alerta tipo="error">{errorGeneral}</Alerta>}

              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
                }}
              >
                <Campo etiqueta="Fecha del abono" requerido error={campos.fecha}>
                  {(props) => (
                    <Entrada
                      {...props}
                      type="date"
                      value={fecha}
                      error={Boolean(campos.fecha)}
                      onChange={(evento) => setFecha(evento.target.value)}
                    />
                  )}
                </Campo>

                <Campo
                  etiqueta="Monto"
                  requerido
                  error={campos.monto}
                  ayuda={`Máximo ${formatearMonto(venta.saldoPendiente)}.`}
                >
                  {(props) => (
                    <Entrada
                      {...props}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={monto}
                      error={Boolean(campos.monto)}
                      onChange={(evento) => setMonto(evento.target.value)}
                    />
                  )}
                </Campo>
              </Box>

              <Boton
                type="submit"
                cargando={registrar.isPending}
                iconoInicio={<HandCoins size={16} aria-hidden />}
              >
                Registrar abono
              </Boton>
            </Stack>
          ) : (
            <Alerta tipo="info">
              Tu rol no tiene permiso para registrar cobros.
            </Alerta>
          )}

          <Box>
            <Typography sx={{ mb: 1.5, fontSize: 14, fontWeight: 500, color: "text.primary" }}>
              Historial de pagos
            </Typography>

            {abonos.isPending ? (
              <Cargador etiqueta="Cargando pagos…" />
            ) : abonos.data && abonos.data.length > 0 ? (
              <Stack
                component="ul"
                sx={{ listStyle: "none", m: 0, p: 0, borderRadius: 3, border: 1, borderColor: "divider" }}
              >
                {abonos.data.map((abono, indice) => (
                  <Stack
                    component="li"
                    direction="row"
                    key={abono.id}
                    sx={{
                      alignItems: "center",
                      justifyContent: "space-between",
                      px: 2,
                      py: 1.5,
                      borderTop: indice > 0 ? 1 : 0,
                      borderColor: "divider",
                    }}
                  >
                    <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
                      {formatearFecha(abono.fecha)}
                    </Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 500, fontVariantNumeric: "tabular-nums", color: "text.primary" }}>
                      {formatearMonto(abono.monto)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Typography
                sx={{
                  borderRadius: 3,
                  border: 1,
                  borderStyle: "dashed",
                  borderColor: "divider",
                  px: 2,
                  py: 3,
                  textAlign: "center",
                  fontSize: 14,
                  color: "text.secondary",
                }}
              >
                El cliente todavía no ha abonado nada de esta venta.
              </Typography>
            )}
          </Box>
        </Stack>
      )}
    </Modal>
  );
}

function Dato({
  etiqueta,
  valor,
  destacado = false,
}: {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <Box>
      <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{etiqueta}</Typography>
      <Typography
        sx={{
          mt: 0.25,
          fontSize: 14,
          fontVariantNumeric: "tabular-nums",
          fontWeight: destacado ? 600 : 500,
          color: destacado ? "error.600" : "text.primary",
        }}
      >
        {valor}
      </Typography>
    </Box>
  );
}
