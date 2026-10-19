import { Router } from "express";
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
  filtroTexto,
} from "../../compartido/consultas.js";
import { parametroDeRuta } from "../../compartido/http.js";
import { exigirAutenticacion } from "../../middleware/autenticacion.js";
import {
  crearPagoCliente,
  crearVenta,
  descontarSaldo,
  eliminarPagoCliente,
  eliminarVenta,
  listarPagosDeVenta,
  listarPagosEnRango,
  listarVentas,
  listarVentasPorLotes,
  obtenerVenta,
  restituirSaldo,
} from "./servicio.js";

/** Mismo tope por defecto que `LIMITE_VENTAS_POR_DEFECTO` del frontend. */
const LIMITE_POR_DEFECTO = 500;

/** Lista de ids de texto en un cuerpo JSON, como `{ "loteCompraIds": [...] }`. */
function listaDeIds(datos: Record<string, unknown>, nombre: string): string[] | undefined {
  const valor = datos[nombre];
  if (valor === undefined || valor === null) return undefined;
  if (!Array.isArray(valor) || valor.some((id) => typeof id !== "string")) {
    throw new ErrorValidacion(`«${nombre}» debe ser una lista de ids.`);
  }
  return valor as string[];
}

// --- /api/ventas -----------------------------------------------------------------

export const rutasVentas: Router = Router();
rutasVentas.use(exigirAutenticacion);

rutasVentas.get("/", async (req, res) => {
  const filas = await listarVentas({
    desde: filtroFecha(req, "desde"),
    hasta: filtroFecha(req, "hasta"),
    clienteId: filtroTexto(req, "clienteId"),
    loteCompraId: filtroTexto(req, "loteCompraId"),
    soloConSaldo: filtroBooleano(req, "soloConSaldo"),
    limite: filtroLimite(req, LIMITE_POR_DEFECTO),
  });
  res.status(200).json({ filas });
});

/** Es POST porque la lista de lotes puede ser larga y no cabría en la URL. */
rutasVentas.post("/por-lotes", async (req, res) => {
  const ids = listaDeIds(cuerpoObjeto(req.body), "loteCompraIds") ?? [];
  res.status(200).json({ filas: await listarVentasPorLotes(ids) });
});

rutasVentas.get("/:id", async (req, res) => {
  res.status(200).json({ fila: await obtenerVenta(parametroDeRuta(req, "id")) });
});

rutasVentas.post("/", async (req, res) => {
  const datos = cuerpoObjeto(req.body);
  const fila = await crearVenta({
    loteCompraId: campoTexto(datos, "loteCompraId"),
    clienteId: campoTexto(datos, "clienteId"),
    fecha: campoFecha(datos, "fecha"),
    numeroFactura: campoTextoOpcional(datos, "numeroFactura"),
    cantidad: campoNumero(datos, "cantidad", { estricto: true }),
    precioUnitario: campoNumero(datos, "precioUnitario"),
    valorTotal: campoNumero(datos, "valorTotal"),
    detalle: campoTextoOpcional(datos, "detalle"),
  });
  res.status(201).json({ fila });
});

rutasVentas.delete("/:id", async (req, res) => {
  await eliminarVenta(parametroDeRuta(req, "id"));
  res.status(204).end();
});

rutasVentas.post("/:id/descontar-saldo", async (req, res) => {
  const datos = cuerpoObjeto(req.body);
  const fila = await descontarSaldo(
    parametroDeRuta(req, "id"),
    campoNumero(datos, "monto", { estricto: true }),
    campoNumero(datos, "saldoEsperado"),
  );
  res.status(200).json({ fila });
});

rutasVentas.post("/:id/restituir-saldo", async (req, res) => {
  const datos = cuerpoObjeto(req.body);
  await restituirSaldo(parametroDeRuta(req, "id"), campoNumero(datos, "monto", { estricto: true }));
  res.status(204).end();
});

rutasVentas.get("/:id/pagos", async (req, res) => {
  res.status(200).json({ filas: await listarPagosDeVenta(parametroDeRuta(req, "id")) });
});

// --- /api/pagos-cliente ----------------------------------------------------------

export const rutasPagosCliente: Router = Router();
rutasPagosCliente.use(exigirAutenticacion);

/** Abonos de un periodo, para el reporte de cobros. */
rutasPagosCliente.post("/consulta-rango", async (req, res) => {
  const datos = cuerpoObjeto(req.body);
  const fechaOpcional = (nombre: string) =>
    datos[nombre] === undefined || datos[nombre] === null ? undefined : campoFecha(datos, nombre);

  const filas = await listarPagosEnRango({
    desde: fechaOpcional("desde"),
    hasta: fechaOpcional("hasta"),
    ventaIds: listaDeIds(datos, "ventaIds"),
  });
  res.status(200).json({ filas });
});

rutasPagosCliente.post("/", async (req, res) => {
  const datos = cuerpoObjeto(req.body);
  const fila = await crearPagoCliente({
    ventaId: campoTexto(datos, "ventaId"),
    fecha: campoFecha(datos, "fecha"),
    monto: campoNumero(datos, "monto", { estricto: true }),
  });
  res.status(201).json({ fila });
});

rutasPagosCliente.delete("/:id", async (req, res) => {
  await eliminarPagoCliente(parametroDeRuta(req, "id"));
  res.status(204).end();
});
