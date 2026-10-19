import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ErrorAutenticacion, ErrorPermisoDenegado } from "../compartido/errores.js";
import { accionesPermitidas, puede } from "../modulos/acceso/servicio.js";
import { ETIQUETA_MODULO, type Accion, type ClaveModulo } from "../modulos/acceso/modulos.js";

/**
 * Comprueba en `permisos_rol` que el solicitante puede ejecutar `accion` sobre
 * `modulo`.
 *
 * Esta es la autorización real del backend. El cliente admin ignora RLS, así
 * que la base no va a frenar nada: si este middleware falta o falla, la
 * operación se ejecuta con privilegios totales. Por eso se consulta la tabla en
 * cada petición en lugar de confiar en nada que venga del cliente.
 */
export function exigirPermiso(modulo: ClaveModulo, accion: Accion): RequestHandler {
  return async function verificarPermiso(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    const solicitante = req.solicitante;

    if (!solicitante) {
      // Solo ocurre si se monta `exigirPermiso` sin `exigirAutenticacion`.
      throw new ErrorAutenticacion("No se pudo verificar tu sesión.");
    }

    if (!solicitante.usuario.rolId) {
      throw new ErrorPermisoDenegado(
        "Tu usuario no tiene un rol asignado. Pide a un administrador que te asigne uno.",
      );
    }

    const permisos = await accionesPermitidas(solicitante.usuario.rolId, modulo);

    if (!puede(permisos, accion)) {
      throw new ErrorPermisoDenegado(
        `Tu rol no incluye el permiso de ${accion} en el módulo «${ETIQUETA_MODULO[modulo]}».`,
      );
    }

    next();
  };
}
