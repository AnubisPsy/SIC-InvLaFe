import { formatearCantidad, formatearMonto, sumarMontos } from "@invlafe/core";
import { usePermisos, useSesion, useVentas } from "@invlafe/query";
import { useCompras, useLotes } from "@invlafe/query";
import { alpha, Box, Typography } from "@mui/material";
import { ArrowRight, Fuel, Package, Wallet } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";
import { NAVEGACION } from "../../../app/navegacion";
import { AvisoSinAcceso } from "../../../app/guardias";
import { EncabezadoPagina, Tarjeta, TarjetaMetrica } from "../../../shared/ui";

/**
 * Panel de entrada.
 *
 * Solo consulta lo que el rol puede ver: pedir métricas de un módulo sin
 * permiso devolvería vacío por RLS y mostraría ceros engañosos.
 */
export function Inicio() {
  const { data: sesion } = useSesion();
  const { puedeVer } = usePermisos();

  const verCompras = puedeVer("pago_proveedor") || puedeVer("control_aceite");
  const verVentas = puedeVer("control_carga") || puedeVer("cobro_clientes");

  // Existencia y deuda salen de dos consultas distintas porque viven en dos
  // niveles: los galones están en cada línea y el saldo, en la factura.
  const lotes = useLotes(verCompras ? {} : undefined);
  const compras = useCompras(verCompras ? {} : undefined);
  const ventas = useVentas(verVentas ? {} : undefined);

  const metricas = useMemo(() => {
    const listaLotes = verCompras ? (lotes.data ?? []) : [];
    const listaCompras = verCompras ? (compras.data ?? []) : [];
    const listaVentas = verVentas ? (ventas.data ?? []) : [];

    return {
      existencia: listaLotes.reduce(
        (total, lote) => total + lote.cantidadDisponible,
        0,
      ),
      lotesConExistencia: listaLotes.filter((lote) => lote.cantidadDisponible > 0)
        .length,
      deudaProveedor: sumarMontos(
        listaCompras.map((compra) => compra.saldoPendiente),
      ),
      facturasPendientes: listaCompras.filter(
        (compra) => compra.saldoPendiente > 0,
      ).length,
      porCobrar: sumarMontos(listaVentas.map((venta) => venta.saldoPendiente)),
      ventasPendientes: listaVentas.filter((venta) => venta.saldoPendiente > 0)
        .length,
    };
  }, [lotes.data, compras.data, ventas.data, verCompras, verVentas]);

  const modulosVisibles = NAVEGACION.filter((entrada) => puedeVer(entrada.modulo));
  const nombre = sesion?.usuario?.nombre?.split(" ")[0];

  return (
    <>
      <EncabezadoPagina
        titulo="Inicio"
        descripcion={
          nombre
            ? `Hola, ${nombre}. Este es el estado actual del negocio.`
            : "Estado actual del negocio."
        }
      />

      <AvisoSinAcceso />

      {(verCompras || verVentas) && (
        <Box sx={{ mb: 4, display: "grid", gap: 2, gridTemplateColumns: { sm: "repeat(3, 1fr)" } }}>
          {verCompras && (
            <>
              <TarjetaMetrica
                icono={<Package size={20} aria-hidden />}
                etiqueta="Existencia disponible"
                valor={formatearCantidad(metricas.existencia)}
                nota={`${metricas.lotesConExistencia} lote(s) con producto`}
              />
              <TarjetaMetrica
                icono={<Wallet size={20} aria-hidden />}
                etiqueta="Deuda con proveedores"
                valor={formatearMonto(metricas.deudaProveedor)}
                nota={`${metricas.facturasPendientes} factura(s) por saldar`}
                tono={metricas.deudaProveedor > 0 ? "advertencia" : "exito"}
              />
            </>
          )}
          {verVentas && (
            <TarjetaMetrica
              icono={<Fuel size={20} aria-hidden />}
              etiqueta="Por cobrar a clientes"
              valor={formatearMonto(metricas.porCobrar)}
              nota={`${metricas.ventasPendientes} venta(s) con saldo`}
              tono={metricas.porCobrar > 0 ? "error" : "exito"}
            />
          )}
        </Box>
      )}

      <Tarjeta
        titulo="Módulos disponibles"
        descripcion="Solo se listan los que tu rol tiene permitido ver."
      >
        {modulosVisibles.length === 0 ? (
          <Typography sx={{ py: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>
            Tu rol todavía no tiene módulos asignados.
          </Typography>
        ) : (
          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { sm: "repeat(2, 1fr)", xl: "repeat(3, 1fr)" } }}>
            {modulosVisibles.map((entrada) => (
              <Box
                key={entrada.modulo}
                component={Link}
                to={entrada.ruta}
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 1.5,
                  borderRadius: 3,
                  border: 1,
                  borderColor: "divider",
                  p: 2,
                  textDecoration: "none",
                  color: "inherit",
                  transition: "border-color 150ms, background-color 150ms",
                  "&:hover": {
                    borderColor: "primary.main",
                    bgcolor: (tema) => alpha(tema.palette.primary.main, tema.palette.mode === "light" ? 0.06 : 0.16),
                    '& [data-slot="icono-modulo"]': { bgcolor: "primary.500", color: "primary.contrastText" },
                    '& [data-slot="flecha-modulo"]': { opacity: 1, transform: "translateX(2px)" },
                  },
                }}
              >
                <Box
                  component="span"
                  data-slot="icono-modulo"
                  sx={{
                    display: "flex",
                    flexShrink: 0,
                    width: 40,
                    height: 40,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 2,
                    bgcolor: (tema) => (tema.palette.mode === "light" ? "grey.100" : "grey.800"),
                    color: "text.secondary",
                    transition: "background-color 150ms, color 150ms",
                  }}
                >
                  <entrada.icono size={20} aria-hidden />
                </Box>
                <Box component="span" sx={{ minWidth: 0, flex: 1 }}>
                  <Box
                    component="span"
                    sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: 14, fontWeight: 500, color: "text.primary" }}
                  >
                    {entrada.etiqueta}
                    <Box
                      component={ArrowRight}
                      data-slot="flecha-modulo"
                      size={16}
                      aria-hidden
                      sx={{
                        opacity: 0,
                        transition: "opacity 150ms, transform 150ms",
                      }}
                    />
                  </Box>
                  <Typography component="span" sx={{ mt: 0.25, display: "block", fontSize: 12, color: "text.secondary" }}>
                    {entrada.descripcion}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Tarjeta>
    </>
  );
}
