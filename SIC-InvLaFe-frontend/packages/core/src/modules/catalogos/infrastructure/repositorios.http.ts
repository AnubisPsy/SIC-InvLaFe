import type { ClienteApi } from "../../../infrastructure/http/cliente";
import { id } from "../../../infrastructure/http/consulta";
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

/**
 * Clientes, proveedores y productos a través del backend.
 *
 * Los tres usan las mismas 5 rutas (`/api/<recurso>`), así que comparten esta
 * función. La validación se hace aquí también, antes de enviar, para mostrar
 * los errores al instante; el backend vuelve a validar.
 */
function crearRepositorioCatalogo<T, D>(
  api: ClienteApi,
  recurso: string,
  etiqueta: string,
  validar: (datos: D) => unknown,
) {
  const base = `/api/${recurso}`;

  return {
    async listar(): Promise<T[]> {
      const r = await api.solicitar<{ registros: T[] }>(base, { contexto: `cargar los ${recurso}` });
      return r.registros;
    },

    async obtener(registroId: ID): Promise<T | null> {
      const r = await api.solicitar<{ registro: T | null }>(`${base}/${id(registroId)}`, {
        contexto: `cargar el ${etiqueta}`,
      });
      return r.registro;
    },

    async crear(datos: D): Promise<T> {
      const r = await api.solicitar<{ registro: T }>(base, {
        metodo: "POST",
        contexto: `crear el ${etiqueta}`,
        cuerpo: validar(datos),
      });
      return r.registro;
    },

    async actualizar(registroId: ID, datos: D): Promise<T> {
      const r = await api.solicitar<{ registro: T }>(`${base}/${id(registroId)}`, {
        metodo: "PATCH",
        contexto: `actualizar el ${etiqueta}`,
        cuerpo: validar(datos),
      });
      return r.registro;
    },

    async eliminar(registroId: ID): Promise<void> {
      await api.solicitar<void>(`${base}/${id(registroId)}`, {
        metodo: "DELETE",
        contexto: `eliminar el ${etiqueta}`,
      });
    },
  };
}

export function crearRepositorioProveedores(api: ClienteApi): RepositorioProveedores {
  return crearRepositorioCatalogo<Proveedor, DatosContacto>(api, "proveedores", "proveedor", (d) =>
    validarContacto(d, "proveedor"),
  );
}

export function crearRepositorioClientes(api: ClienteApi): RepositorioClientes {
  return crearRepositorioCatalogo<Cliente, DatosContacto>(api, "clientes", "cliente", (d) =>
    validarContacto(d, "cliente"),
  );
}

export function crearRepositorioProductos(api: ClienteApi): RepositorioProductos {
  return crearRepositorioCatalogo<Producto, DatosProducto>(api, "productos", "producto", validarProducto);
}
