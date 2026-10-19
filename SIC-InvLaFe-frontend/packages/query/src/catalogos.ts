import type { DatosContacto, DatosProducto, ID } from "@invlafe/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { claves } from "./claves";
import { useCore } from "./contexto";

/** Los catálogos cambian poco; media hora sin refrescar es razonable. */
const TIEMPO_FRESCO = 30 * 60 * 1000;

export function useProveedores() {
  const core = useCore();
  return useQuery({
    queryKey: claves.catalogos.proveedores,
    queryFn: () => core.catalogos.listarProveedores(),
    staleTime: TIEMPO_FRESCO,
  });
}

export function useClientes() {
  const core = useCore();
  return useQuery({
    queryKey: claves.catalogos.clientes,
    queryFn: () => core.catalogos.listarClientes(),
    staleTime: TIEMPO_FRESCO,
  });
}

export function useProductos() {
  const core = useCore();
  return useQuery({
    queryKey: claves.catalogos.productos,
    queryFn: () => core.catalogos.listarProductos(),
    staleTime: TIEMPO_FRESCO,
  });
}

export function useCrearProveedor() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: (datos: DatosContacto) => core.catalogos.crearProveedor(datos),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.catalogos.proveedores });
    },
  });
}

export function useActualizarProveedor() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: ({ id, datos }: { id: ID; datos: DatosContacto }) =>
      core.catalogos.actualizarProveedor(id, datos),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.catalogos.proveedores });
      // Los lotes muestran el nombre del proveedor embebido.
      clienteQuery.invalidateQueries({ queryKey: claves.compras.todo });
    },
  });
}

export function useEliminarProveedor() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: (id: ID) => core.catalogos.eliminarProveedor(id),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.catalogos.proveedores });
    },
  });
}

export function useCrearCliente() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: (datos: DatosContacto) => core.catalogos.crearCliente(datos),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.catalogos.clientes });
    },
  });
}

export function useActualizarCliente() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: ({ id, datos }: { id: ID; datos: DatosContacto }) =>
      core.catalogos.actualizarCliente(id, datos),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.catalogos.clientes });
      clienteQuery.invalidateQueries({ queryKey: claves.ventas.todo });
    },
  });
}

export function useEliminarCliente() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: (id: ID) => core.catalogos.eliminarCliente(id),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.catalogos.clientes });
    },
  });
}

export function useCrearProducto() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: (datos: DatosProducto) => core.catalogos.crearProducto(datos),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.catalogos.productos });
    },
  });
}

export function useActualizarProducto() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: ({ id, datos }: { id: ID; datos: DatosProducto }) =>
      core.catalogos.actualizarProducto(id, datos),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.catalogos.productos });
    },
  });
}

export function useEliminarProducto() {
  const core = useCore();
  const clienteQuery = useQueryClient();

  return useMutation({
    mutationFn: (id: ID) => core.catalogos.eliminarProducto(id),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: claves.catalogos.productos });
    },
  });
}
