import { crearContenedor, esErrorApp, type ContenedorCore } from "@invlafe/core";
import { ProveedorCore } from "@invlafe/query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { leerEntorno } from "../config/entorno";
import { ProveedorTema } from "../contextos/TemaContexto";

let contenedor: ContenedorCore | null = null;

/**
 * Singleton perezoso del contenedor.
 *
 * Perezoso para que la validación del entorno falle durante el render y el
 * límite de error pueda explicarlo; singleton para no crear un contenedor
 * por render, lo que duplicaría las suscripciones de sesión.
 */
function obtenerContenedor(): ContenedorCore {
  if (!contenedor) {
    const entorno = leerEntorno();
    contenedor = crearContenedor({
      apiUrl: entorno.apiUrl,
      almacenamiento: globalThis.localStorage,
    });
  }
  return contenedor;
}

function crearClienteQuery() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
        retry: (intentos, error) => {
          // Validación, permisos y "no encontrado" no mejoran reintentando:
          // solo retrasan el mensaje de error que el usuario necesita leer.
          if (esErrorApp(error) && error.codigo !== "INFRAESTRUCTURA") return false;
          return intentos < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function Proveedores({ children }: { children: ReactNode }) {
  const [clienteQuery] = useState(crearClienteQuery);

  return (
    <QueryClientProvider client={clienteQuery}>
      <ProveedorCore contenedor={obtenerContenedor()}>
        <ProveedorTema>{children}</ProveedorTema>
      </ProveedorCore>
    </QueryClientProvider>
  );
}
