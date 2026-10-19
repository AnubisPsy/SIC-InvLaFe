import type { NextFunction, Request, Response } from "express";
import { ErrorHttp } from "../compartido/errores.js";

/**
 * Límite de intentos por IP para las rutas sin autenticar.
 *
 * Sin una barrera aquí, probar contraseñas contra la API sería gratis: cada
 * intento solo le cuesta al atacante una petición.
 *
 * Es un contador en memoria: se pierde al reiniciar y no se comparte entre
 * instancias. Suficiente para un sistema de este tamaño y sin dependencias
 * nuevas; si algún día hay varias réplicas, esto se sustituye por Redis o por
 * el limitador del proxy de entrada.
 */
interface Ventana {
  intentos: number;
  /** Momento en que la ventana deja de contar, en milisegundos. */
  expiraEn: number;
}

export interface OpcionesLimite {
  /** Intentos permitidos dentro de la ventana. */
  maximo: number;
  /** Duración de la ventana, en milisegundos. */
  ventanaMs: number;
}

export function limitarIntentos({ maximo, ventanaMs }: OpcionesLimite) {
  const ventanas = new Map<string, Ventana>();

  /**
   * Limpieza perezosa: en vez de un temporizador, cada llamada aprovecha para
   * tirar lo caducado. Mantiene el mapa acotado sin dejar un `setInterval`
   * vivo que impida al proceso terminar.
   */
  function purgar(ahora: number): void {
    for (const [clave, ventana] of ventanas) {
      if (ventana.expiraEn <= ahora) ventanas.delete(clave);
    }
  }

  return function limite(req: Request, res: Response, next: NextFunction): void {
    const ahora = Date.now();
    if (ventanas.size > 1000) purgar(ahora);

    // `req.ip` es fiable porque `app.set("trust proxy", 1)` ya resuelve la IP
    // real detrás del proxy de despliegue.
    const clave = req.ip ?? "desconocida";
    const ventana = ventanas.get(clave);

    if (!ventana || ventana.expiraEn <= ahora) {
      ventanas.set(clave, { intentos: 1, expiraEn: ahora + ventanaMs });
      next();
      return;
    }

    ventana.intentos += 1;

    if (ventana.intentos > maximo) {
      const segundos = Math.ceil((ventana.expiraEn - ahora) / 1000);
      res.setHeader("Retry-After", String(segundos));
      throw new ErrorHttp(
        429,
        "CONFLICTO",
        `Demasiados intentos. Espera ${segundos} segundos antes de volver a intentarlo.`,
      );
    }

    next();
  };
}
