import {
  MODULOS,
  PRODUCTOS,
  claveDeProducto,
  formatearCantidad,
  formatearFecha,
  formatearMonto,
  mensajeDeError,
  sumarMontos,
  type Cliente,
  type VentaDetalle,
} from "@invlafe/core";
import { useAnularVenta, useClientes, useVentas } from "@invlafe/query";
import { Box, Typography } from "@mui/material";
import { Coins, Fuel, Plus, Trash2, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { BarraFiltros, useFiltros } from "../../../shared/componentes/BarraFiltros";
import { InsigniaCobro } from "../../../shared/componentes/Estados";
import { MenuExportar } from "../../../shared/componentes/MenuExportar";
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
  Modal,
  Selector,
  Subtexto,
  Tabla,
  TarjetaMetrica,
  usePuede,
  useModal,
} from "../../../shared/ui";
import { exportarReporteExcel } from "../../../shared/utiles/exportarExcel";
import { construirDocumentoPdf } from "../../../shared/utiles/exportarPdf";
import {
  fechaISOaDate,
  nombreArchivoReporte,
  type ReporteExportable,
} from "../../../shared/utiles/reportes";
import { ModalNuevaVenta } from "../../ventas/componentes/ModalNuevaVenta";

interface FilaCarga {
  clave: string;
  fecha: string;
  cliente: Cliente | null;
  numeroFactura: string | null;
  galonaje: number;
  regular: number;
  diesel: number;
  kero: number;
  valorLubricante: number;
  valorCombustible: number;
  total: number;
  totalAbonado: number;
  saldo: number;
  /** Barriles por producto, p. ej. `{ Regular: "25x60" }`. */
  detallePorProducto: Record<string, string>;
}

/**
 * Precio por galón de la fila: si el combustible viene a un solo precio
 * —el caso normal— es exactamente ese; con varios precios en la misma
 * factura, queda el promedio implícito (valor ÷ galones).
 */
function precioPorGalon(fila: Pick<FilaCarga, "valorCombustible" | "galonaje">): number | null {
  return fila.galonaje > 0 ? fila.valorCombustible / fila.galonaje : null;
}

const ETIQUETA_PRODUCTO: Partial<Record<string, string>> = {
  [PRODUCTOS.REGULAR]: "Regular",
  [PRODUCTOS.DIESEL]: "Diesel",
  [PRODUCTOS.KERO]: "Kero",
  [PRODUCTOS.ACEITE]: "Aceite",
};

/** «Regular: 25x60 · Diesel: 10x60», o «—» si nadie anotó el detalle. */
function textoDetalle(detallePorProducto: Record<string, string>): string {
  const partes = Object.entries(detallePorProducto).map(
    ([producto, detalle]) => `${producto}: ${detalle}`,
  );
  return partes.length > 0 ? partes.join(" · ") : "—";
}

/**
 * Agrupa las ventas por factura y pivotea la cantidad a columnas por
 * producto, igual que la hoja "INVERSIONES LA FE — CONTROL DE CARGA": una
 * factura puede traer varios combustibles en la misma fila, cada uno con su
 * propio desglose en barriles. Solo alimenta la exportación: la tabla en
 * pantalla sigue mostrando una fila por venta.
 */
function agruparPorFactura(ventas: readonly VentaDetalle[]): FilaCarga[] {
  const grupos = new Map<string, FilaCarga>();

  for (const venta of ventas) {
    const clave = `${venta.numeroFactura ?? "sin-factura"}__${venta.fecha}__${venta.clienteId}`;
    const grupo = grupos.get(clave) ?? {
      clave,
      fecha: venta.fecha,
      cliente: venta.cliente,
      numeroFactura: venta.numeroFactura,
      galonaje: 0,
      regular: 0,
      diesel: 0,
      kero: 0,
      valorLubricante: 0,
      valorCombustible: 0,
      total: 0,
      totalAbonado: 0,
      saldo: 0,
      detallePorProducto: {},
    };

    const producto = claveDeProducto(venta.lote?.producto);
    if (producto === PRODUCTOS.REGULAR) grupo.regular += venta.cantidad;
    else if (producto === PRODUCTOS.DIESEL) grupo.diesel += venta.cantidad;
    else if (producto === PRODUCTOS.KERO) grupo.kero += venta.cantidad;

    if (producto === PRODUCTOS.ACEITE) {
      grupo.valorLubricante += venta.valorTotal;
    } else {
      grupo.valorCombustible += venta.valorTotal;
      grupo.galonaje += venta.cantidad;
    }

    if (venta.detalle && producto) {
      grupo.detallePorProducto[ETIQUETA_PRODUCTO[producto] ?? producto] = venta.detalle;
    }

    grupo.total += venta.valorTotal;
    grupo.totalAbonado += venta.totalCobrado;
    grupo.saldo += venta.saldoPendiente;
    grupos.set(clave, grupo);
  }

  return [...grupos.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function ControlCarga() {
  const { filtros, cambiar, reiniciar } = useFiltros();
  const [clienteId, setClienteId] = useState("");
  const [ventaAAnular, setVentaAAnular] = useState<string | null>(null);

  const permisos = usePuede(MODULOS.CONTROL_CARGA);
  const modalVenta = useModal();
  const clientes = useClientes();
  const anular = useAnularVenta();
  const previsualizar = usePrevisualizarPdf();

  const consulta = useVentas({
    desde: filtros.desde,
    hasta: filtros.hasta,
    busqueda: filtros.busqueda,
    ...(clienteId ? { clienteId } : {}),
  });

  // `consulta.data` es referencialmente estable en TanStack Query; el `?? []`
  // suelto crearía un array nuevo por render y anularía los `useMemo` de abajo.
  const ventas = useMemo(() => consulta.data ?? [], [consulta.data]);

  const totales = useMemo(() => {
    const clientesAtendidos = new Set(ventas.map((venta) => venta.clienteId)).size;

    return {
      galones: ventas.reduce((total, venta) => total + venta.cantidad, 0),
      facturado: sumarMontos(ventas.map((venta) => venta.valorTotal)),
      porCobrar: sumarMontos(ventas.map((venta) => venta.saldoPendiente)),
      clientesAtendidos,
      ventasConSaldo: ventas.filter((venta) => venta.saldoPendiente > 0).length,
    };
  }, [ventas]);

  const filasReporte = useMemo(() => agruparPorFactura(ventas), [ventas]);

  function construirReporte(): ReporteExportable {
    const totalesReporte = {
      lubricante: sumarMontos(filasReporte.map((f) => f.valorLubricante)),
      combustible: sumarMontos(filasReporte.map((f) => f.valorCombustible)),
      total: sumarMontos(filasReporte.map((f) => f.total)),
      totalAbonado: sumarMontos(filasReporte.map((f) => f.totalAbonado)),
    };

    return {
      titulo: "Control de carga",
      desde: filtros.desde,
      hasta: filtros.hasta,
      slug: "control-carga",
      columnas: [
        { encabezado: "Fecha", tipo: "fecha" },
        { encabezado: "Cliente", tipo: "texto" },
        { encabezado: "# Factura", tipo: "texto" },
        { encabezado: "Detalle (barriles)", tipo: "texto" },
        { encabezado: "Precio", tipo: "moneda" },
        { encabezado: "Regular", tipo: "cantidad" },
        { encabezado: "Diesel", tipo: "cantidad" },
        { encabezado: "Kero", tipo: "cantidad" },
        { encabezado: "Val. lubricante", tipo: "moneda" },
        { encabezado: "Val. combustible", tipo: "moneda" },
        { encabezado: "Total", tipo: "moneda" },
        { encabezado: "Total abonado", tipo: "moneda" },
        { encabezado: "Saldo pendiente", tipo: "moneda" },
      ],
      filas: filasReporte.map((f) => [
        fechaISOaDate(f.fecha),
        f.cliente?.nombre ?? "—",
        f.numeroFactura ?? "—",
        textoDetalle(f.detallePorProducto),
        precioPorGalon(f),
        f.regular > 0 ? f.regular : null,
        f.diesel > 0 ? f.diesel : null,
        f.kero > 0 ? f.kero : null,
        f.valorLubricante > 0 ? f.valorLubricante : null,
        f.valorCombustible > 0 ? f.valorCombustible : null,
        f.total,
        f.totalAbonado,
        f.saldo,
      ]),
      totales: [
        "Totales",
        "",
        "",
        "",
        null,
        null,
        null,
        null,
        totalesReporte.lubricante,
        totalesReporte.combustible,
        totalesReporte.total,
        totalesReporte.totalAbonado,
        null,
      ],
    };
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Control de carga"
        descripcion="Cada venta descuenta del lote seleccionado y deja el saldo pendiente a nombre del cliente."
        acciones={
          <Box sx={{ display: "flex", gap: 1 }}>
            <MenuExportar
              deshabilitado={filasReporte.length === 0}
              alElegirPdf={() => {
                const reporte = construirReporte();
                previsualizar.abrir({
                  titulo: reporte.titulo,
                  nombreArchivo: nombreArchivoReporte(reporte),
                  construir: () => construirDocumentoPdf(reporte),
                });
              }}
              alElegirExcel={() => exportarReporteExcel(construirReporte())}
            />
            {permisos.crear && (
              <Boton
                onClick={modalVenta.abrir}
                iconoInicio={<Plus size={16} aria-hidden />}
              >
                Registrar carga
              </Boton>
            )}
          </Box>
        }
      />

      <Box sx={{ mb: 3, display: "grid", gap: 2, gridTemplateColumns: { sm: "repeat(3, 1fr)" } }}>
        <TarjetaMetrica
          icono={<Fuel size={20} aria-hidden />}
          etiqueta="Galones despachados"
          valor={formatearCantidad(totales.galones)}
          nota={`${ventas.length} venta(s) en el periodo`}
        />
        <TarjetaMetrica
          icono={<TrendingUp size={20} aria-hidden />}
          etiqueta="Total facturado"
          valor={formatearMonto(totales.facturado)}
          nota={`${totales.clientesAtendidos} cliente(s) atendido(s)`}
          tono="exito"
        />
        <TarjetaMetrica
          icono={<Coins size={20} aria-hidden />}
          etiqueta="Por cobrar"
          valor={formatearMonto(totales.porCobrar)}
          nota={`${totales.ventasConSaldo} venta(s) con saldo`}
          tono={totales.porCobrar > 0 ? "advertencia" : "exito"}
        />
      </Box>

      <BarraFiltros
        filtros={filtros}
        alCambiar={cambiar}
        alReiniciar={() => {
          reiniciar();
          setClienteId("");
        }}
        marcadorBusqueda="Cliente, factura o producto…"
      >
        <Box>
          <Etiqueta htmlFor="filtro-cliente">Cliente</Etiqueta>
          <Selector
            id="filtro-cliente"
            marcador="Todos"
            value={clienteId}
            opciones={(clientes.data ?? []).map((cliente) => ({
              valor: cliente.id,
              etiqueta: cliente.nombre,
            }))}
            onChange={(evento) => setClienteId(evento.target.value)}
          />
        </Box>
      </BarraFiltros>

      {anular.error && (
        <Alerta tipo="error" sx={{ mb: 2 }} titulo="No se pudo anular la venta">
          {mensajeDeError(anular.error)}
        </Alerta>
      )}

      <Tabla anchoMinimo="lg">
        <Cabecera>
          <Fila>
            <Celda cabecera>Fecha</Celda>
            <Celda cabecera>Cliente</Celda>
            <Celda cabecera>Producto</Celda>
            <Celda cabecera alineacion="derecha">Cantidad</Celda>
            <Celda cabecera alineacion="derecha">Precio</Celda>
            <Celda cabecera alineacion="derecha">Total</Celda>
            <Celda cabecera alineacion="derecha">Saldo</Celda>
            <Celda cabecera>Cobro</Celda>
            {permisos.eliminar && <Celda cabecera alineacion="derecha">Acciones</Celda>}
          </Fila>
        </Cabecera>
        <Cuerpo>
          <EstadoConsulta
            enTabla
            cargando={consulta.isPending}
            error={consulta.error}
            datos={ventas}
            vacio={
              <Fila>
                <Celda colSpan={permisos.eliminar ? 9 : 8}>
                  <EstadoVacio
                    icono={<Fuel size={24} aria-hidden />}
                    titulo="No hay cargas registradas"
                    descripcion="Ajusta el rango de fechas o registra la primera venta del periodo."
                    accion={
                      permisos.crear && (
                        <Boton
                          onClick={modalVenta.abrir}
                          iconoInicio={<Plus size={16} aria-hidden />}
                        >
                          Registrar carga
                        </Boton>
                      )
                    }
                  />
                </Celda>
              </Fila>
            }
          >
            {(items) =>
              items.map((venta) => (
                <Fila key={venta.id}>
                  <Celda sx={{ whiteSpace: "nowrap" }}>
                    {formatearFecha(venta.fecha)}
                  </Celda>
                  {/*
                    La factura de la venta y el lote de origen bajan a una
                    segunda línea de su celda: son datos de apoyo y no merecen
                    una columna que empuje la tabla fuera de la pantalla.
                  */}
                  <Celda sx={{ fontWeight: 500, color: "text.primary" }}>
                    {venta.cliente?.nombre ?? "—"}
                    <Subtexto>
                      {venta.numeroFactura
                        ? `Factura ${venta.numeroFactura}`
                        : "Sin nº de factura"}
                    </Subtexto>
                  </Celda>
                  <Celda>
                    {venta.lote?.producto?.nombre ?? "—"}
                    {venta.lote && (
                      <Subtexto>
                        Lote {formatearFecha(venta.lote.fecha)}
                        {venta.lote.numeroFactura
                          ? ` · ${venta.lote.numeroFactura}`
                          : ""}
                      </Subtexto>
                    )}
                    {venta.detalle && <Subtexto>Barriles: {venta.detalle}</Subtexto>}
                  </Celda>
                  <CeldaNumero>{formatearCantidad(venta.cantidad)}</CeldaNumero>
                  <CeldaNumero>{formatearMonto(venta.precioUnitario)}</CeldaNumero>
                  <CeldaNumero destacado>
                    {formatearMonto(venta.valorTotal)}
                  </CeldaNumero>
                  <CeldaNumero>{formatearMonto(venta.saldoPendiente)}</CeldaNumero>
                  <Celda>
                    <InsigniaCobro estado={venta.estadoCobro} />
                  </Celda>
                  {permisos.eliminar && (
                    <Celda alineacion="derecha">
                      <Boton
                        variante="fantasma"
                        tamano="sm"
                        aria-label={`Anular venta del ${formatearFecha(venta.fecha)}`}
                        onClick={() => setVentaAAnular(venta.id)}
                        iconoInicio={
                          <Box component="span" sx={{ display: "flex", color: "error.500" }}>
                            <Trash2 size={16} aria-hidden />
                          </Box>
                        }
                      >
                        Anular
                      </Boton>
                    </Celda>
                  )}
                </Fila>
              ))
            }
          </EstadoConsulta>
        </Cuerpo>
      </Tabla>

      <ModalNuevaVenta abierto={modalVenta.abierto} alCerrar={modalVenta.cerrar} />

      <Modal
        abierto={Boolean(ventaAAnular)}
        alCerrar={() => setVentaAAnular(null)}
        titulo="Anular venta"
        ancho="sm"
        acciones={
          <>
            <Boton variante="contorno" onClick={() => setVentaAAnular(null)}>
              Cancelar
            </Boton>
            <Boton
              variante="peligro"
              cargando={anular.isPending}
              onClick={() => {
                if (!ventaAAnular) return;
                anular.mutate(ventaAAnular, {
                  onSuccess: () => setVentaAAnular(null),
                });
              }}
            >
              Anular venta
            </Boton>
          </>
        }
      >
        <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
          Se eliminará la venta y los galones volverán al lote de origen. Solo es
          posible si la venta todavía no tiene abonos del cliente.
        </Typography>
      </Modal>

      <ModalVistaPreviaPdf solicitud={previsualizar.solicitud} alCerrar={previsualizar.cerrar} />
    </>
  );
}
