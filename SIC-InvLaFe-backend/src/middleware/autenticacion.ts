import type { NextFunction, Request, Response } from "express";
import { ErrorAutenticacion } from "../compartido/errores.js";
import { verificarToken } from "../compartido/tokens.js";
import { buscarUsuarioPorId } from "../modulos/acceso/servicio.js";

/**
 * Valida el token de sesión que viaja en `Authorization: Bearer <jwt>`.
 *
 * La firma se verifica aquí mismo, sin llamadas externas. Después se carga el
 * usuario desde la base en cada petición: así, si un administrador lo
 * desactiva o lo elimina, deja de pasar de inmediato aunque su token siga
 * vigente.
 */
export async function exigirAutenticacion(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const cabecera = req.header("authorization") ?? "";
  const [esquema, token] = cabecera.split(" ");

  if (esquema?.toLowerCase() !== "bearer" || !token?.trim()) {
    throw new ErrorAutenticacion("Falta el token de sesión. Vuelve a iniciar sesión.");
  }

  const usuarioId = verificarToken(token.trim());
  const usuario = await buscarUsuarioPorId(usuarioId);

  if (!usuario) {
    throw new ErrorAutenticacion("Tu usuario ya no existe. Contacta al administrador.");
  }

  if (!usuario.activo) {
    throw new ErrorAutenticacion("Tu usuario está desactivado. Contacta al administrador.");
  }

  req.solicitante = {
    authUserId: usuario.id,
    correo: usuario.correo.toLowerCase(),
    usuario,
  };
  next();
}
