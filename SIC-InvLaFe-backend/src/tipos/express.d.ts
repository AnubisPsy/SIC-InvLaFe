import type { Solicitante } from "../modulos/acceso/servicio.js";

/**
 * Datos que los middleware cuelgan de la petición.
 *
 * `solicitante` se declara opcional a propósito: solo existe después de
 * `exigirAutenticacion`, y así olvidar ese middleware en una ruta protegida
 * sale como error de tipos en vez de como un fallo en tiempo de ejecución.
 */
declare global {
  namespace Express {
    interface Request {
      solicitante?: Solicitante;
    }
  }
}

export {};
