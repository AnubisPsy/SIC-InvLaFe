import {
  ESTADOS_COTIZACION_LISTA,
  MODULOS,
  estaConvertida,
  formatearFecha,
  formatearMonto,
  mensajeDeError,
  puedeConvertirseEnVenta,
  type CotizacionDetalle,
  type EstadoCotizacion,
} from "@invlafe/core";
import {
  useClientes,
  useCotizaciones,
  useEliminarCotizacion,
} from "@invlafe/query";
import { Box, Stack, Typography } from "@mui/material";
import { ArrowRightLeft, FileDown, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { BarraFiltros, useFiltros } from "../../../shared/componentes/BarraFiltros";
import {
  ETIQUETAS_ESTADO_COTIZACION,
  InsigniaCotizacion,
} from "../../../shared/componentes/Estados";
import {
  ModalVistaPreviaPdf,
  usePrevisualizarPdf,
} from "../../../shared/componentes/ModalVistaPreviaPdf";
import {
  Alerta,
  Boton,
  Cabecera,
  Celda,
  CeldaNumero,
  Cuerpo,
  EncabezadoPagina,
  EstadoConsulta,
  EstadoVacio,
  Etiqueta,
  Fila,
  Insignia,
  Modal,
  Selector,
  Tabla,
  usePuede,
  useModal,
} from "../../../shared/ui";
import { ModalConvertir } from "../componentes/ModalConvertir";
import { ModalCotizacion } from "../componentes/ModalCotizacion";
import {
  construirDocumentoCotizacion,
  nombreArchivoCotizacion,
} from "../utiles/exportarCotizacionPdf";

export function Cotizaciones() {
  const { filtros, cambiar, reiniciar } = useFiltros();
  const [clienteId, setClienteId] = useState("");
  const [estado, setEstado] = useState<EstadoCotizacion | "">("");

  const [enEdicion, setEnEdicion] = useState<CotizacionDetalle | null>(null);
  const [enConversion, setEnConversion] = useState<CotizacionDetalle | null>(null);
  const [aEliminar, setAEliminar] = useState<CotizacionDetalle | null>(null);

  const permisos = usePuede(MODULOS.COTIZACIONES);
  const modalFormulario = useModal();
  const clientes = useClientes();
  const eliminar = useEliminarCotizacion();
  const previsualizar = usePrevisualizarPdf();

  const consulta = useCotizaciones({
    desde: filtros.desde,
    hasta: filtros.hasta,
    busqueda: filtros.busqueda,
    ...(clienteId ? { clienteId } : {}),
    ...(estado ? { estado } : {}),
  });

  function abrirNueva() {
    setEnEdicion(null);
    modalFormulario.abrir();
  }

  function abrirEdicion(cotizacion: CotizacionDetalle) {
    setEnEdicion(cotizacion);
    modalFormulario.abrir();
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Cotizaciones"
        descripcion="Ofertas a clientes, con una línea por producto. Al aceptarse se convierten en una venta por línea, enlazada a la cotización."
        acciones={
          permisos.crear && (
            <Boton
              onClick={abrirNueva}
              iconoInicio={<Plus size={16} aria-hidden />}
            >
              Nueva cotización
            </Boton>
          )
        }
      />

      <BarraFiltros
        filtros={filtros}
        alCambiar={cambiar}
        alReiniciar={() => {
          reiniciar();
          setClienteId("");
          setEstado("");
        }}
        marcadorBusqueda="Cliente, producto o nota…"
      >
        <Box>
          <Etiqueta htmlFor="cot-cliente">Cliente</Etiqueta>
          <Selector
            id="cot-cliente"
            marcador="Todos"
            value={clienteId}
            opciones={(clientes.data ?? []).map((cliente) => ({
              valor: cliente.id,
              etiqueta: cliente.nombre,
            }))}
            onChange={(evento) => setClienteId(evento.target.value)}
          />
        </Box>

        <Box>
          <Etiqueta htmlFor="cot-estado">Estado</Etiqueta>
          <Selector
            id="cot-estado"
            marcador="Todos"
            value={estado}
            opciones={ESTADOS_COTIZACION_LISTA.map((valor) => ({
              valor,
              etiqueta: ETIQUETAS_ESTADO_COTIZACION[valor].etiqueta,
            }))}
            onChange={(evento) =>
              setEstado(evento.target.value as EstadoCotizacion | "")
            }
          />
        </Box>
      </BarraFiltros>

      {eliminar.error && (
        <Alerta tipo="error" sx={{ mb: 2 }} titulo="No se pudo eliminar">
          {mensajeDeError(eliminar.error)}
        </Alerta>
      )}

      <Tabla anchoMinimo="md">
        <Cabecera>
          <Fila>
            <Celda cabecera>Fecha</Celda>
            <Celda cabecera>Cliente</Celda>
            <Celda cabecera>Productos</Celda>
            <Celda cabecera alineacion="derecha">Total</Celda>
            <Celda cabecera>Estado</Celda>
            <Celda cabecera>Venta</Celda>
            <Celda cabecera alineacion="derecha">Acciones</Celda>
          </Fila>
        </Cabecera>
        <Cuerpo>
          <EstadoConsulta
            enTabla
            cargando={consulta.isPending}
            error={consulta.error}
            datos={consulta.data}
            vacio={
              <Fila>
                <Celda colSpan={7}>
                  <EstadoVacio
                    icono={<FileText size={24} aria-hidden />}
                    titulo="No hay cotizaciones"
                    descripcion="Ajusta los filtros o crea la primera cotización del periodo."
                    accion={
                      permisos.crear && (
                        <Boton
                          onClick={abrirNueva}
                          iconoInicio={<Plus size={16} aria-hidden />}
                        >
                          Nueva cotización
                        </Boton>
                      )
                    }
                  />
                </Celda>
              </Fila>
            }
          >
            {(items) =>
              items.map((cotizacion) => {
                const convertida = estaConvertida(cotizacion);

                return (
                  <Fila key={cotizacion.id}>
                    <Celda sx={{ whiteSpace: "nowrap" }}>
                      {formatearFecha(cotizacion.fecha)}
                    </Celda>
                    <Celda sx={{ fontWeight: 500, color: "text.primary" }}>
                      {cotizacion.cliente?.nombre ?? "—"}
                    </Celda>
                    <Celda sx={{ maxWidth: 384 }}>
                      {cotizacion.lineas.length === 0 ? (
                        <Typography component="span" sx={{ fontSize: "inherit", color: "text.disabled" }}>
                          Sin productos
                        </Typography>
                      ) : (
                        <Box
                          component="ul"
                          sx={{ display: "flex", flexDirection: "column", gap: 0.25, listStyle: "none", pl: 0, m: 0 }}
                        >
                          {cotizacion.lineas.map((linea) => (
                            <Box component="li" key={linea.id} sx={{ whiteSpace: "nowrap" }}>
                              {linea.producto?.nombre ?? "—"}{" "}
                              <Typography
                                component="span"
                                sx={{ fontSize: "inherit", color: "text.disabled", fontVariantNumeric: "tabular-nums" }}
                              >
                                × {linea.cantidad}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Celda>
                    <CeldaNumero destacado>
                      {formatearMonto(cotizacion.total)}
                    </CeldaNumero>
                    <Celda>
                      <InsigniaCotizacion estado={cotizacion.estado} />
                    </Celda>
                    <Celda>
                      {convertida ? (
                        <Insignia color="primario">Facturada</Insignia>
                      ) : (
                        <Typography component="span" sx={{ fontSize: "inherit", color: "text.disabled" }}>
                          —
                        </Typography>
                      )}
                    </Celda>
                    <Celda alineacion="derecha">
                      <Stack direction="row" sx={{ justifyContent: "flex-end", gap: 0.5 }}>
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          aria-label="Exportar cotización a PDF"
                          title="Exportar a PDF"
                          onClick={() =>
                            previsualizar.abrir({
                              titulo: `Cotización — ${cotizacion.cliente?.nombre ?? "Cliente"}`,
                              nombreArchivo: nombreArchivoCotizacion(cotizacion),
                              construir: () => construirDocumentoCotizacion(cotizacion),
                            })
                          }
                          iconoInicio={<FileDown size={16} aria-hidden />}
                        />

                        {permisos.editar && !convertida && (
                          <Boton
                            variante="fantasma"
                            tamano="sm"
                            aria-label="Editar cotización"
                            onClick={() => abrirEdicion(cotizacion)}
                            iconoInicio={<Pencil size={16} aria-hidden />}
                          >
                            Editar
                          </Boton>
                        )}

                        {permisos.crear && puedeConvertirseEnVenta(cotizacion) && (
                          <Boton
                            variante="contorno"
                            tamano="sm"
                            onClick={() => setEnConversion(cotizacion)}
                            iconoInicio={
                              <ArrowRightLeft size={16} aria-hidden />
                            }
                          >
                            Convertir
                          </Boton>
                        )}

                        {permisos.eliminar && !convertida && (
                          <Boton
                            variante="fantasma"
                            tamano="sm"
                            aria-label="Eliminar cotización"
                            title="Eliminar"
                            onClick={() => setAEliminar(cotizacion)}
                            iconoInicio={
                              <Box component="span" sx={{ display: "flex", color: "error.500" }}>
                                <Trash2 size={16} aria-hidden />
                              </Box>
                            }
                          />
                        )}
                      </Stack>
                    </Celda>
                  </Fila>
                );
              })
            }
          </EstadoConsulta>
        </Cuerpo>
      </Tabla>

      <ModalCotizacion
        abierto={modalFormulario.abierto}
        cotizacion={enEdicion}
        alCerrar={() => {
          modalFormulario.cerrar();
          setEnEdicion(null);
        }}
      />

      <ModalConvertir
        cotizacion={enConversion}
        alCerrar={() => setEnConversion(null)}
      />

      <ModalVistaPreviaPdf solicitud={previsualizar.solicitud} alCerrar={previsualizar.cerrar} />

      <Modal
        abierto={Boolean(aEliminar)}
        alCerrar={() => setAEliminar(null)}
        titulo="Eliminar cotización"
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
          Se eliminará la cotización de{" "}
          <strong>{aEliminar?.cliente?.nombre ?? "el cliente"}</strong> del{" "}
          {aEliminar ? formatearFecha(aEliminar.fecha) : ""}. Esta acción no se
          puede deshacer.
        </Typography>
      </Modal>
    </>
  );
}
