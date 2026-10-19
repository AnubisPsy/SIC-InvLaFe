import {
  formatearCantidad,
  formatearFecha,
  formatearMonto,
  mensajeDeError,
  sumarMontos,
  type ClaveModulo,
  type CompraDetalle,
  type EstadoPago,
  type ID,
} from "@invlafe/core";
import {
  useAnularCompra,
  useCompras,
  useMovimientosProveedor,
  useProveedores,
} from "@invlafe/query";
import { Box, IconButton, Typography } from "@mui/material";
import {
  Banknote,
  ChevronDown,
  ChevronRight,
  FileWarning,
  Package,
  Plus,
  Receipt,
  Trash2,
  Wallet,
} from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { BarraFiltros, useFiltros } from "../../../shared/componentes/BarraFiltros";
import { InsigniaPago } from "../../../shared/componentes/Estados";
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
import { ModalAbonoProveedor } from "./ModalAbonoProveedor";
import { ModalNuevaCompra } from "./ModalNuevaCompra";

export interface PropsPantallaCompras {
  modulo: ClaveModulo;
  titulo: string;
  descripcion: string;
  /** `"aceite"` restringe el módulo a ese producto; sin valor muestra todos. */
  soloProducto?: "aceite" | "combustible";
  /** Producto preseleccionado al crear una compra desde un módulo restringido. */
  productoFijo?: ID | null;
  nombreProducto?: string;
}

const OPCIONES_ESTADO: { valor: EstadoPago | ""; etiqueta: string }[] = [
  { valor: "pendiente", etiqueta: "Sin abonar" },
  { valor: "parcial", etiqueta: "Abonado parcialmente" },
  { valor: "pagado", etiqueta: "Saldado" },
];

const COLUMNAS = 10;

/** Resumen de productos para la fila plegada: «Diésel, Regular +1». */
function resumirProductos(compra: CompraDetalle): string {
  const nombres = compra.lineas.map((linea) => linea.producto?.nombre ?? "—");
  if (nombres.length === 0) return "—";
  if (nombres.length <= 2) return nombres.join(", ");
  return `${nombres.slice(0, 2).join(", ")} +${nombres.length - 2}`;
}

/**
 * Pantalla de compras al proveedor y sus abonos.
 *
 * "Pago a proveedor" y "Control de aceite" son la misma pantalla con distinto
 * filtro de producto y distinto módulo de permisos, así que comparten este
 * componente en vez de duplicar la tabla y los dos modales.
 *
 * La unidad de la tabla es la factura, no el producto: una compra trae varios
 * y se despliega para verlos. Filtrar por producto no recorta la factura,
 * decide qué facturas se listan, así que en "Control de aceite" sigues viendo
 * qué más venía en el mismo camión.
 */
export function PantallaCompras({
  modulo,
  titulo,
  descripcion,
  soloProducto,
  productoFijo,
  nombreProducto,
}: PropsPantallaCompras) {
  const { filtros, cambiar, reiniciar } = useFiltros();
  const [proveedorId, setProveedorId] = useState("");
  const [estadoPago, setEstadoPago] = useState<EstadoPago | "">("");
  const [compraEnAbono, setCompraEnAbono] = useState<CompraDetalle | null>(null);
  const [compraAAnular, setCompraAAnular] = useState<CompraDetalle | null>(null);
  const [desplegadas, setDesplegadas] = useState<ReadonlySet<ID>>(new Set());

  const permisos = usePuede(modulo);
  const modalCompra = useModal();
  const proveedores = useProveedores();
  const previsualizar = usePrevisualizarPdf();
  const anular = useAnularCompra();

  const consulta = useCompras({
    desde: filtros.desde,
    hasta: filtros.hasta,
    busqueda: filtros.busqueda,
    ...(proveedorId ? { proveedorId } : {}),
    ...(estadoPago ? { estadoPago } : {}),
    ...(soloProducto ? { soloProducto } : {}),
  });

  // `consulta.data` es referencialmente estable en TanStack Query; el `?? []`
  // suelto crearía un array nuevo por render y anularía el `useMemo` de abajo.
  const compras = useMemo(() => consulta.data ?? [], [consulta.data]);

  const totales = useMemo(() => {
    const facturado = sumarMontos(compras.map((compra) => compra.valorFactura));
    const pagado = sumarMontos(compras.map((compra) => compra.totalPagado));
    const proveedoresConSaldo = new Set(
      compras
        .filter((compra) => compra.saldoPendiente > 0)
        .map((compra) => compra.proveedorId),
    ).size;

    return {
      facturado,
      pagado,
      saldo: sumarMontos(compras.map((compra) => compra.saldoPendiente)),
      pendientes: compras.filter((compra) => compra.estadoPago !== "pagado").length,
      porcentajePagado: facturado > 0 ? Math.round((pagado / facturado) * 100) : 0,
      proveedoresConSaldo,
    };
  }, [compras]);

  // El reporte es un ledger (apertura + abonos) y no la lista de facturas de
  // arriba, así que se pide aparte con los mismos filtros visibles en pantalla.
  const movimientos = useMovimientosProveedor({
    desde: filtros.desde,
    hasta: filtros.hasta,
    busqueda: filtros.busqueda,
    ...(proveedorId ? { proveedorId } : {}),
    ...(soloProducto ? { soloProducto } : {}),
  });
  const filasReporte = useMemo(() => movimientos.data ?? [], [movimientos.data]);

  function construirReporte(): ReporteExportable {
    const totalesReporte = {
      cargos: sumarMontos(
        filasReporte.filter((f) => f.tipo === "apertura").map((f) => f.cargo ?? 0),
      ),
      abonos: sumarMontos(
        filasReporte.filter((f) => f.tipo === "abono").map((f) => f.abono ?? 0),
      ),
    };

    return {
      titulo,
      desde: filtros.desde,
      hasta: filtros.hasta,
      slug: soloProducto === "aceite" ? "control-aceite" : "pago-proveedor",
      columnas: [
        { encabezado: "Fecha", tipo: "fecha" },
        { encabezado: "Proveedor", tipo: "texto" },
        { encabezado: "# Factura", tipo: "texto" },
        { encabezado: "Cantidad", tipo: "cantidad" },
        { encabezado: "Valor factura", tipo: "moneda" },
        { encabezado: "Depósito", tipo: "moneda" },
        { encabezado: "Saldo", tipo: "moneda" },
      ],
      filas: filasReporte.map((f) => [
        fechaISOaDate(f.fecha),
        f.proveedor?.nombre ?? "—",
        f.numeroFactura ?? "—",
        f.cantidad,
        f.cargo,
        f.abono,
        f.saldo,
      ]),
      totales: ["Totales", "", "", null, totalesReporte.cargos, totalesReporte.abonos, null],
    };
  }

  // La compra abierta en el modal se relee del listado para que el saldo se
  // actualice solo cuando se registra un abono.
  const compraActiva = compraEnAbono
    ? (compras.find((compra) => compra.id === compraEnAbono.id) ?? compraEnAbono)
    : null;

  function alternarDespliegue(id: ID) {
    setDesplegadas((actuales) => {
      const siguiente = new Set(actuales);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  return (
    <>
      <EncabezadoPagina
        titulo={titulo}
        descripcion={descripcion}
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
                onClick={modalCompra.abrir}
                iconoInicio={<Plus size={16} aria-hidden />}
              >
                Nueva compra
              </Boton>
            )}
          </Box>
        }
      />

      <Box
        sx={{
          mb: 3,
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" },
        }}
      >
        <TarjetaMetrica
          icono={<Receipt size={20} aria-hidden />}
          etiqueta="Total facturado"
          valor={formatearMonto(totales.facturado)}
          nota={`${compras.length} compra(s) en el periodo`}
        />
        <TarjetaMetrica
          icono={<Banknote size={20} aria-hidden />}
          etiqueta="Total pagado"
          valor={formatearMonto(totales.pagado)}
          nota={`${totales.porcentajePagado}% de lo facturado`}
          tono="exito"
        />
        <TarjetaMetrica
          icono={<Wallet size={20} aria-hidden />}
          etiqueta="Saldo pendiente"
          valor={formatearMonto(totales.saldo)}
          nota={`${totales.proveedoresConSaldo} proveedor(es) con saldo`}
          tono={totales.saldo > 0 ? "error" : "exito"}
        />
        <TarjetaMetrica
          icono={<FileWarning size={20} aria-hidden />}
          etiqueta="Facturas por saldar"
          valor={String(totales.pendientes)}
          tono={totales.pendientes > 0 ? "advertencia" : "exito"}
          nota={`De ${compras.length} compra(s) en el periodo`}
        />
      </Box>

      <BarraFiltros
        filtros={filtros}
        alCambiar={cambiar}
        alReiniciar={() => {
          reiniciar();
          setProveedorId("");
          setEstadoPago("");
        }}
        marcadorBusqueda="Factura, proveedor o producto…"
      >
        <div>
          <Etiqueta htmlFor="filtro-proveedor">Proveedor</Etiqueta>
          <Selector
            id="filtro-proveedor"
            marcador="Todos"
            value={proveedorId}
            opciones={(proveedores.data ?? []).map((proveedor) => ({
              valor: proveedor.id,
              etiqueta: proveedor.nombre,
            }))}
            onChange={(evento) => setProveedorId(evento.target.value)}
          />
        </div>

        <div>
          <Etiqueta htmlFor="filtro-estado">Estado de pago</Etiqueta>
          <Selector
            id="filtro-estado"
            marcador="Todos"
            value={estadoPago}
            opciones={OPCIONES_ESTADO.map((opcion) => ({
              valor: opcion.valor,
              etiqueta: opcion.etiqueta,
            }))}
            onChange={(evento) =>
              setEstadoPago(evento.target.value as EstadoPago | "")
            }
          />
        </div>
      </BarraFiltros>

      <Tabla anchoMinimo="lg">
        <Cabecera>
          <Fila>
            <Celda cabecera />
            <Celda cabecera>Fecha</Celda>
            <Celda cabecera>Proveedor</Celda>
            <Celda cabecera>Productos</Celda>
            <Celda cabecera alineacion="derecha">Comprado</Celda>
            <Celda cabecera alineacion="derecha">Disponible</Celda>
            <Celda cabecera alineacion="derecha">Valor</Celda>
            <Celda cabecera alineacion="derecha">Saldo</Celda>
            <Celda cabecera>Estado</Celda>
            <Celda cabecera alineacion="derecha">Acciones</Celda>
          </Fila>
        </Cabecera>
        <Cuerpo>
          <EstadoConsulta
            enTabla
            cargando={consulta.isPending}
            error={consulta.error}
            datos={compras}
            vacio={
              <Fila>
                <Celda colSpan={COLUMNAS}>
                  <EstadoVacio
                    icono={<Package size={24} aria-hidden />}
                    titulo="No hay compras en este periodo"
                    descripcion="Ajusta las fechas o registra una nueva compra al proveedor."
                    accion={
                      permisos.crear && (
                        <Boton
                          onClick={modalCompra.abrir}
                          iconoInicio={<Plus size={16} aria-hidden />}
                        >
                          Nueva compra
                        </Boton>
                      )
                    }
                  />
                </Celda>
              </Fila>
            }
          >
            {(items) =>
              items.map((compra) => {
                const desplegada = desplegadas.has(compra.id);

                return (
                  <Fragment key={compra.id}>
                    <Fila>
                      <Celda sx={{ width: 40 }}>
                        <IconButton
                          size="small"
                          onClick={() => alternarDespliegue(compra.id)}
                          aria-expanded={desplegada}
                          aria-label={
                            desplegada
                              ? "Ocultar los productos de la factura"
                              : "Ver los productos de la factura"
                          }
                          sx={{ color: "text.disabled", "&:hover": { color: "text.primary" } }}
                        >
                          {desplegada ? (
                            <ChevronDown size={16} />
                          ) : (
                            <ChevronRight size={16} />
                          )}
                        </IconButton>
                      </Celda>
                      <Celda sx={{ whiteSpace: "nowrap" }}>
                        {formatearFecha(compra.fecha)}
                      </Celda>
                      <Celda sx={{ fontWeight: 500, color: "text.primary" }}>
                        {compra.proveedor?.nombre ?? "—"}
                        <Subtexto>
                          {compra.numeroFactura
                            ? `Factura ${compra.numeroFactura}`
                            : "Sin nº de factura"}
                        </Subtexto>
                      </Celda>
                      <Celda>{resumirProductos(compra)}</Celda>
                      <CeldaNumero>
                        {formatearCantidad(compra.totalComprado)}
                      </CeldaNumero>
                      <CeldaNumero
                        sx={compra.totalDisponible <= 0 ? { color: "text.disabled" } : undefined}
                      >
                        {formatearCantidad(compra.totalDisponible)}
                      </CeldaNumero>
                      <CeldaNumero>{formatearMonto(compra.valorFactura)}</CeldaNumero>
                      {/*
                        Lo pagado no tiene columna propia: es el valor menos el
                        saldo, y el desglose completo está en el modal de abonos.
                      */}
                      <CeldaNumero destacado>
                        {formatearMonto(compra.saldoPendiente)}
                      </CeldaNumero>
                      <Celda>
                        <InsigniaPago estado={compra.estadoPago} />
                      </Celda>
                      <Celda alineacion="derecha">
                        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
                          <Boton
                            variante="contorno"
                            tamano="sm"
                            onClick={() => setCompraEnAbono(compra)}
                            iconoInicio={<Wallet size={16} aria-hidden />}
                          >
                            Abonos
                          </Boton>
                          {permisos.eliminar && (
                            <Boton
                              variante="fantasma"
                              tamano="sm"
                              aria-label={`Anular compra del ${formatearFecha(compra.fecha)}`}
                              onClick={() => {
                                anular.reset();
                                setCompraAAnular(compra);
                              }}
                              iconoInicio={
                                <Box component="span" sx={{ display: "flex", color: "error.500" }}>
                                  <Trash2 size={16} aria-hidden />
                                </Box>
                              }
                            >
                              Anular
                            </Boton>
                          )}
                        </Box>
                      </Celda>
                    </Fila>

                    {desplegada && (
                      <Fila
                        sx={{
                          bgcolor: (tema) =>
                            tema.palette.mode === "light" ? "grey.50" : "rgba(255,255,255,0.02)",
                        }}
                      >
                        <Celda colSpan={COLUMNAS} sx={{ px: 2, py: 1.5 }}>
                          <DetalleLineas compra={compra} />
                        </Celda>
                      </Fila>
                    )}
                  </Fragment>
                );
              })
            }
          </EstadoConsulta>
        </Cuerpo>
      </Tabla>

      <ModalNuevaCompra
        abierto={modalCompra.abierto}
        alCerrar={modalCompra.cerrar}
        productoFijo={productoFijo ?? null}
        tituloProducto={nombreProducto}
      />

      <ModalAbonoProveedor
        compra={compraActiva}
        alCerrar={() => setCompraEnAbono(null)}
        puedeAbonar={permisos.crear}
      />

      <Modal
        abierto={Boolean(compraAAnular)}
        alCerrar={() => setCompraAAnular(null)}
        titulo="Anular compra"
        ancho="sm"
        acciones={
          <>
            <Boton variante="contorno" onClick={() => setCompraAAnular(null)}>
              Cancelar
            </Boton>
            <Boton
              variante="peligro"
              cargando={anular.isPending}
              onClick={() => {
                if (!compraAAnular) return;
                anular.mutate(compraAAnular.id, {
                  onSuccess: () => setCompraAAnular(null),
                });
              }}
            >
              Anular compra
            </Boton>
          </>
        }
      >
        {anular.error && (
          <Alerta tipo="error" sx={{ mb: 2 }} titulo="No se pudo anular la compra">
            {mensajeDeError(anular.error)}
          </Alerta>
        )}

        {compraAAnular && compraAAnular.totalPagado > 0 && (
          <Alerta tipo="advertencia" sx={{ mb: 2 }} titulo="Esta factura ya tiene abonos">
            Se registraron {formatearMonto(compraAAnular.totalPagado)} en abonos al
            proveedor por esta factura. Al anular la compra, esos abonos también
            se eliminan y no queda registro de ese pago: cuádralo con el
            proveedor por fuera de la app antes de continuar.
          </Alerta>
        )}

        <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
          Se eliminará la factura y sus líneas de inventario. Solo es posible si
          ninguna de sus líneas tiene ventas despachadas.
        </Typography>
      </Modal>

      <ModalVistaPreviaPdf solicitud={previsualizar.solicitud} alCerrar={previsualizar.cerrar} />
    </>
  );
}

/** Las líneas de la factura, dentro de la fila desplegada. */
function DetalleLineas({ compra }: { compra: CompraDetalle }) {
  if (compra.lineas.length === 0) {
    return (
      <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
        Esta factura no tiene productos registrados.
      </Typography>
    );
  }

  return (
    <Box>
      <Tabla>
        <Cabecera>
          <Fila>
            <Celda cabecera>Producto</Celda>
            <Celda cabecera alineacion="derecha">Comprado</Celda>
            <Celda cabecera alineacion="derecha">Despachado</Celda>
            <Celda cabecera alineacion="derecha">Disponible</Celda>
            <Celda cabecera alineacion="derecha">Precio</Celda>
            <Celda cabecera alineacion="derecha">Valor</Celda>
          </Fila>
        </Cabecera>
        <Cuerpo>
          {compra.lineas.map((linea) => (
            <Fila key={linea.id}>
              <Celda sx={{ fontWeight: 500, color: "text.primary" }}>
                {linea.producto?.nombre ?? "—"}
              </Celda>
              <CeldaNumero>{formatearCantidad(linea.cantidadComprada)}</CeldaNumero>
              <CeldaNumero>{formatearCantidad(linea.cantidadDespachada)}</CeldaNumero>
              <CeldaNumero
                sx={linea.cantidadDisponible <= 0 ? { color: "text.disabled" } : undefined}
              >
                {formatearCantidad(linea.cantidadDisponible)}
              </CeldaNumero>
              <CeldaNumero>{formatearMonto(linea.precioUnitario)}</CeldaNumero>
              <CeldaNumero>{formatearMonto(linea.valorLinea)}</CeldaNumero>
            </Fila>
          ))}
          <Fila
            sx={{
              bgcolor: (tema) =>
                tema.palette.mode === "light" ? "grey.50" : "rgba(255,255,255,0.02)",
            }}
          >
            <Celda
              sx={{
                fontSize: 12,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: 0.4,
                color: "text.secondary",
                borderTop: 1,
                borderColor: "divider",
              }}
            >
              Suma de las líneas
            </Celda>
            <Celda alineacion="derecha" sx={{ borderTop: 1, borderColor: "divider" }}>
              <Typography
                component="span"
                sx={{ fontVariantNumeric: "tabular-nums", fontSize: 14, color: "text.secondary" }}
              >
                {formatearCantidad(compra.totalComprado)}
              </Typography>
            </Celda>
            <Celda colSpan={3} sx={{ borderTop: 1, borderColor: "divider" }} />
            <Celda alineacion="derecha" sx={{ borderTop: 1, borderColor: "divider" }}>
              <Typography
                component="span"
                sx={{
                  fontVariantNumeric: "tabular-nums",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "text.primary",
                }}
              >
                {formatearMonto(compra.totalLineas)}
              </Typography>
            </Celda>
          </Fila>
        </Cuerpo>
      </Tabla>

      {Math.abs(compra.totalLineas - compra.valorFactura) > 0.005 && (
        <Typography sx={{ mt: 2, fontSize: 12, color: "text.secondary" }}>
          La factura se emitió por {formatearMonto(compra.valorFactura)}, que
          difiere de la suma de las líneas. El saldo al proveedor se calcula
          sobre el importe de la factura.
        </Typography>
      )}
    </Box>
  );
}
