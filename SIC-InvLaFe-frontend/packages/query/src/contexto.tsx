import type { ContenedorCore } from "@invlafe/core";
import { createContext, useContext, type ReactNode } from "react";

const ContextoCore = createContext<ContenedorCore | null>(null);

/**
 * Inyecta el contenedor de casos de uso en el árbol de React.
 *
 * Los hooks nunca construyen el contenedor: lo reciben. Así la app web y la de
 * React Native pueden configurarlo distinto (por ejemplo, dónde guardar la
 * sesión) y compartir exactamente los mismos hooks.
 */
export function ProveedorCore({
  contenedor,
  children,
}: {
  contenedor: ContenedorCore;
  children: ReactNode;
}) {
  return <ContextoCore value={contenedor}>{children}</ContextoCore>;
}

export function useCore(): ContenedorCore {
  const contenedor = useContext(ContextoCore);
  if (!contenedor) {
    throw new Error(
      "useCore debe usarse dentro de <ProveedorCore>. Envuelve la app con él en el arranque.",
    );
  }
  return contenedor;
}
