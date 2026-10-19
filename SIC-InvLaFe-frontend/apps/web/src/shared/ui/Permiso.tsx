import type { Accion, ClaveModulo } from "@invlafe/core";
import { usePermisos } from "@invlafe/query";
import type { ReactNode } from "react";

/**
 * Muestra `children` solo si el rol del usuario permite la acción.
 *
 * Es exclusivamente cosmético: RLS es quien realmente bloquea la operación en
 * la base. Esto existe para que la pantalla no ofrezca botones que van a
 * fallar, no como control de seguridad.
 */
export function Si({
  modulo,
  accion,
  children,
  alternativa = null,
}: {
  modulo: ClaveModulo;
  accion: Accion;
  children: ReactNode;
  alternativa?: ReactNode;
}) {
  const { puede } = usePermisos();
  return <>{puede(modulo, accion) ? children : alternativa}</>;
}

/** Versión en hook, para cuando hay que deshabilitar en vez de ocultar. */
export function usePuede(modulo: ClaveModulo) {
  const { puede } = usePermisos();

  return {
    ver: puede(modulo, "ver"),
    crear: puede(modulo, "crear"),
    editar: puede(modulo, "editar"),
    eliminar: puede(modulo, "eliminar"),
    accion: (accion: Accion) => puede(modulo, accion),
  };
}
