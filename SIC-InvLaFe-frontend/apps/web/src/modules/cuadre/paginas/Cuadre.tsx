import {
  PRODUCTOS,
  claveDeProducto,
  formatearCantidad,
  formatearFecha,
  formatearMonto,
  porcentajeConsumido,
  type CuadreLote,
} from "@invlafe/core";
import { useCuadre, useProductos, useProveedores } from "@invlafe/query";
import { Box, Stack, Typography } from "@mui/material";
import { ChevronDown, Scale, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { BarraFiltros, useFiltros } from "../../../shared/componentes/BarraFiltros";
import { MenuExportar } from "../../../shared/componentes/MenuExportar";
import {
  ModalVistaPreviaPdf,
  usePrevisualizarPdf,
} from "../../../shared/componentes/ModalVistaPreviaPdf";
import {
  Alerta,
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
  Selector,
  Tabla,
} from "../../../shared/ui";
import { exportarReporteExcel } from "../../../shared/utiles/exportarExcel";
import { construirDocumentoPdf } from "../../../shared/utiles/exportarPdf";
import {
  fechaISOaDate,
  nombreArchivoReporte,
  type ReporteExportable,
} from "../../../shared/utiles/reportes";

interface FilaCuadreReporte {
  clave: string;
  fecha: string;
  detalle: "Compra" | "Venta";
  contraparte: string | null;
  numeroFactura: string | null;
  regular: number;
  diesel: number;
  invRegular: number;
  invDiesel: number;
  depositoCliente: number | null;
}

/**
 * Aplana los lotes del cuadre en un solo ledger cronológico, igual que la
 * hoja "CUADRE DE GALONES CARGADOS": cada compra suma al inventario, cada
 * venta lo resta, y las columnas Inv. Regular / Inv. Diesel llevan el
 * corrido — no el saldo de un lote suelto. Solo alimenta la exportación.
 */
function construirLedgerCuadre(cuadres: readonly CuadreLote[]): FilaCuadreReporte[] {
  interface Evento {
    fecha: string;
    creadoEn: string;
    tipo: "Compra" | "Venta";
    productoClave: ReturnType<typeof claveDeProducto>;
    cantidad: number;
    contraparte: string | null;
    numeroFactura: string | null;
    depositoCliente: number | null;
  }

  const eventos: Evento[] = [];

  for (const cuadre of cuadres) {
    const { lote } = cuadre;
    eventos.push({
      fecha: lote.fecha,
      creadoEn: lote.creadoEn,
      tipo: "Compra",
      productoClave: claveDeProducto(lote.producto),
      cantidad: lote.cantidadComprada,
      contraparte: lote.proveedor?.nombre ?? null,
      numeroFactura: lote.numeroFactura,
      depositoCliente: null,
    });

    for (const venta of cuadre.ventas) {
      eventos.push({
        fecha: venta.fecha,
        creadoEn: venta.creadoEn,
        tipo: "Venta",
        productoClave: claveDeProducto(lote.producto),
        cantidad: venta.cantidad,
        contraparte: venta.cliente?.nombre ?? null,
        numeroFactura: venta.numeroFactura,
        depositoCliente: venta.totalCobrado,
      });
    }
  }

  eventos.sort((a, b) =>
    a.fecha === b.fecha
      ? a.creadoEn.localeCompare(b.creadoEn)
      : a.fecha.localeCompare(b.fecha),
  );

  let invRegular = 0;
  let invDiesel = 0;

  return eventos.map((evento, indice) => {
    const signo = evento.tipo === "Compra" ? 1 : -1;
    if (evento.productoClave === PRODUCTOS.REGULAR) invRegular += signo * evento.cantidad;
    else if (evento.productoClave === PRODUCTOS.DIESEL) invDiesel += signo * evento.cantidad;

    return {
      clave: `${evento.tipo}-${indice}`,
      fecha: evento.fecha,
      detalle: evento.tipo,
      contraparte: evento.contraparte,
      numeroFactura: evento.numeroFactura,
      regular: evento.productoClave === PRODUCTOS.REGULAR ? evento.cantidad : 0,
      diesel: evento.productoClave === PRODUCTOS.DIESEL ? evento.cantidad : 0,
      invRegular,
      invDiesel,
      depositoCliente: evento.depositoCliente,
    };
  });
}

/**
 * Trazabilidad del inventario: cada lote (entrada) con sus ventas (salidas).
 *
 * No hay tabla de inventario detrás; todo se compone de `lotes_compra` y
 * `ventas`. La columna «diferencia» delata los lotes cuya existencia no
 * coincide con lo despachado, que es exactamente lo que un cuadre busca.
 */
export function Cuadre() {
  const { filtros, cambiar, reiniciar } = useFiltros();
  const [proveedorId, setProveedorId] = useState("");
  const [productoId, setProductoId] = useState("");
  const [expandido, setExpandido] = useState<string | null>(null);

  const proveedores = useProveedores();
  const productos = useProductos();
  const previsualizar = usePrevisualizarPdf();

  const consulta = useCuadre({
    desde: filtros.desde,
    hasta: filtros.hasta,
    busqueda: filtros.busqueda,
    ...(proveedorId ? { proveedorId } : {}),
    ...(productoId ? { productoId } : {}),
  });

  const { resumen } = consulta;
  // `consulta.data` es referencialmente estable en TanStack Query; el `?? []`
  // suelto crearía un array nuevo por render y anularía el `useMemo` de abajo.
  const cuadres = useMemo(() => consulta.data ?? [], [consulta.data]);

  const filasReporte = useMemo(() => construirLedgerCuadre(cuadres), [cuadres]);

  function construirReporte(): ReporteExportable {
    return {
      titulo: "Cuadre de galones cargados",
      desde: filtros.desde,
      hasta: filtros.hasta,
      slug: "cuadre-galones",
      columnas: [
        { encabezado: "Fecha", tipo: "fecha" },
        { encabezado: "Detalle", tipo: "texto" },
        { encabezado: "Cliente / Proveedor", tipo: "texto" },
        { encabezado: "# Factura", tipo: "texto" },
        { encabezado: "Regular", tipo: "cantidad" },
        { encabezado: "Diesel", tipo: "cantidad" },
        { encabezado: "Inv. Regular", tipo: "cantidad" },
        { encabezado: "Inv. Diesel", tipo: "cantidad" },
      ],
      filas: filasReporte.map((f) => [
        fechaISOaDate(f.fecha),
        f.detalle,
        f.contraparte ?? "—",
        f.numeroFactura ?? "—",
        f.regular > 0 ? f.regular : null,
        f.diesel > 0 ? f.diesel : null,
        f.invRegular,
        f.invDiesel,
      ]),
    };
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Cuadre de galones cargados"
        descripcion="Entradas por lote y salidas por venta. La diferencia debe ser cero: si no lo es, el lote se movió fuera del registro de ventas."
        acciones={
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
        }
      />

      <Box
        sx={{
          mb: 3,
          display: "grid",
          gap: "1px",
          overflow: "hidden",
          borderRadius: 4,
          border: 1,
          borderColor: "divider",
          bgcolor: "divider",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" },
        }}
      >
        <Totalizador
          etiqueta="Total comprado"
          valor={formatearCantidad(resumen.totalComprado)}
          nota={`${resumen.lotes} lote(s)`}
        />
        <Totalizador
          etiqueta="Total despachado"
          valor={formatearCantidad(resumen.totalVendido)}
          nota={
            resumen.totalComprado > 0
              ? `${Math.round((resumen.totalVendido / resumen.totalComprado) * 100)}% de lo comprado`
              : undefined
          }
        />
        <Totalizador
          etiqueta="Existencia actual"
          valor={formatearCantidad(resumen.totalDisponible)}
          nota={`En ${resumen.lotes} lote(s)`}
        />
        <Totalizador
          etiqueta="Lotes descuadrados"
          valor={String(resumen.lotesDescuadrados)}
          nota={`De ${resumen.lotes} lote(s) en el periodo`}
          alerta={resumen.lotesDescuadrados > 0}
        />
      </Box>

      {resumen.lotesDescuadrados > 0 && (
        <Alerta tipo="advertencia" sx={{ mb: 3 }} titulo="Hay lotes que no cuadran">
          En {resumen.lotesDescuadrados} lote(s), la existencia disponible no
          coincide con lo comprado menos lo vendido. Revisa si se editaron
          cantidades a mano en la base de datos.
        </Alerta>
      )}

      <BarraFiltros
        filtros={filtros}
        alCambiar={cambiar}
        alReiniciar={() => {
          reiniciar();
          setProveedorId("");
          setProductoId("");
        }}
        marcadorBusqueda="Factura, proveedor o producto…"
      >
        <Box>
          <Etiqueta htmlFor="cuadre-proveedor">Proveedor</Etiqueta>
          <Selector
            id="cuadre-proveedor"
            marcador="Todos"
            value={proveedorId}
            opciones={(proveedores.data ?? []).map((proveedor) => ({
              valor: proveedor.id,
              etiqueta: proveedor.nombre,
            }))}
            onChange={(evento) => setProveedorId(evento.target.value)}
          />
        </Box>

        <Box>
          <Etiqueta htmlFor="cuadre-producto">Producto</Etiqueta>
          <Selector
            id="cuadre-producto"
            marcador="Todos"
            value={productoId}
            opciones={(productos.data ?? []).map((producto) => ({
              valor: producto.id,
              etiqueta: producto.nombre,
            }))}
            onChange={(evento) => setProductoId(evento.target.value)}
          />
        </Box>
      </BarraFiltros>

      <EstadoConsulta
        cargando={consulta.isPending}
        error={consulta.error}
        datos={cuadres}
        vacio={
          <Box sx={{ borderRadius: 4, border: 1, borderColor: "divider", bgcolor: "background.paper" }}>
            <EstadoVacio
              icono={<Scale size={24} aria-hidden />}
              titulo="No hay lotes en este periodo"
              descripcion="Ajusta el rango de fechas para ver el movimiento de inventario."
            />
          </Box>
        }
      >
        {(items) => (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {items.map((cuadre) => (
              <FichaCuadre
                key={cuadre.lote.id}
                cuadre={cuadre}
                abierto={expandido === cuadre.lote.id}
                alAlternar={() =>
                  setExpandido((actual) =>
                    actual === cuadre.lote.id ? null : cuadre.lote.id,
                  )
                }
              />
            ))}
          </Box>
        )}
      </EstadoConsulta>

      <ModalVistaPreviaPdf solicitud={previsualizar.solicitud} alCerrar={previsualizar.cerrar} />
    </>
  );
}

function FichaCuadre({
  cuadre,
  abierto,
  alAlternar,
}: {
  cuadre: CuadreLote;
  abierto: boolean;
  alAlternar: () => void;
}) {
  const { lote } = cuadre;
  const consumido = porcentajeConsumido(lote);

  return (
    <Box
      component="section"
      sx={{
        overflow: "hidden",
        borderRadius: 4,
        border: 1,
        borderColor: cuadre.cuadra ? "divider" : "error.300",
        bgcolor: "background.paper",
      }}
    >
      <Box
        component="button"
        type="button"
        onClick={alAlternar}
        aria-expanded={abierto}
        sx={{
          display: "flex",
          width: "100%",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 2,
          px: 2.5,
          py: 2,
          textAlign: "left",
          bgcolor: "transparent",
          border: 0,
          cursor: "pointer",
          font: "inherit",
          color: "inherit",
          transition: "background-color 150ms",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Box
          component="span"
          sx={{
            display: "inline-flex",
            flexShrink: 0,
            color: "text.disabled",
            transition: "transform 150ms",
            transform: abierto ? "rotate(180deg)" : "none",
          }}
        >
          <ChevronDown size={20} aria-hidden />
        </Box>

        <Box sx={{ minWidth: 192, flex: 1 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 500, color: "text.primary" }}>
            {lote.producto?.nombre ?? "Producto"} ·{" "}
            {lote.proveedor?.nombre ?? "Proveedor"}
          </Typography>
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
            {formatearFecha(lote.fecha)}
            {lote.numeroFactura ? ` · Factura ${lote.numeroFactura}` : ""}
          </Typography>
        </Box>

        <Stack direction="row" sx={{ flexWrap: "wrap", alignItems: "center", columnGap: 3, rowGap: 1 }}>
          <Cifra etiqueta="Comprado" valor={formatearCantidad(lote.cantidadComprada)} />
          <Cifra etiqueta="Vendido" valor={formatearCantidad(cuadre.totalVendido)} />
          <Cifra etiqueta="Disponible" valor={formatearCantidad(cuadre.disponible)} />
          {cuadre.cuadra ? (
            <Insignia color="exito">Cuadra</Insignia>
          ) : (
            <Insignia color="error" icono={<TriangleAlert size={14} />}>
              Dif. {formatearCantidad(cuadre.diferencia)}
            </Insignia>
          )}
        </Stack>
      </Box>

      <Box sx={{ px: 2.5, pb: 2 }}>
        <Box
          sx={{
            height: 6,
            width: "100%",
            overflow: "hidden",
            borderRadius: 999,
            bgcolor: (tema) => (tema.palette.mode === "light" ? "grey.100" : "grey.800"),
          }}
          role="img"
          aria-label={`${Math.round(consumido)} % del lote despachado`}
        >
          <Box
            sx={{
              height: "100%",
              borderRadius: 999,
              bgcolor: "primary.500",
              transition: "width 200ms",
              width: `${consumido}%`,
            }}
          />
        </Box>
      </Box>

      {abierto && (
        <Box sx={{ borderTop: 1, borderColor: "divider", bgcolor: "action.hover", p: { xs: 2, sm: 2.5 } }}>
          <Typography component="h3" sx={{ mb: 1.5, fontSize: 14, fontWeight: 500, color: "text.secondary" }}>
            Salidas de este lote ({cuadre.ventas.length})
          </Typography>

          {cuadre.ventas.length === 0 ? (
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
              Este lote todavía no tiene ventas asociadas.
            </Typography>
          ) : (
            <Tabla>
              <Cabecera>
                <Fila>
                  <Celda cabecera>Fecha</Celda>
                  <Celda cabecera>Cliente</Celda>
                  <Celda cabecera>Factura</Celda>
                  <Celda cabecera alineacion="derecha">Cantidad</Celda>
                  <Celda cabecera alineacion="derecha">Precio</Celda>
                  <Celda cabecera alineacion="derecha">Total</Celda>
                  <Celda cabecera alineacion="derecha">Saldo</Celda>
                </Fila>
              </Cabecera>
              <Cuerpo>
                {cuadre.ventas.map((venta) => (
                  <Fila key={venta.id}>
                    <Celda sx={{ whiteSpace: "nowrap" }}>
                      {formatearFecha(venta.fecha)}
                    </Celda>
                    <Celda>{venta.cliente?.nombre ?? "—"}</Celda>
                    <Celda>{venta.numeroFactura ?? "—"}</Celda>
                    <CeldaNumero>{formatearCantidad(venta.cantidad)}</CeldaNumero>
                    <CeldaNumero>{formatearMonto(venta.precioUnitario)}</CeldaNumero>
                    <CeldaNumero destacado>
                      {formatearMonto(venta.valorTotal)}
                    </CeldaNumero>
                    <CeldaNumero>{formatearMonto(venta.saldoPendiente)}</CeldaNumero>
                  </Fila>
                ))}
                <Fila sx={{ bgcolor: "action.hover" }}>
                  <Celda colSpan={3} sx={{ fontWeight: 500 }}>
                    Totales
                  </Celda>
                  <CeldaNumero destacado>
                    {formatearCantidad(cuadre.totalVendido)}
                  </CeldaNumero>
                  <Celda />
                  <CeldaNumero destacado>
                    {formatearMonto(cuadre.totalFacturado)}
                  </CeldaNumero>
                  <Celda />
                </Fila>
              </Cuerpo>
            </Tabla>
          )}
        </Box>
      )}
    </Box>
  );
}

/**
 * Cifra de resumen sin ícono ni tarjeta propia: el color se reserva para
 * cuando el número exige atención, no para decorar cada cifra por igual.
 */
function Totalizador({
  etiqueta,
  valor,
  nota,
  alerta = false,
}: {
  etiqueta: string;
  valor: string;
  nota?: string;
  alerta?: boolean;
}) {
  return (
    <Box sx={{ bgcolor: "background.paper", p: 2.5 }}>
      <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{etiqueta}</Typography>
      <Typography
        sx={{
          mt: 0.5,
          fontSize: 22,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          color: alerta ? "error.main" : "text.primary",
        }}
      >
        {valor}
      </Typography>
      {nota && (
        <Typography sx={{ mt: 0.25, fontSize: 12, color: "text.secondary" }}>{nota}</Typography>
      )}
    </Box>
  );
}

function Cifra({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <Box sx={{ textAlign: "right" }}>
      <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{etiqueta}</Typography>
      <Typography sx={{ fontSize: 14, fontWeight: 500, fontVariantNumeric: "tabular-nums", color: "text.primary" }}>
        {valor}
      </Typography>
    </Box>
  );
}
