import { Router, type Request } from "express";
import { ErrorValidacion } from "../../compartido/errores.js";
import {
  campoFecha,
  campoNumero,
  campoTexto,
  campoTextoOpcional,
  cuerpoObjeto,
  filtroBooleano,
  filtroFecha,
  filtroLimite,
  filtroLista,
  filtroTexto,
} from "../../compartido/consultas.js";
import { parametroDeRuta } from "../../compartido/http.js";
import { esObjetoPlano } from "../../compartido/validacion.js";
import { exigirAutenticacion } from "../../middleware/autenticacion.js";
import {
  crearCompra,
  crearPagoProveedor,
  descontarExistencia,
  devolverExistencia,
  eliminarCompra,
  eliminarPagoProveedor,
  listarCompras,
  listarLotes,
  listarPagosDeCompra,
  listarPagosEnRango,
  obtenerCompra,
  obtenerLote,
  type NuevaLinea,
} from "./servicio.js";

/** Mismo tope por defecto que `LIMITE_LOTES_POR_DEFECTO` del frontend. */
const LIMITE_POR_DEFECTO = 500;

/** El id de las compras es un número (bigint), no un UUID. */
function idCompra(texto: string): number {
  const id = Number(texto);
  if (!Number.isInteger(id) || id < 1) throw new ErrorValidacion("El id de la compra no es válido.");
  return id;
}

const idCompraDeRuta = (req: Request) => idCompra(parametroDeRuta(req, "id"));

// --- /api/compras ----------------------------------------------------------------

export const rutasCompras: Router = Router();
rutasCompras.use(exigirAutenticacion);

rutasCompras.get("/", async (req, res) => {
  const filas = await listarCompras({
    desde: filtroFecha(req, "desde"),
    hasta: filtroFecha(req, "hasta"),
    proveedorId: filtroTexto(req, "proveedorId"),
    limite: filtroLimite(req, LIMITE_POR_DEFECTO),
  });
  res.status(200).json({ filas });
});

rutasCompras.get("/:id", async (req, res) => {
  res.status(200).json({ fila: await obtenerCompra(idCompraDeRuta(req)) });
});

rutasCompras.post("/", async (req, res) => {
  const datos = cuerpoObjeto(req.body);
  if (!Array.isArray(datos.lineas)) {
    throw new ErrorValidacion("Envía los productos de la compra en «lineas».");
  }

  const lineas: NuevaLinea[] = datos.lineas.map((linea) => {
    if (!esObjetoPlano(linea)) throw new ErrorValidacion("Cada línea debe ser un objeto.");
    return {
      productoId: campoTexto(linea, "productoId"),
      cantidadComprada: campoNumero(linea, "cantidadComprada", { estricto: true }),
      precioUnitario: campoNumero(linea, "precioUnitario"),
    };
  });

  const fila = await crearCompra({
    proveedorId: campoTexto(datos, "proveedorId"),
    fecha: campoFecha(datos, "fecha"),
    numeroFactura: campoTextoOpcional(datos, "numeroFactura"),
    valorFactura: campoNumero(datos, "valorFactura"),
    lineas,
  });
  res.status(201).json({ fila });
});

rutasCompras.delete("/:id", async (req, res) => {
  await eliminarCompra(idCompraDeRuta(req));
  res.status(204).end();
});

rutasCompras.get("/:id/pagos", async (req, res) => {
  res.status(200).json({ filas: await listarPagosDeCompra(idCompraDeRuta(req)) });
});

// --- /api/lotes ------------------------------------------------------------------

export const rutasLotes: Router = Router();
rutasLotes.use(exigirAutenticacion);

rutasLotes.get("/", async (req, res) => {
  const filas = await listarLotes({
    desde: filtroFecha(req, "desde"),
    hasta: filtroFecha(req, "hasta"),
    proveedorId: filtroTexto(req, "proveedorId"),
    productoId: filtroTexto(req, "productoId"),
    productoIds: filtroLista(req, "productoIds"),
    soloDisponibles: filtroBooleano(req, "soloDisponibles"),
    limite: filtroLimite(req, LIMITE_POR_DEFECTO),
  });
  res.status(200).json({ filas });
});

rutasLotes.get("/:id", async (req, res) => {
  res.status(200).json({ fila: await obtenerLote(parametroDeRuta(req, "id")) });
});

rutasLotes.post("/:id/descontar", async (req, res) => {
  const datos = cuerpoObjeto(req.body);
  const aplicado = await descontarExistencia(
    parametroDeRuta(req, "id"),
    campoNumero(datos, "cantidad", { estricto: true }),
    campoNumero(datos, "disponibleEsperada"),
  );
  res.status(200).json({ aplicado });
});

rutasLotes.post("/:id/devolver", async (req, res) => {
  const datos = cuerpoObjeto(req.body);
  await devolverExistencia(
    parametroDeRuta(req, "id"),
    campoNumero(datos, "cantidad", { estricto: true }),
  );
  res.status(204).end();
});

// --- /api/pagos-proveedor --------------------------------------------------------

export const rutasPagosProveedor: Router = Router();
rutasPagosProveedor.use(exigirAutenticacion);

/**
 * Abonos de un periodo. Es POST y no GET porque la lista de facturas puede ser
 * larga y no cabría en la dirección (URL).
 */
rutasPagosProveedor.post("/consulta-rango", async (req, res) => {
  const datos = cuerpoObjeto(req.body);
  const fechaOpcional = (nombre: string) =>
    datos[nombre] === undefined || datos[nombre] === null ? undefined : campoFecha(datos, nombre);

  let compraIds: number[] | undefined;
  if (datos.compraIds !== undefined && datos.compraIds !== null) {
    if (!Array.isArray(datos.compraIds)) throw new ErrorValidacion("«compraIds» debe ser una lista.");
    compraIds = datos.compraIds.map((id) => idCompra(String(id)));
  }

  const filas = await listarPagosEnRango({
    desde: fechaOpcional("desde"),
    hasta: fechaOpcional("hasta"),
    compraIds,
  });
  res.status(200).json({ filas });
});

rutasPagosProveedor.post("/", async (req, res) => {
  const datos = cuerpoObjeto(req.body);
  const fila = await crearPagoProveedor({
    compraId: idCompra(String(datos.compraId ?? "")),
    fecha: campoFecha(datos, "fecha"),
    monto: campoNumero(datos, "monto", { estricto: true }),
  });
  res.status(201).json({ fila });
});

rutasPagosProveedor.delete("/:id", async (req, res) => {
  await eliminarPagoProveedor(parametroDeRuta(req, "id"));
  res.status(204).end();
});
