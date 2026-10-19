import type { ID } from "../../../shared/tipos";
import type {
  ClaveProducto,
  Cliente,
  DatosContacto,
  DatosProducto,
  Producto,
  Proveedor,
} from "../domain/entidades";
import { claveDeProducto } from "../domain/entidades";
import type {
  RepositorioClientes,
  RepositorioProductos,
  RepositorioProveedores,
} from "../domain/repositorios";

export interface CasosUsoCatalogos {
  listarProveedores(): Promise<Proveedor[]>;
  crearProveedor(datos: DatosContacto): Promise<Proveedor>;
  actualizarProveedor(id: ID, datos: DatosContacto): Promise<Proveedor>;
  eliminarProveedor(id: ID): Promise<void>;

  listarClientes(): Promise<Cliente[]>;
  crearCliente(datos: DatosContacto): Promise<Cliente>;
  actualizarCliente(id: ID, datos: DatosContacto): Promise<Cliente>;
  eliminarCliente(id: ID): Promise<void>;

  listarProductos(): Promise<Producto[]>;
  crearProducto(datos: DatosProducto): Promise<Producto>;
  actualizarProducto(id: ID, datos: DatosProducto): Promise<Producto>;
  eliminarProducto(id: ID): Promise<void>;
  /**
   * Ids de los productos que corresponden a una clave de negocio.
   *
   * "Control de aceite" necesita filtrar lotes por producto, pero solo conoce
   * la clave `aceite`; el id real lo asigna Postgres. Puede devolver varios si
   * el catálogo tiene "Aceite" y "Lubricante" como filas distintas.
   */
  idsDeProducto(clave: ClaveProducto): Promise<ID[]>;
  /** Complemento del anterior: todo lo que no es aceite. */
  idsDeCombustible(): Promise<ID[]>;
}

export function crearCasosUsoCatalogos(deps: {
  proveedores: RepositorioProveedores;
  clientes: RepositorioClientes;
  productos: RepositorioProductos;
}): CasosUsoCatalogos {
  const { proveedores, clientes, productos } = deps;

  return {
    listarProveedores: () => proveedores.listar(),
    crearProveedor: (datos) => proveedores.crear(datos),
    actualizarProveedor: (id, datos) => proveedores.actualizar(id, datos),
    eliminarProveedor: (id) => proveedores.eliminar(id),

    listarClientes: () => clientes.listar(),
    crearCliente: (datos) => clientes.crear(datos),
    actualizarCliente: (id, datos) => clientes.actualizar(id, datos),
    eliminarCliente: (id) => clientes.eliminar(id),

    listarProductos: () => productos.listar(),
    crearProducto: (datos) => productos.crear(datos),
    actualizarProducto: (id, datos) => productos.actualizar(id, datos),
    eliminarProducto: (id) => productos.eliminar(id),

    async idsDeProducto(clave) {
      const lista = await productos.listar();
      return lista
        .filter((producto) => claveDeProducto(producto) === clave)
        .map((producto) => producto.id);
    },

    async idsDeCombustible() {
      const lista = await productos.listar();
      return lista
        .filter((producto) => claveDeProducto(producto) !== "aceite")
        .map((producto) => producto.id);
    },
  };
}
