import {
  ESTADOS_COTIZACION,
  ESTADOS_COTIZACION_LISTA,
  MAXIMO_LINEAS_COTIZACION,
  formatearCantidad,
  formatearMonto,
  hoyISO,
  mensajeDeError,
  parsearNumero,
  subtotalDeLinea,
  totalCotizado,
  type CotizacionDetalle,
  type EstadoCotizacion,
  type LineaCotizacionEntrada,
} from "@invlafe/core";
import {
  useActualizarCotizacion,
  useClientes,
  useCrearCotizacion,
  useProductos,
} from "@invlafe/query";
import { Box, Stack, Typography } from "@mui/material";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ETIQUETAS_ESTADO_COTIZACION } from "../../../shared/componentes/Estados";
import {
  Alerta,
  AreaTexto,
  Boton,
  Campo,
  Entrada,
  Modal,
  Selector,
} from "../../../shared/ui";
import { erroresDeCampo } from "../../auth/utiles/errores";

/**
 * Línea del formulario. Cantidad y precio viven como texto porque un número a
 * medio escribir ("12.") todavía no es un número, y convertirlo en cada tecla
 * borraría lo que el usuario está tecleando.
 */
interface LineaFormulario {
  /** Identidad estable de la fila: los índices se corrompen al borrar en medio. */
  clave: string;
  productoId: string;
  cantidad: string;
  precioUnitario: string;
}

let contadorClaves = 0;
const nuevaLinea = (): LineaFormulario => ({
  clave: `linea-${++contadorClaves}`,
  productoId: "",
  cantidad: "",
  precioUnitario: "",
});

const cabeceraVacia = () => ({
  clienteId: "",
  fecha: hoyISO(),
  nota: "",
  estado: ESTADOS_COTIZACION.PENDIENTE as EstadoCotizacion,
});

export function ModalCotizacion({
  abierto,
  cotizacion,
  alCerrar,
}: {
  abierto: boolean;
  /** `null` crea una cotización nueva; con valor, la edita. */
  cotizacion: CotizacionDetalle | null;
  alCerrar: () => void;
}) {
  const [cabecera, setCabecera] = useState(cabeceraVacia);
  const [lineas, setLineas] = useState<LineaFormulario[]>(() => [nuevaLinea()]);

  const clientes = useClientes();
  const productos = useProductos();
  const crear = useCrearCotizacion();
  const actualizar = useActualizarCotizacion();

  const mutacion = cotizacion ? actualizar : crear;
  const campos = erroresDeCampo(mutacion.error);
  const errorGeneral =
    mutacion.error && Object.keys(campos).length === 0
      ? mensajeDeError(mutacion.error)
      : null;

  // Al abrir en modo edición se precarga la cotización; al abrir en modo alta
  // se limpia, para no arrastrar lo que quedó de la vez anterior.
  useEffect(() => {
    if (!abierto) return;

    if (cotizacion) {
      setCabecera({
        clienteId: cotizacion.clienteId,
        fecha: cotizacion.fecha,
        nota: cotizacion.nota ?? "",
        estado: cotizacion.estado,
      });
      setLineas(
        cotizacion.lineas.length > 0
          ? cotizacion.lineas.map((linea) => ({
              clave: `linea-${++contadorClaves}`,
              productoId: linea.productoId,
              cantidad: String(linea.cantidad),
              precioUnitario: String(linea.precioUnitario),
            }))
          : [nuevaLinea()],
      );
    } else {
      setCabecera(cabeceraVacia());
      setLineas([nuevaLinea()]);
    }
  }, [abierto, cotizacion]);

  const lineasNumericas = useMemo<LineaCotizacionEntrada[]>(
    () =>
      lineas.map((linea) => ({
        productoId: linea.productoId,
        cantidad: parsearNumero(linea.cantidad) ?? 0,
        precioUnitario: parsearNumero(linea.precioUnitario) ?? 0,
      })),
    [lineas],
  );

  const total = totalCotizado(lineasNumericas);
  const totalCantidad = lineasNumericas.reduce(
    (suma, linea) => suma + linea.cantidad,
    0,
  );

  const opcionesProducto = useMemo(
    () =>
      (productos.data ?? []).map((producto) => ({
        valor: producto.id,
        etiqueta: producto.nombre,
      })),
    [productos.data],
  );

  function cambiarLinea(clave: string, cambio: Partial<LineaFormulario>) {
    setLineas((actuales) =>
      actuales.map((linea) =>
        linea.clave === clave ? { ...linea, ...cambio } : linea,
      ),
    );
  }

  function cerrarYLimpiar() {
    crear.reset();
    actualizar.reset();
    alCerrar();
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();

    const datos = {
      clienteId: cabecera.clienteId,
      fecha: cabecera.fecha,
      nota: cabecera.nota,
      estado: cabecera.estado,
      lineas: lineasNumericas,
    };

    if (cotizacion) {
      actualizar.mutate(
        { id: cotizacion.id, datos },
        { onSuccess: cerrarYLimpiar },
      );
    } else {
      crear.mutate(datos, { onSuccess: cerrarYLimpiar });
    }
  }

  return (
    <Modal
      abierto={abierto}
      alCerrar={cerrarYLimpiar}
      titulo={cotizacion ? "Editar cotización" : "Nueva cotización"}
      descripcion="Una línea por producto cotizado. El total se calcula solo."
      ancho="xl"
      acciones={
        <>
          <Boton variante="contorno" onClick={cerrarYLimpiar}>
            Cancelar
          </Boton>
          <Boton
            type="submit"
            form="formulario-cotizacion"
            cargando={mutacion.isPending}
          >
            {cotizacion ? "Guardar cambios" : "Crear cotización"}
          </Boton>
        </>
      }
    >
      <Box
        component="form"
        id="formulario-cotizacion"
        onSubmit={enviar}
        sx={{ display: "flex", flexDirection: "column", gap: 3 }}
        noValidate
      >
        {errorGeneral && <Alerta tipo="error">{errorGeneral}</Alerta>}

        <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { sm: "repeat(3, 1fr)" } }}>
          <Campo etiqueta="Cliente" requerido error={campos.clienteId}>
            {(props) => (
              <Selector
                {...props}
                opciones={(clientes.data ?? []).map((cliente) => ({
                  valor: cliente.id,
                  etiqueta: cliente.nombre,
                }))}
                marcador={clientes.isPending ? "Cargando…" : "Selecciona el cliente"}
                value={cabecera.clienteId}
                error={Boolean(campos.clienteId)}
                onChange={(evento) =>
                  setCabecera((c) => ({ ...c, clienteId: evento.target.value }))
                }
              />
            )}
          </Campo>

          <Campo etiqueta="Fecha" requerido error={campos.fecha}>
            {(props) => (
              <Entrada
                {...props}
                type="date"
                value={cabecera.fecha}
                error={Boolean(campos.fecha)}
                onChange={(evento) =>
                  setCabecera((c) => ({ ...c, fecha: evento.target.value }))
                }
              />
            )}
          </Campo>

          <Campo etiqueta="Estado" requerido error={campos.estado}>
            {(props) => (
              <Selector
                {...props}
                opciones={ESTADOS_COTIZACION_LISTA.map((estado) => ({
                  valor: estado,
                  etiqueta: ETIQUETAS_ESTADO_COTIZACION[estado].etiqueta,
                }))}
                value={cabecera.estado}
                error={Boolean(campos.estado)}
                onChange={(evento) =>
                  setCabecera((c) => ({
                    ...c,
                    estado: evento.target.value as EstadoCotizacion,
                  }))
                }
              />
            )}
          </Campo>
        </Box>

        <Box>
          <Stack direction="row" sx={{ mb: 1.5, alignItems: "center", justifyContent: "space-between" }}>
            <Typography component="h3" sx={{ fontSize: 14, fontWeight: 500, color: "text.secondary" }}>
              Productos cotizados
              <Typography component="span" sx={{ ml: 0.25, color: "error.500" }}>*</Typography>
            </Typography>
            <Typography component="span" sx={{ fontSize: 12, color: "text.secondary" }}>
              {lineas.length} de {MAXIMO_LINEAS_COTIZACION}
            </Typography>
          </Stack>

          {campos.lineas && (
            <Typography sx={{ mb: 1.5, fontSize: 12, color: "error.500" }}>{campos.lineas}</Typography>
          )}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {lineas.map((linea, indice) => {
              const numerica = lineasNumericas[indice];
              const errorProducto = campos[`lineas.${indice}.productoId`];
              const errorCantidad = campos[`lineas.${indice}.cantidad`];
              const errorPrecio = campos[`lineas.${indice}.precioUnitario`];

              return (
                <Box
                  key={linea.clave}
                  sx={{ borderRadius: 3, border: 1, borderColor: "divider", p: 2 }}
                >
                  <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { sm: "2fr 1fr 1fr auto" } }}>
                    <Campo etiqueta="Producto" error={errorProducto}>
                      {(props) => (
                        <Selector
                          {...props}
                          opciones={opcionesProducto}
                          marcador={productos.isPending ? "Cargando…" : "Selecciona"}
                          value={linea.productoId}
                          error={Boolean(errorProducto)}
                          onChange={(evento) =>
                            cambiarLinea(linea.clave, {
                              productoId: evento.target.value,
                            })
                          }
                        />
                      )}
                    </Campo>

                    <Campo etiqueta="Cantidad" error={errorCantidad} ayuda="En galones.">
                      {(props) => (
                        <Entrada
                          {...props}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={linea.cantidad}
                          error={Boolean(errorCantidad)}
                          onChange={(evento) =>
                            cambiarLinea(linea.clave, {
                              cantidad: evento.target.value,
                            })
                          }
                        />
                      )}
                    </Campo>

                    <Campo
                      etiqueta="Precio unitario"
                      error={errorPrecio}
                      ayuda={
                        numerica
                          ? formatearMonto(
                              subtotalDeLinea(
                                numerica.cantidad,
                                numerica.precioUnitario,
                              ),
                            )
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
                          value={linea.precioUnitario}
                          error={Boolean(errorPrecio)}
                          onChange={(evento) =>
                            cambiarLinea(linea.clave, {
                              precioUnitario: evento.target.value,
                            })
                          }
                        />
                      )}
                    </Campo>

                    <Box sx={{ display: "flex", alignItems: "flex-end", pb: 0.5 }}>
                      <Boton
                        variante="contorno"
                        tamano="sm"
                        // Con una sola línea no hay nada que quitar: una
                        // cotización sin productos no cotiza nada.
                        disabled={lineas.length === 1}
                        onClick={() =>
                          setLineas((actuales) =>
                            actuales.filter((otra) => otra.clave !== linea.clave),
                          )
                        }
                        iconoInicio={<Trash2 size={16} aria-hidden />}
                      >
                        <Box
                          component="span"
                          sx={{
                            position: "absolute",
                            width: 1,
                            height: 1,
                            padding: 0,
                            margin: -1,
                            overflow: "hidden",
                            clip: "rect(0, 0, 0, 0)",
                            whiteSpace: "nowrap",
                            border: 0,
                          }}
                        >
                          Quitar línea
                        </Box>
                      </Boton>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>

          <Boton
            variante="contorno"
            tamano="sm"
            sx={{ mt: 1.5 }}
            disabled={lineas.length >= MAXIMO_LINEAS_COTIZACION}
            onClick={() => setLineas((actuales) => [...actuales, nuevaLinea()])}
            iconoInicio={<Plus size={16} aria-hidden />}
          >
            Añadir producto
          </Boton>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, borderRadius: 3, bgcolor: "action.selected", px: 2, py: 1.5 }}>
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
            <Typography component="span" sx={{ fontSize: 14, color: "text.secondary" }}>
              Total cotizado
            </Typography>
            <Typography component="span" sx={{ fontSize: 14, fontWeight: 500, fontVariantNumeric: "tabular-nums", color: "text.primary" }}>
              {formatearCantidad(totalCantidad)}
            </Typography>
          </Stack>
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
            <Typography component="span" sx={{ fontSize: 14, color: "text.secondary" }}>
              Importe de la oferta
            </Typography>
            <Typography component="span" sx={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "text.primary" }}>
              {formatearMonto(total)}
            </Typography>
          </Stack>
        </Box>

        <Campo
          etiqueta="Nota"
          error={campos.nota}
          ayuda="Opcional: condiciones de entrega, plazo de validez, forma de pago…"
        >
          {(props) => (
            <AreaTexto
              {...props}
              rows={3}
              value={cabecera.nota}
              error={Boolean(campos.nota)}
              placeholder="Ej.: entrega en planta, oferta válida 15 días."
              onChange={(evento) =>
                setCabecera((c) => ({ ...c, nota: evento.target.value }))
              }
            />
          )}
        </Campo>
      </Box>
    </Modal>
  );
}
