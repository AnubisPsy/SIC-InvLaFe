import type { Request, Response } from "express";
import { parametroDeRuta } from "../../compartido/http.js";
import {
  actualizarRol,
  contarUsuariosDelRol,
  crearRol,
  eliminarRol,
  guardarPermisosDelRol,
  listarModulos,
  listarPermisosDelRol,
  listarRoles,
  obtenerRol,
  validarNombreRol,
  validarPermisos,
} from "./servicio.js";

export async function getRoles(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ roles: await listarRoles() });
}

export async function getRol(req: Request, res: Response): Promise<void> {
  res.status(200).json({ rol: await obtenerRol(parametroDeRuta(req, "id")) });
}

export async function postRol(req: Request, res: Response): Promise<void> {
  res.status(201).json({ rol: await crearRol(validarNombreRol(req.body)) });
}

export async function patchRol(req: Request, res: Response): Promise<void> {
  const rol = await actualizarRol(parametroDeRuta(req, "id"), validarNombreRol(req.body));
  res.status(200).json({ rol });
}

export async function deleteRol(req: Request, res: Response): Promise<void> {
  await eliminarRol(parametroDeRuta(req, "id"));
  res.status(204).end();
}

export async function getCantidadUsuarios(req: Request, res: Response): Promise<void> {
  const cantidad = await contarUsuariosDelRol(parametroDeRuta(req, "id"));
  res.status(200).json({ cantidad });
}

export async function getPermisos(req: Request, res: Response): Promise<void> {
  const permisos = await listarPermisosDelRol(parametroDeRuta(req, "id"));
  res.status(200).json({ permisos });
}

export async function putPermisos(req: Request, res: Response): Promise<void> {
  const permisos = await guardarPermisosDelRol(
    parametroDeRuta(req, "id"),
    validarPermisos(req.body),
  );
  res.status(200).json({ permisos });
}

export async function getModulos(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ modulos: await listarModulos() });
}
