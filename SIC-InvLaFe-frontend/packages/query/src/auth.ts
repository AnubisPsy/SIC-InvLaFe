import {
  puede as puedeEn,
  type Accion,
  type ClaveModulo,
  type Credenciales,
  type MapaPermisos,
  type Sesion,
} from "@invlafe/core";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { claves } from "./claves";
import { useCore } from "./contexto";

/**
 * Sesión actual del usuario.
 *
 * Se resuscribe a los cambios de Auth para que un logout en otra pestaña, o el
 * refresco del token, se reflejen sin recargar la página.
 */
export function useSesion(): UseQueryResult<Sesion | null> {
  const core = useCore();
  const clienteQuery = useQueryClient();

  useEffect(() => {
    return core.auth.alCambiarSesion(() => {
      clienteQuery.invalidateQueries({ queryKey: claves.sesion });
    });
  }, [core, clienteQuery]);

  return useQuery({
    queryKey: claves.sesion,
    queryFn: () => core.auth.cargarSesion(),
    // La sesión gobierna el enrutado: reintentar aquí solo alarga la pantalla
    // de carga cuando de verdad no hay sesión.
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export interface PermisosActuales {
  mapa: MapaPermisos | null;
  cargando: boolean;
  /** `true` si el usuario tiene sesión pero no hay fila suya en `usuarios`. */
  sinUsuarioDeNegocio: boolean;
  /** `true` si su fila existe pero está desactivada o sin rol. */
  sinAcceso: boolean;
  /** `true` si tiene un cambio de contraseña pendiente antes de poder trabajar. */
  debeCambiarContrasena: boolean;
  puede(modulo: ClaveModulo, accion: Accion): boolean;
  puedeVer(modulo: ClaveModulo): boolean;
}

/** Azúcar sobre `useSesion` para las comprobaciones de permisos en la UI. */
export function usePermisos(): PermisosActuales {
  const { data: sesion, isPending } = useSesion();

  return useMemo(() => {
    const mapa = sesion?.permisos ?? null;
    const usuario = sesion?.usuario ?? null;

    return {
      mapa,
      cargando: isPending,
      sinUsuarioDeNegocio: Boolean(sesion) && usuario === null,
      sinAcceso: Boolean(usuario) && (!usuario?.activo || !usuario?.rolId),
      debeCambiarContrasena: Boolean(usuario?.debeCambiarContrasena),
      puede: (modulo, accion) => puedeEn(mapa, modulo, accion),
      puedeVer: (modulo) => puedeEn(mapa, modulo, "ver"),
    };
  }, [sesion, isPending]);
}

export function useIniciarSesion() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: (credenciales: Credenciales) => core.auth.iniciarSesion(credenciales),
    onSuccess: (sesion) => {
      clienteQuery.setQueryData(claves.sesion, sesion);
    },
  });
}

export function useCerrarSesion() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: () => core.auth.cerrarSesion(),
    onSuccess: () => {
      // Se limpia todo, no solo la sesión: la caché contiene datos del negocio
      // que el siguiente usuario podría no tener permiso de ver.
      clienteQuery.clear();
    },
  });
}

export function useEnviarCorreoRecuperacion() {
  const core = useCore();

  return useMutation({
    mutationFn: ({ correo, urlRedireccion }: { correo: string; urlRedireccion: string }) =>
      core.auth.enviarCorreoRecuperacion(correo, urlRedireccion),
  });
}

export function useCambiarContrasena() {
  const core = useCore();

  return useMutation({
    mutationFn: ({ nueva, confirmacion }: { nueva: string; confirmacion: string }) =>
      core.auth.cambiarContrasena(nueva, confirmacion),
  });
}

/**
 * Cambio de contraseña exigido en el primer acceso.
 *
 * Escribe la sesión devuelta en la caché en vez de invalidarla: la nueva ya
 * viene sin la marca pendiente, así que el guardián deja pasar en el mismo
 * render y el usuario no ve un parpadeo de la pantalla de carga.
 */
export function useCambiarContrasenaObligatoria() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: ({ nueva, confirmacion }: { nueva: string; confirmacion: string }) =>
      core.auth.cambiarContrasenaObligatoria(nueva, confirmacion),
    onSuccess: (sesion) => {
      clienteQuery.setQueryData(claves.sesion, sesion);
    },
  });
}
