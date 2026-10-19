import type { Request, Response } from "express";
import { ErrorAutenticacion, ErrorValidacion } from "../../compartido/errores.js";
import type { UsuarioSistema } from "../acceso/servicio.js";
import { validarCrearUsuario, validarEditarUsuario } from "./esquema.js";
import {
  crearUsuario,
  editarUsuario,
  eliminarUsuario,
  listarUsuarios,
  obtenerUsuarioDetalle,
  obtenerUsuarioDetallePorCorreo,
  type UsuarioDetalle,
} from "./servicio.js";

/**
 * Forma del usuario que devuelve la API.
 *
 * Es exactamente la entidad `Usuario` del frontend
 * (`packages/core/src/modules/acceso/domain/entidades.ts`), en camelCase: así
 * el adaptador HTTP no necesita traducir nada y las respuestas encajan en la
 * caché de TanStack Query igual que el resto de filas.
 *
 * `auth_user_id` no se expone: es un detalle interno del enlace con Auth.
 */
interface UsuarioRespuesta {
  id: string;
  nombre: string;
  correo: string;
  usuario: string | null;
  telefono: string | null;
  rolId: string | null;
  activo: boolean;
  debeCambiarContrasena: boolean;
  creadoEn: string;
}

function aRespuesta(usuario: UsuarioSistema): UsuarioRespuesta {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    correo: usuario.correo,
    usuario: usuario.usuario,
    telefono: usuario.telefono,
    rolId: usuario.rolId,
    activo: usuario.activo,
    debeCambiarContrasena: usuario.debeCambiarContrasena,
    creadoEn: usuario.creadoEn,
  };
}

function solicitanteDe(req: Request) {
  const solicitante = req.solicitante;
  if (!solicitante) throw new ErrorAutenticacion("No se pudo verificar tu sesión.");
  return solicitante;
}

/**
 * Express 5 tipa los parámetros de ruta como `string | string[]`, porque un
 * patrón puede capturar varios segmentos. `/:id` nunca lo hace, pero la
 * comprobación es gratis y evita que un id llegue como array al servicio.
 */
function idDeRuta(req: Request): string {
  const crudo = req.params.id;
  const id = (Array.isArray(crudo) ? crudo[0] : crudo)?.trim();
  if (!id) throw new ErrorValidacion("Falta el id del usuario en la ruta.");
  return id;
}

function aRespuestaDetalle(usuario: UsuarioDetalle) {
  return { ...aRespuesta(usuario), rol: usuario.rol };
}

/** `GET /api/usuarios` — todos los usuarios con su rol. */
export async function getUsuarios(_req: Request, res: Response): Promise<void> {
  const usuarios = await listarUsuarios();
  res.status(200).json({ usuarios: usuarios.map(aRespuestaDetalle) });
}

/** `GET /api/usuarios/:id` — un usuario con su rol, o `null` si no existe. */
export async function getUsuario(req: Request, res: Response): Promise<void> {
  const usuario = await obtenerUsuarioDetalle(idDeRuta(req));
  res.status(200).json({ usuario: usuario ? aRespuestaDetalle(usuario) : null });
}

/** `GET /api/usuarios/por-correo?correo=...` — lo usa la sesión para cargar tu usuario. */
export async function getUsuarioPorCorreo(req: Request, res: Response): Promise<void> {
  const correo = typeof req.query.correo === "string" ? req.query.correo.trim() : "";
  if (!correo) throw new ErrorValidacion("Falta el parámetro «correo».");

  const usuario = await obtenerUsuarioDetallePorCorreo(correo);
  res.status(200).json({ usuario: usuario ? aRespuestaDetalle(usuario) : null });
}

export async function postUsuario(req: Request, res: Response): Promise<void> {
  const datos = validarCrearUsuario(req.body);
  const usuario = await crearUsuario(datos);
  res.status(201).json({ usuario: aRespuesta(usuario) });
}

export async function patchUsuario(req: Request, res: Response): Promise<void> {
  const cambios = validarEditarUsuario(req.body);
  const usuario = await editarUsuario(idDeRuta(req), cambios, solicitanteDe(req));
  res.status(200).json({ usuario: aRespuesta(usuario) });
}

export async function deleteUsuario(req: Request, res: Response): Promise<void> {
  await eliminarUsuario(idDeRuta(req), solicitanteDe(req));
  res.status(204).end();
}
