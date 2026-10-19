import {
  MODULOS,
  agruparCobrosPorCliente,
  formatearFecha,
  formatearMonto,
  sumarMontos,
  type VentaDetalle,
} from "@invlafe/core";
import { useClientes, useMovimientosCliente, useVentas } from "@invlafe/query";
import { Box, Typography } from "@mui/material";
import { CheckCircle2, ChevronDown, ChevronUp, HandCoins, Users, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { BarraFiltros, useFiltros } from "../../../shared/componentes/BarraFiltros";
import { InsigniaCobro } from "../../../shared/componentes/Estados";
import { MenuExportar } from "../../../shared/componentes/MenuExportar";
import {
  ModalVistaPreviaPdf,
  usePrevisualizarPdf,
} from "../../../shared/componentes/ModalVistaPreviaPdf";
import {
  Boton,
  Cabecera,
  Casilla,
  Celda,
  CeldaNumero,
  Cuerpo,
  EncabezadoPagina,
  EstadoConsulta,
  EstadoVacio,
  Etiqueta,
  Fila,
  Selector,
  Subtexto,
  Tabla,
  Tarjeta,
  TarjetaMetrica,
  usePuede,
} from "../../../shared/ui";
import { exportarReporteExcel } from "../../../shared/utiles/exportarExcel";
import { construirDocumentoPdf } from "../../../shared/utiles/exportarPdf";
import {
  fechaISOaDate,
  nombreArchivoReporte,
  type ReporteExportable,
} from "../../../shared/utiles/reportes";
import { ModalAbonoCliente } from "../componentes/ModalAbonoCliente";

/** Cuántos clientes se muestran antes de tener que pedir "ver todos". */
const LIMITE_DEUDA_VISIBLE = 6;

export function Cobros() {
  const { filtros, cambiar, reiniciar } = useFiltros();
  const [clienteId, setClienteId] = useState("");
  const [incluirSaldadas, setIncluirSaldadas] = useState(false);
  const [ventaEnCobro, setVentaEnCobro] = useState<VentaDetalle | null>(null);
  const [verTodaLaDeuda, setVerTodaLaDeuda] = useState(false);

  const permisos = usePuede(MODULOS.COBRO_CLIENTES);
  const clientes = useClientes();
  const previsualizar = usePrevisualizarPdf();

  const consulta = useVentas({
    desde: filtros.desde,
    hasta: filtros.hasta,
    busqueda: filtros.busqueda,
    ...(clienteId ? { clienteId } : {}),
    // Por defecto la pantalla es de deudas: las ventas ya cobradas solo
    // estorban salvo que se pidan explícitamente.
    ...(incluirSaldadas ? {} : { soloConSaldo: true }),
  });

  // `consulta.data` es referencialmente estable en TanStack Query; el `?? []`
  // suelto crearía un array nuevo por render y anularía los `useMemo` de abajo.
  const ventas = useMemo(() => consulta.data ?? [], [consulta.data]);

  // Ya viene ordenado de mayor a menor saldo: el deudor más grande siempre
  // encabeza la lista, sin importar cuántos clientes con crédito haya.
  const resumen = useMemo(
    () => agruparCobrosPorCliente(ventas.filter((venta) => venta.saldoPendiente > 0)),
    [ventas],
  );
  const resumenVisible = verTodaLaDeuda ? resumen : resumen.slice(0, LIMITE_DEUDA_VISIBLE);

  const totales = useMemo(() => {
    const facturado = sumarMontos(ventas.map((venta) => venta.valorTotal));
    const cobrado = sumarMontos(ventas.map((venta) => venta.totalCobrado));

    return {
      porCobrar: sumarMontos(ventas.map((venta) => venta.saldoPendiente)),
      cobrado,
      clientes: resumen.length,
      ventasConSaldo: ventas.filter((venta) => venta.saldoPendiente > 0).length,
      porcentajeCobrado: facturado > 0 ? Math.round((cobrado / facturado) * 100) : 0,
    };
  }, [ventas, resumen]);

  const ventaActiva = ventaEnCobro
    ? (ventas.find((venta) => venta.id === ventaEnCobro.id) ?? ventaEnCobro)
    : null;

  // El reporte es el ledger completo (ventas + abonos), independiente de si
  // "Incluir ventas saldadas" está marcado en la tabla operativa.
  const movimientos = useMovimientosCliente({
    desde: filtros.desde,
    hasta: filtros.hasta,
    busqueda: filtros.busqueda,
    ...(clienteId ? { clienteId } : {}),
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
      titulo: "Cobro a clientes",
      desde: filtros.desde,
      hasta: filtros.hasta,
      slug: "cobro-clientes",
      columnas: [
        { encabezado: "Fecha", tipo: "fecha" },
        { encabezado: "Cliente", tipo: "texto" },
        { encabezado: "# Factura", tipo: "texto" },
        { encabezado: "Galones", tipo: "cantidad" },
        { encabezado: "Valor factura", tipo: "moneda" },
        { encabezado: "Abono", tipo: "moneda" },
        { encabezado: "Saldo", tipo: "moneda" },
      ],
      filas: filasReporte.map((f) => [
        fechaISOaDate(f.fecha),
        f.cliente?.nombre ?? "—",
        f.numeroFactura ?? "—",
        f.cantidad,
        f.cargo,
        f.abono,
        f.saldo,
      ]),
      totales: ["Totales", "", "", null, totalesReporte.cargos, totalesReporte.abonos, null],
    };
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Cobro a clientes"
        descripcion="Saldos pendientes por venta. Cada abono baja el saldo de la venta a la que se aplica."
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
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
        }}
      >
        <TarjetaMetrica
          icono={<Wallet size={20} aria-hidden />}
          etiqueta="Total por cobrar"
          valor={formatearMonto(totales.porCobrar)}
          nota={`${totales.ventasConSaldo} venta(s) con saldo`}
          tono={totales.porCobrar > 0 ? "error" : "exito"}
        />
        <TarjetaMetrica
          icono={<CheckCircle2 size={20} aria-hidden />}
          etiqueta="Cobrado en el periodo"
          valor={formatearMonto(totales.cobrado)}
          nota={`${totales.porcentajeCobrado}% de lo facturado`}
          tono="exito"
        />
        <TarjetaMetrica
          icono={<Users size={20} aria-hidden />}
          etiqueta="Clientes con deuda"
          valor={String(totales.clientes)}
          nota={`${ventas.length} venta(s) en el periodo`}
          tono={totales.clientes > 0 ? "advertencia" : "exito"}
        />
      </Box>

      <BarraFiltros
        filtros={filtros}
        alCambiar={cambiar}
        alReiniciar={() => {
          reiniciar();
          setClienteId("");
          setIncluirSaldadas(false);
        }}
        marcadorBusqueda="Cliente o factura…"
      >
        <div>
          <Etiqueta htmlFor="filtro-cliente-cobro">Cliente</Etiqueta>
          <Selector
            id="filtro-cliente-cobro"
            marcador="Todos"
            value={clienteId}
            opciones={(clientes.data ?? []).map((cliente) => ({
              valor: cliente.id,
              etiqueta: cliente.nombre,
            }))}
            onChange={(evento) => setClienteId(evento.target.value)}
          />
        </div>

        <Box sx={{ display: "flex", alignItems: "flex-end", pb: 1.25 }}>
          <Casilla
            checked={incluirSaldadas}
            onChange={setIncluirSaldadas}
            etiqueta="Incluir ventas saldadas"
          />
        </Box>
      </BarraFiltros>

      {resumen.length > 0 && (
        <Tarjeta
          titulo="Deuda por cliente"
          descripcion={
            resumen.length > LIMITE_DEUDA_VISIBLE && !verTodaLaDeuda
              ? `Los ${LIMITE_DEUDA_VISIBLE} clientes con mayor saldo, de ${resumen.length} en total.`
              : "Suma de los saldos pendientes de cada cliente, del mayor al menor."
          }
          sx={{ mb: 3 }}
          sinRelleno
        >
          <Box
            sx={{
              display: "grid",
              gap: "1px",
              overflow: "hidden",
              bgcolor: "divider",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
            }}
          >
            {resumenVisible.map((item) => (
              <Box key={item.cliente.id} sx={{ bgcolor: "background.paper", p: 2 }}>
                <Typography
                  noWrap
                  sx={{ fontSize: 14, fontWeight: 500, color: "text.primary" }}
                >
                  {item.cliente.nombre}
                </Typography>
                <Typography
                  sx={{
                    mt: 0.5,
                    fontSize: 18,
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                    color: "error.600",
                  }}
                >
                  {formatearMonto(item.saldoPendiente)}
                </Typography>
                <Typography sx={{ mt: 0.25, fontSize: 12, color: "text.secondary" }}>
                  {item.ventas} venta(s) · {formatearMonto(item.totalCobrado)} cobrado
                </Typography>
              </Box>
            ))}
          </Box>

          {resumen.length > LIMITE_DEUDA_VISIBLE && (
            <Box
              component="button"
              type="button"
              onClick={() => setVerTodaLaDeuda((actual) => !actual)}
              sx={{
                display: "flex",
                width: "100%",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.5,
                borderTop: 1,
                borderColor: "divider",
                bgcolor: "transparent",
                py: 1.25,
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "inherit",
                color: "text.secondary",
                cursor: "pointer",
                borderRadius: "0 0 16px 16px",
                "&:hover": { color: "text.primary", bgcolor: "action.hover" },
              }}
            >
              {verTodaLaDeuda ? (
                <>
                  Ver menos <ChevronUp size={16} aria-hidden />
                </>
              ) : (
                <>
                  Ver los {resumen.length} clientes <ChevronDown size={16} aria-hidden />
                </>
              )}
            </Box>
          )}
        </Tarjeta>
      )}

      <Tabla anchoMinimo="md">
        <Cabecera>
          <Fila>
            <Celda cabecera>Fecha</Celda>
            <Celda cabecera>Cliente</Celda>
            <Celda cabecera>Producto</Celda>
            <Celda cabecera alineacion="derecha">Total</Celda>
            <Celda cabecera alineacion="derecha">Cobrado</Celda>
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
            datos={ventas}
            vacio={
              <Fila>
                <Celda colSpan={8}>
                  <EstadoVacio
                    icono={<CheckCircle2 size={24} aria-hidden />}
                    titulo="No hay saldos pendientes"
                    descripcion="Todas las ventas del periodo están cobradas, o no hay ventas registradas."
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
                  <Celda sx={{ fontWeight: 500, color: "text.primary" }}>
                    {venta.cliente?.nombre ?? "—"}
                    <Subtexto>
                      {venta.numeroFactura
                        ? `Factura ${venta.numeroFactura}`
                        : "Sin nº de factura"}
                    </Subtexto>
                  </Celda>
                  <Celda>{venta.lote?.producto?.nombre ?? "—"}</Celda>
                  <CeldaNumero>{formatearMonto(venta.valorTotal)}</CeldaNumero>
                  <CeldaNumero>{formatearMonto(venta.totalCobrado)}</CeldaNumero>
                  <CeldaNumero destacado>
                    {formatearMonto(venta.saldoPendiente)}
                  </CeldaNumero>
                  <Celda>
                    <InsigniaCobro estado={venta.estadoCobro} />
                  </Celda>
                  <Celda alineacion="derecha">
                    <Boton
                      variante="contorno"
                      tamano="sm"
                      onClick={() => setVentaEnCobro(venta)}
                      iconoInicio={<HandCoins size={16} aria-hidden />}
                    >
                      Cobrar
                    </Boton>
                  </Celda>
                </Fila>
              ))
            }
          </EstadoConsulta>
        </Cuerpo>
      </Tabla>

      <ModalAbonoCliente
        venta={ventaActiva}
        alCerrar={() => setVentaEnCobro(null)}
        puedeAbonar={permisos.crear}
      />

      <ModalVistaPreviaPdf solicitud={previsualizar.solicitud} alCerrar={previsualizar.cerrar} />
    </>
  );
}
