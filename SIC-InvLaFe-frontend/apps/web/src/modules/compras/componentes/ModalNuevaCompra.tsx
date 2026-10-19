import {
  MAXIMO_LINEAS_COMPRA,
  formatearCantidad,
  formatearMonto,
  hoyISO,
  mensajeDeError,
  parsearNumero,
  valorDeLinea,
  valorFacturaSugerido,
  type ID,
  type NuevaLineaCompra,
} from "@invlafe/core";
import { useProductos, useProveedores, useRegistrarCompra } from "@invlafe/query";
import { Box, Stack, Typography } from "@mui/material";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Alerta,
  Boton,
  Campo,
  Entrada,
  Modal,
  Selector,
} from "../../../shared/ui";
import { erroresDeCampo } from "../../auth/utiles/errores";

interface Props {
  abierto: boolean;
  alCerrar: () => void;
  /** Preselecciona y bloquea el producto de la primera línea: lo usa "Control de aceite". */
  productoFijo?: ID | null;
  tituloProducto?: string;
}

/**
 * Línea del formulario. Las cantidades viven como texto porque un input
 * numérico a medio escribir ("12.") no es un número todavía, y convertirlo en
 * cada tecla borraría lo que el usuario está tecleando.
 */
interface LineaFormulario {
  /** Identidad estable de la fila: los índices se corrompen al borrar en medio. */
  clave: string;
  productoId: string;
  cantidadComprada: string;
  precioUnitario: string;
}

let contadorClaves = 0;
const nuevaLinea = (productoId = ""): LineaFormulario => ({
  clave: `linea-${++contadorClaves}`,
  productoId,
  cantidadComprada: "",
  precioUnitario: "",
});

const cabeceraVacia = () => ({
  proveedorId: "",
  fecha: hoyISO(),
  numeroFactura: "",
  valorFactura: "",
});

export function ModalNuevaCompra({
  abierto,
  alCerrar,
  productoFijo,
  tituloProducto,
}: Props) {
  const [cabecera, setCabecera] = useState(cabeceraVacia);
  const [lineas, setLineas] = useState<LineaFormulario[]>(() => [
    nuevaLinea(productoFijo ?? ""),
  ]);
  /**
   * El valor de la factura se autocalcula sumando las líneas, pero el proveedor
   * a veces factura un importe distinto (redondeos, descuentos, flete). En
   * cuanto el usuario lo edita dejamos de sobrescribirlo.
   */
  const [valorEditadoAMano, setValorEditadoAMano] = useState(false);

  const proveedores = useProveedores();
  const productos = useProductos();
  const registrar = useRegistrarCompra();

  const campos = erroresDeCampo(registrar.error);
  const errorGeneral =
    registrar.error && Object.keys(campos).length === 0
      ? mensajeDeError(registrar.error)
      : null;

  // Al reabrir el modal se parte de cero: arrastrar las líneas de la compra
  // anterior es la forma más fácil de duplicar una factura sin darse cuenta.
  useEffect(() => {
    if (!abierto) return;
    setCabecera(cabeceraVacia());
    setLineas([nuevaLinea(productoFijo ?? "")]);
    setValorEditadoAMano(false);
  }, [abierto, productoFijo]);

  const lineasNumericas = useMemo<NuevaLineaCompra[]>(
    () =>
      lineas.map((linea) => ({
        productoId: linea.productoId,
        cantidadComprada: parsearNumero(linea.cantidadComprada) ?? 0,
        precioUnitario: parsearNumero(linea.precioUnitario) ?? 0,
      })),
    [lineas],
  );

  const sugerido = valorFacturaSugerido(lineasNumericas);
  const valorFactura = valorEditadoAMano
    ? (parsearNumero(cabecera.valorFactura) ?? 0)
    : sugerido;

  const totalGalones = lineasNumericas.reduce(
    (total, linea) => total + linea.cantidadComprada,
    0,
  );

  const opcionesProveedor = useMemo(
    () =>
      (proveedores.data ?? []).map((proveedor) => ({
        valor: proveedor.id,
        etiqueta: proveedor.nombre,
      })),
    [proveedores.data],
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
    registrar.reset();
    alCerrar();
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();

    registrar.mutate(
      {
        proveedorId: cabecera.proveedorId,
        fecha: cabecera.fecha,
        numeroFactura: cabecera.numeroFactura,
        valorFactura,
        lineas: lineasNumericas,
      },
      { onSuccess: cerrarYLimpiar },
    );
  }

  const desajuste = Math.abs(valorFactura - sugerido) > 0.005;

  return (
    <Modal
      abierto={abierto}
      alCerrar={cerrarYLimpiar}
      titulo="Nueva compra"
      descripcion={
        tituloProducto
          ? `Registra una compra de ${tituloProducto} al proveedor.`
          : "Una factura del proveedor con todos los productos que trajo. Cada línea entra completa como existencia disponible."
      }
      ancho="xl"
      acciones={
        <>
          <Boton variante="contorno" onClick={cerrarYLimpiar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="formulario-compra" cargando={registrar.isPending}>
            Registrar compra
          </Boton>
        </>
      }
    >
      <Stack component="form" id="formulario-compra" onSubmit={enviar} spacing={3} noValidate>
        {errorGeneral && <Alerta tipo="error">{errorGeneral}</Alerta>}

        <Box
          sx={{
            display: "grid",
            gap: 2.5,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
          }}
        >
          <Campo etiqueta="Proveedor" requerido error={campos.proveedorId}>
            {(props) => (
              <Selector
                {...props}
                opciones={opcionesProveedor}
                marcador={
                  proveedores.isPending ? "Cargando…" : "Selecciona el proveedor"
                }
                value={cabecera.proveedorId}
                error={Boolean(campos.proveedorId)}
                onChange={(evento) =>
                  setCabecera((c) => ({ ...c, proveedorId: evento.target.value }))
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

          <Campo etiqueta="N.º de factura" error={campos.numeroFactura}>
            {(props) => (
              <Entrada
                {...props}
                value={cabecera.numeroFactura}
                placeholder="Opcional"
                onChange={(evento) =>
                  setCabecera((c) => ({ ...c, numeroFactura: evento.target.value }))
                }
              />
            )}
          </Campo>
        </Box>

        <Box>
          <Stack
            direction="row"
            sx={{ mb: 1.5, alignItems: "center", justifyContent: "space-between" }}
          >
            <Typography component="h3" sx={{ fontSize: 14, fontWeight: 500, color: "text.secondary" }}>
              Productos comprados
              <Typography component="span" sx={{ ml: 0.25, color: "error.main" }}>
                *
              </Typography>
            </Typography>
            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
              {lineas.length} de {MAXIMO_LINEAS_COMPRA}
            </Typography>
          </Stack>

          {campos.lineas && (
            <Typography sx={{ mb: 1.5, fontSize: 12, color: "error.main" }}>
              {campos.lineas}
            </Typography>
          )}

          <Stack spacing={1.5}>
            {lineas.map((linea, indice) => {
              const numerica = lineasNumericas[indice];
              const errorProducto = campos[`lineas.${indice}.productoId`];
              const errorCantidad = campos[`lineas.${indice}.cantidadComprada`];
              const errorPrecio = campos[`lineas.${indice}.precioUnitario`];
              // Se compara el producto y no el índice: si el usuario borra la
              // primera línea, la que ocupe su sitio no debe heredar el
              // candado y mostrar un nombre que no es el suyo.
              const fijado = Boolean(productoFijo) && linea.productoId === productoFijo;

              return (
                <Box
                  key={linea.clave}
                  sx={{ borderRadius: 3, border: 1, borderColor: "divider", p: 2 }}
                >
                  <Box
                    sx={{
                      display: "grid",
                      gap: 2,
                      gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr 1fr auto" },
                    }}
                  >
                    <Campo etiqueta="Producto" error={errorProducto}>
                      {(props) =>
                        fijado ? (
                          <Entrada
                            {...props}
                            value={tituloProducto ?? "Producto fijado"}
                            disabled
                          />
                        ) : (
                          <Selector
                            {...props}
                            opciones={opcionesProducto}
                            marcador={
                              productos.isPending ? "Cargando…" : "Selecciona"
                            }
                            value={linea.productoId}
                            error={Boolean(errorProducto)}
                            onChange={(evento) =>
                              cambiarLinea(linea.clave, {
                                productoId: evento.target.value,
                              })
                            }
                          />
                        )
                      }
                    </Campo>

                    <Campo etiqueta="Cantidad" error={errorCantidad} ayuda="En galones.">
                      {(props) => (
                        <Entrada
                          {...props}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={linea.cantidadComprada}
                          error={Boolean(errorCantidad)}
                          onChange={(evento) =>
                            cambiarLinea(linea.clave, {
                              cantidadComprada: evento.target.value,
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
                              valorDeLinea(
                                numerica.cantidadComprada,
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
                        // Con una sola línea no hay nada que quitar: una compra
                        // sin productos no existe.
                        disabled={lineas.length === 1}
                        onClick={() =>
                          setLineas((actuales) =>
                            actuales.filter((otra) => otra.clave !== linea.clave),
                          )
                        }
                        iconoInicio={<Trash2 size={16} aria-hidden />}
                      >
                        <Box component="span" sx={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                          Quitar línea
                        </Box>
                      </Boton>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Stack>

          <Boton
            variante="contorno"
            tamano="sm"
            sx={{ mt: 1.5 }}
            disabled={lineas.length >= MAXIMO_LINEAS_COMPRA}
            onClick={() => setLineas((actuales) => [...actuales, nuevaLinea()])}
            iconoInicio={<Plus size={16} aria-hidden />}
          >
            Añadir producto
          </Boton>
        </Box>

        <Box
          sx={{
            display: "grid",
            gap: 2.5,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
          }}
        >
          <Campo
            etiqueta="Valor de la factura"
            requerido
            error={campos.valorFactura}
            ayuda={
              valorEditadoAMano
                ? `Suma de las líneas: ${formatearMonto(sugerido)}. Estás usando un valor manual.`
                : "Se calcula sumando las líneas. Puedes cambiarlo si la factura trae otro importe."
            }
          >
            {(props) => (
              <Entrada
                {...props}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={valorEditadoAMano ? cabecera.valorFactura : String(sugerido)}
                error={Boolean(campos.valorFactura)}
                onChange={(evento) => {
                  setValorEditadoAMano(true);
                  setCabecera((c) => ({ ...c, valorFactura: evento.target.value }));
                }}
              />
            )}
          </Campo>

          <Stack
            sx={{
              justifyContent: "flex-end",
              gap: 0.5,
              borderRadius: 3,
              bgcolor: (tema) =>
                tema.palette.mode === "light" ? "grey.50" : "rgba(255,255,255,0.03)",
              px: 2,
              py: 1.5,
            }}
          >
            <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
              <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
                Total comprado
              </Typography>
              <Typography
                sx={{ fontSize: 14, fontWeight: 500, fontVariantNumeric: "tabular-nums", color: "text.primary" }}
              >
                {formatearCantidad(totalGalones)}
              </Typography>
            </Stack>
            <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
              <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
                A pagar al proveedor
              </Typography>
              <Typography
                sx={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "text.primary" }}
              >
                {formatearMonto(valorFactura)}
              </Typography>
            </Stack>
          </Stack>
        </Box>

        {desajuste && valorEditadoAMano && (
          <Alerta tipo="info">
            El importe manual difiere de la suma de las líneas en{" "}
            {formatearMonto(Math.abs(valorFactura - sugerido))}. Es normal si la
            factura incluye flete o un descuento; el saldo al proveedor se
            calculará sobre el importe manual.
          </Alerta>
        )}
      </Stack>
    </Modal>
  );
}
