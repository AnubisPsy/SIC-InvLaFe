import {
  formatearCantidad,
  formatearFecha,
  formatearMonto,
  hoyISO,
  mensajeDeError,
  parsearNumero,
  type CompraDetalle,
} from "@invlafe/core";
import { useAbonosProveedor, useRegistrarAbonoProveedor } from "@invlafe/query";
import { Box, Stack, Typography } from "@mui/material";
import { Wallet } from "lucide-react";
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

/**
 * Abonos de una factura del proveedor.
 *
 * El abono es de la factura entera y no de cada producto: al proveedor se le
 * paga lo que dice el papel, no línea por línea. El detalle se muestra debajo
 * solo para saber qué se está pagando.
 */
export function ModalAbonoProveedor({
  compra,
  alCerrar,
  puedeAbonar,
}: {
  compra: CompraDetalle | null;
  alCerrar: () => void;
  puedeAbonar: boolean;
}) {
  const [fecha, setFecha] = useState(hoyISO());
  const [monto, setMonto] = useState("");

  const abonos = useAbonosProveedor(compra?.id);
  const registrar = useRegistrarAbonoProveedor();

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
    if (!compra) return;

    registrar.mutate(
      {
        compraId: compra.id,
        fecha,
        monto: parsearNumero(monto) ?? 0,
      },
      {
        onSuccess: () => {
          setMonto("");
          registrar.reset();
        },
      },
    );
  }

  const saldado = compra ? compra.saldoPendiente <= 0 : false;

  return (
    <Modal
      abierto={Boolean(compra)}
      alCerrar={cerrarYLimpiar}
      titulo="Abonos al proveedor"
      descripcion={
        compra
          ? `${compra.proveedor?.nombre ?? "Proveedor"} · Factura ${compra.numeroFactura ?? "—"} · ${formatearFecha(compra.fecha)}`
          : undefined
      }
      ancho="lg"
      acciones={
        <Boton variante="contorno" onClick={cerrarYLimpiar}>
          Cerrar
        </Boton>
      }
    >
      {compra && (
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
            <Dato
              etiqueta="Valor factura"
              valor={formatearMonto(compra.valorFactura)}
            />
            <Dato etiqueta="Pagado" valor={formatearMonto(compra.totalPagado)} />
            <Dato
              etiqueta="Saldo"
              valor={formatearMonto(compra.saldoPendiente)}
              destacado={!saldado}
            />
          </Box>

          <Box>
            <Typography sx={{ mb: 1, fontSize: 14, fontWeight: 500, color: "text.primary" }}>
              Productos de esta factura
            </Typography>
            <Stack
              component="ul"
              sx={{ listStyle: "none", m: 0, p: 0, borderRadius: 3, border: 1, borderColor: "divider" }}
            >
              {compra.lineas.map((linea, indice) => (
                <Stack
                  component="li"
                  direction="row"
                  key={linea.id}
                  sx={{
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                    px: 2,
                    py: 1.25,
                    borderTop: indice > 0 ? 1 : 0,
                    borderColor: "divider",
                  }}
                >
                  <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
                    {linea.producto?.nombre ?? "—"}
                  </Typography>
                  <Typography sx={{ fontSize: 14, fontVariantNumeric: "tabular-nums", color: "text.secondary" }}>
                    {formatearCantidad(linea.cantidadComprada)} ×{" "}
                    {formatearMonto(linea.precioUnitario)} ={" "}
                    <Typography component="span" sx={{ fontWeight: 500, color: "text.primary" }}>
                      {formatearMonto(linea.valorLinea)}
                    </Typography>
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>

          {saldado ? (
            <Alerta tipo="exito" titulo="Factura saldada">
              Esta factura ya está pagada por completo.
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
                  ayuda={`Máximo ${formatearMonto(compra.saldoPendiente)}.`}
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
                iconoInicio={<Wallet size={16} aria-hidden />}
              >
                Registrar abono
              </Boton>
            </Stack>
          ) : (
            <Alerta tipo="info">
              Tu rol no tiene permiso para registrar abonos en este módulo.
            </Alerta>
          )}

          <Box>
            <Typography sx={{ mb: 1.5, fontSize: 14, fontWeight: 500, color: "text.primary" }}>
              Historial de abonos
            </Typography>

            {abonos.isPending ? (
              <Cargador etiqueta="Cargando abonos…" />
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
                Todavía no hay abonos registrados para esta factura.
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
