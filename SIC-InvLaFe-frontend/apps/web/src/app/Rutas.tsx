import { MODULOS } from "@invlafe/core";
import { Box, Stack, Typography } from "@mui/material";
import { Suspense, lazy } from "react";
import { Link, Route, Routes } from "react-router";
import { LayoutApp } from "../layout/LayoutApp";
import { Boton, Cargador } from "../shared/ui";
import { RutaModulo, RutaPrivada, RutaPublica } from "./guardias";

/**
 * Cada módulo se carga bajo demanda.
 *
 * Un usuario con permiso solo sobre cobros no debería descargar el código de
 * las otras seis pantallas para ver la suya.
 */
const Inicio = lazy(() =>
  import("../modules/inicio/paginas/Inicio").then((m) => ({ default: m.Inicio })),
);
const PagosProveedor = lazy(() =>
  import("../modules/pagos-proveedor/paginas/PagosProveedor").then((m) => ({
    default: m.PagosProveedor,
  })),
);
const ControlCarga = lazy(() =>
  import("../modules/control-carga/paginas/ControlCarga").then((m) => ({
    default: m.ControlCarga,
  })),
);
const Cobros = lazy(() =>
  import("../modules/cobros/paginas/Cobros").then((m) => ({ default: m.Cobros })),
);
const Cuadre = lazy(() =>
  import("../modules/cuadre/paginas/Cuadre").then((m) => ({ default: m.Cuadre })),
);
const ControlAceite = lazy(() =>
  import("../modules/control-aceite/paginas/ControlAceite").then((m) => ({
    default: m.ControlAceite,
  })),
);
const Cotizaciones = lazy(() =>
  import("../modules/cotizaciones/paginas/Cotizaciones").then((m) => ({
    default: m.Cotizaciones,
  })),
);
const Clientes = lazy(() =>
  import("../modules/catalogos/paginas/Clientes").then((m) => ({
    default: m.Clientes,
  })),
);
const Proveedores = lazy(() =>
  import("../modules/catalogos/paginas/Proveedores").then((m) => ({
    default: m.Proveedores,
  })),
);
const Productos = lazy(() =>
  import("../modules/catalogos/paginas/Productos").then((m) => ({
    default: m.Productos,
  })),
);
const UsuariosRoles = lazy(() =>
  import("../modules/usuarios/paginas/UsuariosRoles").then((m) => ({
    default: m.UsuariosRoles,
  })),
);
const IniciarSesion = lazy(() =>
  import("../modules/auth/paginas/IniciarSesion").then((m) => ({
    default: m.IniciarSesion,
  })),
);
const CambiarContrasenaInicial = lazy(() =>
  import("../modules/auth/paginas/CambiarContrasenaInicial").then((m) => ({
    default: m.CambiarContrasenaInicial,
  })),
);

export function Rutas() {
  return (
    <Suspense fallback={<Cargador etiqueta="Cargando el módulo…" />}>
    <Routes>
      {/* Sin sesión */}
      <Route element={<RutaPublica />}>
        <Route path="/iniciar-sesion" element={<IniciarSesion />} />
      </Route>

      {/*
        No va bajo RutaPrivada: es ese guardián
        el que redirige aquí, así que meterla dentro daría un bucle infinito.
        La pantalla comprueba la sesión por su cuenta.
      */}
      <Route path="/cambiar-contrasena" element={<CambiarContrasenaInicial />} />

      {/* Con sesión */}
      <Route element={<RutaPrivada />}>
        <Route element={<LayoutApp />}>
          <Route index element={<Inicio />} />

          <Route
            path="/pagos-proveedor"
            element={
              <RutaModulo modulo={MODULOS.PAGO_PROVEEDOR}>
                <PagosProveedor />
              </RutaModulo>
            }
          />
          <Route
            path="/control-carga"
            element={
              <RutaModulo modulo={MODULOS.CONTROL_CARGA}>
                <ControlCarga />
              </RutaModulo>
            }
          />
          <Route
            path="/cobros"
            element={
              <RutaModulo modulo={MODULOS.COBRO_CLIENTES}>
                <Cobros />
              </RutaModulo>
            }
          />
          <Route
            path="/cuadre"
            element={
              <RutaModulo modulo={MODULOS.CUADRE_GALONES}>
                <Cuadre />
              </RutaModulo>
            }
          />
          <Route
            path="/control-aceite"
            element={
              <RutaModulo modulo={MODULOS.CONTROL_ACEITE}>
                <ControlAceite />
              </RutaModulo>
            }
          />
          <Route
            path="/cotizaciones"
            element={
              <RutaModulo modulo={MODULOS.COTIZACIONES}>
                <Cotizaciones />
              </RutaModulo>
            }
          />
          <Route
            path="/clientes"
            element={
              <RutaModulo modulo={MODULOS.CLIENTES}>
                <Clientes />
              </RutaModulo>
            }
          />
          <Route
            path="/proveedores"
            element={
              <RutaModulo modulo={MODULOS.PROVEEDORES}>
                <Proveedores />
              </RutaModulo>
            }
          />
          <Route
            path="/productos"
            element={
              <RutaModulo modulo={MODULOS.PRODUCTOS}>
                <Productos />
              </RutaModulo>
            }
          />
          <Route
            path="/usuarios"
            element={
              <RutaModulo modulo={MODULOS.USUARIOS_ROLES}>
                <UsuariosRoles />
              </RutaModulo>
            }
          />

          <Route path="*" element={<NoEncontrado />} />
        </Route>
      </Route>
    </Routes>
    </Suspense>
  );
}

function NoEncontrado() {
  return (
    <Stack sx={{ alignItems: "center", justifyContent: "center", py: 10, textAlign: "center" }}>
      <Typography sx={{ fontSize: 48, fontWeight: 700, color: "primary.500" }}>404</Typography>
      <Typography variant="h1" sx={{ mt: 1, fontSize: 20, fontWeight: 600, color: "text.primary" }}>
        Página no encontrada
      </Typography>
      <Typography sx={{ mt: 1, maxWidth: 384, fontSize: 14, color: "text.secondary" }}>
        La dirección que abriste no existe o el módulo cambió de ruta.
      </Typography>
      <Box component={Link} to="/" sx={{ mt: 3 }}>
        <Boton>Volver al inicio</Boton>
      </Box>
    </Stack>
  );
}
