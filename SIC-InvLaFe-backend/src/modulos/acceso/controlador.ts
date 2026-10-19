import type { Request, Response } from "express";
import { ErrorAutenticacion } from "../../compartido/errores.js";
import { cambiarContrasenaPropia, iniciarSesion } from "./autenticacion.js";
import { validarCredenciales, validarNuevaContrasena } from "./esquema.js";

/**
 * `POST /api/acceso/iniciar-sesion`
 *
 * Devuelve los tokens de Supabase para que el navegador instale la sesión con
 * `setSession`. No devuelve el usuario, el rol ni los permisos: eso lo resuelve
 * el frontend leyendo Supabase con la sesión ya puesta, igual que en cualquier
 * otra carga de la aplicación.
 */
export async function postIniciarSesion(req: Request, res: Response): Promise<void> {
  const credenciales = validarCredenciales(req.body);
  const sesion = await iniciarSesion(credenciales);
  res.status(200).json({ sesion });
}

/**
 * `POST /api/acceso/cambiar-contrasena`
 *
 * Cambia la contraseña de quien llama y levanta su cambio obligatorio, si lo
 * tenía. Exige sesión, pero **no** exige permiso sobre ningún módulo: es una
 * acción sobre uno mismo, y precisamente quien la necesita es quien todavía no
 * puede usar el sistema.
 */
export async function postCambiarContrasena(
  req: Request,
  res: Response,
): Promise<void> {
  const solicitante = req.solicitante;
  if (!solicitante) throw new ErrorAutenticacion("No se pudo verificar tu sesión.");

  await cambiarContrasenaPropia(solicitante, validarNuevaContrasena(req.body));
  res.status(204).end();
}

/**
 * `GET /api/acceso/sesion`
 *
 * Confirma que el token sigue siendo válido y devuelve a quién pertenece. El
 * frontend lo usa al recargar la página para recuperar la sesión.
 */
export function getSesion(req: Request, res: Response): void {
  const solicitante = req.solicitante;
  if (!solicitante) throw new ErrorAutenticacion("No se pudo verificar tu sesión.");

  res.status(200).json({
    sesion: { authUserId: solicitante.usuario.id, correo: solicitante.correo },
  });
}
