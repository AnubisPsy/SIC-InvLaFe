import {
  calcularValorTotal,
  formatearCantidad,
  formatearMonto,
  hoyISO,
  mensajeDeError,
  parsearNumero,
  sumarMontos,
  type CotizacionDetalle,
  type LineaConversion,
  type LoteCompraDetalle,
} from "@invlafe/core";
import { useConvertirCotizacion } from "@invlafe/query";
import { Box, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Alerta, Boton, Campo, Entrada, Modal } from "../../../shared/ui";
import { erroresDeCampo } from "../../auth/utiles/errores";
import { SelectorLote } from "../../ventas/componentes/SelectorLote";

/** Lo que el usuario ajusta por cada línea antes de facturar. */
interface EstadoLinea {
  loteCompraId: string;
  cantidad: string;
  precioUnitario: string;
  lote?: LoteCompraDetalle;
}

/**
 * Convierte una cotización aceptada en ventas.
 *
 * El cliente no se pide: sale de la propia cotización. Lo que falta para
 * facturar es de qué lote sale cada producto y a qué cantidad y precio
 * finales, porque entre la oferta y la entrega el precio puede haber cambiado.
 *
 * Cada línea genera su propia venta —el inventario se descuenta por lote— y la
 * operación es todo o nada: si una falla, se anulan las anteriores.
 */
export function ModalConvertir({
  cotizacion,
  alCerrar,
}: {
  cotizacion: CotizacionDetalle | null;
  alCerrar: () => void;
}) {
  const [fecha, setFecha] = useState(hoyISO());
  const [numeroFactura, setNumeroFactura] = useState("");
  const [porLinea, setPorLinea] = useState<Record<string, EstadoLinea>>({});

  const convertir = useConvertirCotizacion();

  const campos = erroresDeCampo(convertir.error);
  const errorGeneral =
    convertir.error && Object.keys(campos).length === 0
      ? mensajeDeError(convertir.error)
      : null;

  // Al abrir se parte de lo cotizado: cantidad y precio de la oferta, que es lo
  // que normalmente se factura. El lote es lo único que hay que elegir.
  useEffect(() => {
    if (!cotizacion) return;

    setFecha(hoyISO());
    setNumeroFactura("");
    setPorLinea(
      Object.fromEntries(
        cotizacion.lineas.map((linea) => [
          linea.id,
          {
            loteCompraId: "",
            cantidad: String(linea.cantidad),
            precioUnitario: String(linea.precioUnitario),
          },
        ]),
      ),
    );
  }, [cotizacion]);

  const lineas = useMemo<LineaConversion[]>(
    () =>
      (cotizacion?.lineas ?? []).map((linea) => {
        const estado = porLinea[linea.id];
        return {
          lineaId: linea.id,
          loteCompraId: estado?.loteCompraId ?? "",
          cantidad: parsearNumero(estado?.cantidad) ?? 0,
          precioUnitario: parsearNumero(estado?.precioUnitario) ?? 0,
        };
      }),
    [cotizacion, porLinea],
  );

  const total = sumarMontos(
    lineas.map((linea) => calcularValorTotal(linea.cantidad, linea.precioUnitario)),
  );

  // El botón se bloquea si cualquier línea pide más de lo que su lote tiene:
  // dejar enviar solo produciría una conversión a medias que hay que deshacer.
  const algunExceso = (cotizacion?.lineas ?? []).some((linea, indice) => {
    const estado = porLinea[linea.id];
    if (!estado?.lote) return false;
    return lineas[indice].cantidad > estado.lote.cantidadDisponible;
  });

  const faltaLote = lineas.some((linea) => !linea.loteCompraId);

  function cambiarLinea(lineaId: string, cambio: Partial<EstadoLinea>) {
    setPorLinea((actual) => ({
      ...actual,
      [lineaId]: { ...actual[lineaId], ...cambio },
    }));
  }

  function cerrarYLimpiar() {
    convertir.reset();
    alCerrar();
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!cotizacion) return;

    convertir.mutate(
      { id: cotizacion.id, datos: { fecha, numeroFactura, lineas } },
      { onSuccess: cerrarYLimpiar },
    );
  }

  return (
    <Modal
      abierto={Boolean(cotizacion)}
      alCerrar={cerrarYLimpiar}
      titulo="Convertir en venta"
      descripcion={
        cotizacion
          ? `Cliente: ${cotizacion.cliente?.nombre ?? "—"}. Se emitirá una venta por producto y la cotización quedará enlazada a ellas.`
          : undefined
      }
      ancho="xl"
      acciones={
        <>
          <Boton variante="contorno" onClick={cerrarYLimpiar}>
            Cancelar
          </Boton>
          <Boton
            type="submit"
            form="formulario-convertir"
            cargando={convertir.isPending}
            disabled={algunExceso || faltaLote}
          >
            Convertir en {lineas.length === 1 ? "venta" : `${lineas.length} ventas`}
          </Boton>
        </>
      }
    >
      {cotizacion && (
        <Box component="form" id="formulario-convertir" onSubmit={enviar} sx={{ display: "flex", flexDirection: "column", gap: 3 }} noValidate>
          {errorGeneral && <Alerta tipo="error">{errorGeneral}</Alerta>}

          <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { sm: "repeat(2, 1fr)" } }}>
            <Campo etiqueta="Fecha de la venta" requerido error={campos.fecha}>
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

            <Campo etiqueta="N.º de factura" error={campos.numeroFactura}>
              {(props) => (
                <Entrada
                  {...props}
                  value={numeroFactura}
                  placeholder="Opcional; se repite en todas las ventas"
                  onChange={(evento) => setNumeroFactura(evento.target.value)}
                />
              )}
            </Campo>
          </Box>

          {cotizacion.nota && (
            <Box sx={{ borderRadius: 3, border: 1, borderColor: "divider", p: 2 }}>
              <Typography sx={{ fontSize: 12, color: "text.secondary" }}>Nota</Typography>
              <Typography sx={{ mt: 0.5, whiteSpace: "pre-wrap", fontSize: 14, color: "text.secondary" }}>
                {cotizacion.nota}
              </Typography>
            </Box>
          )}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {cotizacion.lineas.map((linea, indice) => {
              const estado = porLinea[linea.id];
              const numerica = lineas[indice];
              const disponible = estado?.lote?.cantidadDisponible ?? 0;
              const excede = Boolean(estado?.lote) && numerica.cantidad > disponible;

              return (
                <Box
                  key={linea.id}
                  sx={{ borderRadius: 3, border: 1, borderColor: "divider", p: 2 }}
                >
                  <Stack
                    direction="row"
                    sx={{ mb: 1.5, flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 1 }}
                  >
                    <Typography component="span" sx={{ fontSize: 14, fontWeight: 500, color: "text.primary" }}>
                      {linea.producto?.nombre ?? "Producto"}
                    </Typography>
                    <Typography component="span" sx={{ fontSize: 12, color: "text.secondary" }}>
                      Cotizado: {formatearCantidad(linea.cantidad)} ×{" "}
                      {formatearMonto(linea.precioUnitario)} ={" "}
                      {formatearMonto(linea.subtotal)}
                    </Typography>
                  </Stack>

                  <Campo
                    etiqueta="Lote de origen"
                    requerido
                    error={campos[`lineas.${indice}.loteCompraId`]}
                  >
                    {({ id, ...aria }) => (
                      <SelectorLote
                        id={id}
                        ariaProps={aria}
                        productoId={linea.productoId}
                        valor={estado?.loteCompraId ?? ""}
                        error={Boolean(campos[`lineas.${indice}.loteCompraId`])}
                        alCambiar={(loteId, seleccionado) =>
                          cambiarLinea(linea.id, {
                            loteCompraId: loteId,
                            lote: seleccionado,
                          })
                        }
                      />
                    )}
                  </Campo>

                  <Box sx={{ mt: 2, display: "grid", gap: 2, gridTemplateColumns: { sm: "repeat(2, 1fr)" } }}>
                    <Campo
                      etiqueta="Cantidad a facturar"
                      requerido
                      error={
                        campos[`lineas.${indice}.cantidad`] ??
                        (excede
                          ? `El lote solo tiene ${formatearCantidad(disponible)}.`
                          : undefined)
                      }
                      ayuda={
                        estado?.lote
                          ? `Disponible: ${formatearCantidad(disponible)}`
                          : undefined
                      }
                    >
                      {(props) => (
                        <Entrada
                          {...props}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={estado?.cantidad ?? ""}
                          error={
                            Boolean(campos[`lineas.${indice}.cantidad`]) || excede
                          }
                          onChange={(evento) =>
                            cambiarLinea(linea.id, { cantidad: evento.target.value })
                          }
                        />
                      )}
                    </Campo>

                    <Campo
                      etiqueta="Precio unitario"
                      requerido
                      error={campos[`lineas.${indice}.precioUnitario`]}
                      ayuda={formatearMonto(
                        calcularValorTotal(
                          numerica.cantidad,
                          numerica.precioUnitario,
                        ),
                      )}
                    >
                      {(props) => (
                        <Entrada
                          {...props}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={estado?.precioUnitario ?? ""}
                          error={Boolean(campos[`lineas.${indice}.precioUnitario`])}
                          onChange={(evento) =>
                            cambiarLinea(linea.id, {
                              precioUnitario: evento.target.value,
                            })
                          }
                        />
                      )}
                    </Campo>
                  </Box>
                </Box>
              );
            })}
          </Box>

          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between", borderRadius: 3, bgcolor: "action.selected", px: 2, py: 1.5 }}
          >
            <Typography component="span" sx={{ fontSize: 14, color: "text.secondary" }}>
              Total a facturar
            </Typography>
            <Typography component="span" sx={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "text.primary" }}>
              {formatearMonto(total)}
            </Typography>
          </Stack>

          {Math.abs(total - cotizacion.total) > 0.005 && (
            <Alerta tipo="info">
              Lo que se va a facturar difiere de lo cotizado (
              {formatearMonto(cotizacion.total)}) en{" "}
              {formatearMonto(Math.abs(total - cotizacion.total))}.
            </Alerta>
          )}
        </Box>
      )}
    </Modal>
  );
}
