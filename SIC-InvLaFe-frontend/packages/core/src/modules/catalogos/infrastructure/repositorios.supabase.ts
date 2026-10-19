import type { ClienteSupabase } from "../../../infrastructure/supabase/cliente";
import {
  ejecutar,
  ejecutarOpcional,
  ejecutarSinRetorno,
} from "../../../infrastructure/supabase/errores";
import {
  TABLAS,
  aId,
  type FilaCliente,
  type FilaProducto,
  type FilaProveedor,
} from "../../../infrastructure/supabase/tablas";
import type { ID } from "../../../shared/tipos";
import type {
  Cliente,
  DatosContacto,
  DatosProducto,
  Producto,
  Proveedor,
} from "../domain/entidades";
import { validarContacto, validarProducto } from "../domain/entidades";
import type {
  RepositorioClientes,
  RepositorioProductos,
  RepositorioProveedores,
} from "../domain/repositorios";

const aProveedor = (fila: FilaProveedor): Proveedor => ({
  id: aId(fila.id),
  nombre: fila.nombre,
  telefono: fila.telefono,
  creadoEn: fila.creado_en,
});

const aCliente = (fila: FilaCliente): Cliente => ({
  id: aId(fila.id),
  nombre: fila.nombre,
  telefono: fila.telefono,
  creadoEn: fila.creado_en,
});

const aProducto = (fila: FilaProducto): Producto => ({
  id: aId(fila.id),
  nombre: fila.nombre,
});

export function crearRepositorioProveedores(
  cliente: ClienteSupabase,
): RepositorioProveedores {
  const tabla = () => cliente.from(TABLAS.PROVEEDORES);

  return {
    async listar() {
      const filas = await ejecutar<FilaProveedor[]>(
        tabla().select("*").order("nombre", { ascending: true }),
        "cargar los proveedores",
      );
      return filas.map(aProveedor);
    },

    async obtener(id: ID) {
      const fila = await ejecutarOpcional<FilaProveedor>(
        tabla().select("*").eq("id", id).single(),
        "cargar el proveedor",
      );
      return fila ? aProveedor(fila) : null;
    },

    async crear(datos: DatosContacto) {
      const validos = validarContacto(datos, "proveedor");
      const fila = await ejecutar<FilaProveedor>(
        tabla().insert(validos).select("*").single(),
        "crear el proveedor",
      );
      return aProveedor(fila);
    },

    async actualizar(id: ID, datos: DatosContacto) {
      const validos = validarContacto(datos, "proveedor");
      const fila = await ejecutar<FilaProveedor>(
        tabla().update(validos).eq("id", id).select("*").single(),
        "actualizar el proveedor",
      );
      return aProveedor(fila);
    },

    async eliminar(id: ID) {
      await ejecutarSinRetorno(tabla().delete().eq("id", id), "eliminar el proveedor");
    },
  };
}

export function crearRepositorioClientes(
  cliente: ClienteSupabase,
): RepositorioClientes {
  const tabla = () => cliente.from(TABLAS.CLIENTES);

  return {
    async listar() {
      const filas = await ejecutar<FilaCliente[]>(
        tabla().select("*").order("nombre", { ascending: true }),
        "cargar los clientes",
      );
      return filas.map(aCliente);
    },

    async obtener(id: ID) {
      const fila = await ejecutarOpcional<FilaCliente>(
        tabla().select("*").eq("id", id).single(),
        "cargar el cliente",
      );
      return fila ? aCliente(fila) : null;
    },

    async crear(datos: DatosContacto) {
      const validos = validarContacto(datos, "cliente");
      const fila = await ejecutar<FilaCliente>(
        tabla().insert(validos).select("*").single(),
        "crear el cliente",
      );
      return aCliente(fila);
    },

    async actualizar(id: ID, datos: DatosContacto) {
      const validos = validarContacto(datos, "cliente");
      const fila = await ejecutar<FilaCliente>(
        tabla().update(validos).eq("id", id).select("*").single(),
        "actualizar el cliente",
      );
      return aCliente(fila);
    },

    async eliminar(id: ID) {
      await ejecutarSinRetorno(tabla().delete().eq("id", id), "eliminar el cliente");
    },
  };
}

export function crearRepositorioProductos(
  cliente: ClienteSupabase,
): RepositorioProductos {
  const tabla = () => cliente.from(TABLAS.PRODUCTOS);

  return {
    async listar() {
      const filas = await ejecutar<FilaProducto[]>(
        tabla().select("*").order("nombre", { ascending: true }),
        "cargar los productos",
      );
      return filas.map(aProducto);
    },

    async obtener(id: ID) {
      const fila = await ejecutarOpcional<FilaProducto>(
        tabla().select("*").eq("id", id).single(),
        "cargar el producto",
      );
      return fila ? aProducto(fila) : null;
    },

    async crear(datos: DatosProducto) {
      const validos = validarProducto(datos);
      const fila = await ejecutar<FilaProducto>(
        tabla().insert(validos).select("*").single(),
        "crear el producto",
      );
      return aProducto(fila);
    },

    async actualizar(id: ID, datos: DatosProducto) {
      const validos = validarProducto(datos);
      const fila = await ejecutar<FilaProducto>(
        tabla().update(validos).eq("id", id).select("*").single(),
        "actualizar el producto",
      );
      return aProducto(fila);
    },

    async eliminar(id: ID) {
      await ejecutarSinRetorno(tabla().delete().eq("id", id), "eliminar el producto");
    },
  };
}
