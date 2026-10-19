import type { NextFunction, Request, Response } from "express";
import { ErrorAutenticacion } from "../compartido/errores.js";
import { obtenerClienteAdmin } from "../infraestructura/supabase/admin.js";
import { buscarUsuarioPorCorreo } from "../modulos/acceso/servicio.js";

/**
 * Valida el token de Supabase Auth que viaja en `Authorization: Bearer <jwt>`.
 *
 * La validación se delega en Supabase (`auth.getUser(token)`) en vez de
 * verificar la firma aquí: además de comprobar firma y expiración, consulta el
 * estado real de la cuenta, así que un usuario baneado o eliminado deja de
 * pasar de inmediato aunque su token siga vigente. A cambio cuesta una llamada
 * de red por petición, coste asumible en un sistema de este tamaño.
 *
 * Tras identificar la cuenta, resuelve la fila de `usuarios` enlazada por
 * correo. Sin esa fila no hay rol ni permisos posibles, así que la petición se
 * corta aquí con un mensaje que explica qué falta configurar.
 */
export async function exigirAutenticacion(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const cabecera = req.header("authorization") ?? "";
  const [esquema, token] = cabecera.split(" ");

  if (esquema?.toLowerCase() !== "bearer" || !token?.trim()) {
    throw new ErrorAutenticacion(
      "Falta el token de sesión. Vuelve a iniciar sesión.",
    );
  }

  const { data, error } = await obtenerClienteAdmin().auth.getUser(token.trim());

  if (error || !data.user) {
    throw new ErrorAutenticacion("Tu sesión expiró o no es válida. Vuelve a iniciar sesión.");
  }

  const correo = data.user.email?.toLowerCase().trim();
  if (!correo) {
    throw new ErrorAutenticacion(
      "La cuenta no tiene un correo asociado. Contacta al administrador.",
    );
  }

  const usuario = await buscarUsuarioPorCorreo(correo);

  if (!usuario) {
    throw new ErrorAutenticacion(
      `Tu cuenta de acceso (${correo}) no está registrada como usuario del ` +
        "sistema. Pide a un administrador que la dé de alta.",
    );
  }

  if (!usuario.activo) {
    throw new ErrorAutenticacion(
      "Tu usuario está desactivado. Contacta al administrador.",
    );
  }

  req.solicitante = { authUserId: data.user.id, correo, usuario };
  next();
}
