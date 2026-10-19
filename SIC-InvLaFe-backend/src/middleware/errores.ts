import type { NextFunction, Request, Response } from "express";
import {
  esErrorHttp,
  type CuerpoError,
  ErrorNoEncontrado,
} from "../compartido/errores.js";
import { leerEntorno } from "../config/entorno.js";

/** Cualquier ruta no declarada acaba aquí, con la misma forma de error. */
export function rutaNoEncontrada(req: Request, _res: Response, next: NextFunction): void {
  next(new ErrorNoEncontrado(`La ruta ${req.method} ${req.path} no existe.`));
}

/**
 * Manejador central de errores.
 *
 * Es la única salida de error de la API: todo lo que se lance en una ruta
 * termina aquí (Express 5 reenvía también los rechazos de handlers async), así
 * que el cliente nunca ve un stack trace ni un mensaje de Postgres en crudo.
 *
 * Distingue dos audiencias: al cliente le llega un mensaje en español que puede
 * mostrar tal cual; al log del servidor le llega el error completo, con la
 * causa original, para poder diagnosticar.
 */
export function manejarErrores(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Si ya se empezó a escribir la respuesta, Express debe cerrar la conexión:
  // añadir cabeceras ahora provocaría un error distinto y más confuso.
  if (res.headersSent) {
    next(error);
    return;
  }

  const entorno = leerEntorno();

  if (esErrorHttp(error)) {
    // Los 4xx son de quien llama y no ensucian el log salvo en desarrollo.
    if (error.estado >= 500 || !entorno.esProduccion) {
      console.error(
        `[${req.method} ${req.path}] ${error.codigo}: ${error.message}`,
        error.causaOriginal ?? "",
      );
    }

    const cuerpo: CuerpoError = {
      error: {
        codigo: error.codigo,
        mensaje: error.message,
        ...(error.campos && Object.keys(error.campos).length > 0
          ? { campos: error.campos }
          : {}),
      },
    };

    res.status(error.estado).json(cuerpo);
    return;
  }

  // Errores no previstos: se registran completos y se responde en genérico.
  console.error(`[${req.method} ${req.path}] Error no controlado:`, error);

  const cuerpo: CuerpoError = {
    error: {
      codigo: "INFRAESTRUCTURA",
      mensaje: entorno.esProduccion
        ? "Ocurrió un error inesperado en el servidor."
        : `Error inesperado: ${error instanceof Error ? error.message : String(error)}`,
    },
  };

  res.status(500).json(cuerpo);
}
