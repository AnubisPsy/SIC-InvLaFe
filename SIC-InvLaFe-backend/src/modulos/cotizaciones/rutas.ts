import { Router } from "express";
import { ErrorValidacion } from "../../compartido/errores.js";
import {
  campoFecha,
  campoNumero,
  campoTexto,
  campoTextoOpcional,
  cuerpoObjeto,
  filtroFecha,
  filtroTexto,
} from "../../compartido/consultas.js";
import { parametroDeRuta } from "../../compartido/http.js";
import { esObjetoPlano } from "../../compartido/validacion.js";
import { exigirAutenticacion } from "../../middleware/autenticacion.js";
import {
  ESTADOS,
  actualizarCotizacion,
  cambiarEstado,
  crearCotizacion,
  eliminarCotizacion,
  enlazarVenta,
  enlazarVentaDeLinea,
  listarCotizaciones,
  obtenerCotizacion,
  type DatosCotizacion,
  type Estado,
} from "./servicio.js";

function validarEstado(valor: unknown): Estado {
  if (typeof valor === "string" && (ESTADOS as readonly string[]).includes(valor)) {
    return valor as Estado;
  }
  throw new ErrorValidacion(`El estado debe ser uno de: ${ESTADOS.join(", ")}.`, {
    estado: "Estado no válido.",
  });
}

function validarCotizacion(cuerpo: unknown): DatosCotizacion {
  const datos = cuerpoObjeto(cuerpo);
  if (!Array.isArray(datos.lineas)) {
    throw new ErrorValidacion("Envía los productos de la cotización en «lineas».");
  }

  return {
    clienteId: campoTexto(datos, "clienteId"),
    fecha: campoFecha(datos, "fecha"),
    nota: campoTextoOpcional(datos, "nota"),
    estado: datos.estado === undefined ? "pendiente" : validarEstado(datos.estado),
    lineas: datos.lineas.map((linea) => {
      if (!esObjetoPlano(linea)) throw new ErrorValidacion("Cada línea debe ser un objeto.");
      return {
        productoId: campoTexto(linea, "productoId"),
        cantidad: campoNumero(linea, "cantidad", { estricto: true }),
        precioUnitario: campoNumero(linea, "precioUnitario"),
      };
    }),
  };
}

export const rutasCotizaciones: Router = Router();
rutasCotizaciones.use(exigirAutenticacion);

rutasCotizaciones.get("/", async (req, res) => {
  const filas = await listarCotizaciones({
    desde: filtroFecha(req, "desde"),
    hasta: filtroFecha(req, "hasta"),
    clienteId: filtroTexto(req, "clienteId"),
  });
  res.status(200).json({ filas });
});

/** Enlaza una línea con su venta. Va antes de "/:id" para no confundir rutas. */
rutasCotizaciones.patch("/lineas/:lineaId/venta", async (req, res) => {
  const lineaId = Number(parametroDeRuta(req, "lineaId"));
  if (!Number.isInteger(lineaId) || lineaId < 1) {
    throw new ErrorValidacion("El id de la línea no es válido.");
  }
  await enlazarVentaDeLinea(lineaId, campoTexto(cuerpoObjeto(req.body), "ventaId"));
  res.status(204).end();
});

rutasCotizaciones.get("/:id", async (req, res) => {
  res.status(200).json({ fila: await obtenerCotizacion(parametroDeRuta(req, "id")) });
});

rutasCotizaciones.post("/", async (req, res) => {
  res.status(201).json({ fila: await crearCotizacion(validarCotizacion(req.body)) });
});

/** PUT y no PATCH: reemplaza la cotización completa, con todas sus líneas. */
rutasCotizaciones.put("/:id", async (req, res) => {
  const fila = await actualizarCotizacion(parametroDeRuta(req, "id"), validarCotizacion(req.body));
  res.status(200).json({ fila });
});

rutasCotizaciones.patch("/:id/estado", async (req, res) => {
  const estado = validarEstado(cuerpoObjeto(req.body).estado);
  res.status(200).json({ fila: await cambiarEstado(parametroDeRuta(req, "id"), estado) });
});

rutasCotizaciones.patch("/:id/venta", async (req, res) => {
  const ventaId = campoTexto(cuerpoObjeto(req.body), "ventaId");
  res.status(200).json({ fila: await enlazarVenta(parametroDeRuta(req, "id"), ventaId) });
});

rutasCotizaciones.delete("/:id", async (req, res) => {
  await eliminarCotizacion(parametroDeRuta(req, "id"));
  res.status(204).end();
});
