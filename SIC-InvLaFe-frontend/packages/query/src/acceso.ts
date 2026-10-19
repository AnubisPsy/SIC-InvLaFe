import type {
  DatosRol,
  DatosUsuario,
  ID,
  PermisoEditable,
} from "@invlafe/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { claves } from "./claves";
import { useCore } from "./contexto";

export function useUsuarios() {
  const core = useCore();
  return useQuery({
    queryKey: claves.acceso.usuarios,
    queryFn: () => core.acceso.listarUsuarios(),
  });
}

export function useRoles() {
  const core = useCore();
  return useQuery({
    queryKey: claves.acceso.roles,
    queryFn: () => core.acceso.listarRoles(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useModulos() {
  const core = useCore();
  return useQuery({
    queryKey: claves.acceso.modulos,
    queryFn: () => core.acceso.listarModulos(),
    staleTime: 30 * 60 * 1000,
  });
}

export function useMatrizPermisos(rolId: ID | null | undefined) {
  const core = useCore();
  return useQuery({
    queryKey: claves.acceso.matrizPermisos(rolId ?? ""),
    queryFn: () => core.acceso.matrizDePermisos(rolId as ID),
    enabled: Boolean(rolId),
  });
}

export function useCrearUsuario() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: (datos: DatosUsuario) => core.acceso.crearUsuario(datos),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.acceso.usuarios });
    },
  });
}

export function useActualizarUsuario() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: ({ id, datos }: { id: ID; datos: DatosUsuario }) =>
      core.acceso.actualizarUsuario(id, datos),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.acceso.usuarios });
      // Si el usuario editado es el que está logueado, su rol pudo cambiar.
      clienteQuery.invalidateQueries({ queryKey: claves.sesion });
    },
  });
}

export function useCambiarActivoUsuario() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: ({ id, activo }: { id: ID; activo: boolean }) =>
      core.acceso.cambiarActivoUsuario(id, activo),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.acceso.usuarios });
      clienteQuery.invalidateQueries({ queryKey: claves.sesion });
    },
  });
}

export function useEliminarUsuario() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: (id: ID) => core.acceso.eliminarUsuario(id),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.acceso.usuarios });
    },
  });
}

export function useCrearRol() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: (datos: DatosRol) => core.acceso.crearRol(datos),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.acceso.roles });
    },
  });
}

export function useActualizarRol() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: ({ id, datos }: { id: ID; datos: DatosRol }) =>
      core.acceso.actualizarRol(id, datos),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.acceso.todo });
    },
  });
}

export function useEliminarRol() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: (id: ID) => core.acceso.eliminarRol(id),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.acceso.todo });
    },
  });
}

/**
 * Guardar permisos puede cambiar lo que el propio usuario ve, así que también
 * se invalida la sesión: el menú lateral se redibuja al instante.
 */
export function useGuardarPermisos() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: ({
      rolId,
      permisos,
    }: {
      rolId: ID;
      permisos: readonly PermisoEditable[];
    }) => core.acceso.guardarPermisos(rolId, permisos),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.acceso.todo });
      clienteQuery.invalidateQueries({ queryKey: claves.sesion });
    },
  });
}
