import { Router, type Request } from "express";
import { exigirAutenticacion } from "../../middleware/autenticacion.js";
import { exigirPermiso, exigirPermisoOPropio } from "../../middleware/autorizacion.js";
import { MODULOS } from "../acceso/modulos.js";
import {
  deleteUsuario,
  getUsuario,
  getUsuarioPorCorreo,
  getUsuarios,
  patchUsuario,
  postUsuario,
} from "./controlador.js";

/**
 * Endpoints de usuarios.
 *
 * Todos exigen sesión. Leer o modificar a otros exige el permiso
 * correspondiente sobre «Usuarios y roles»; leer tus propios datos no.
 */
export const rutasUsuarios: Router = Router();

rutasUsuarios.use(exigirAutenticacion);

const esMiCorreo = (req: Request) =>
  typeof req.query.correo === "string" &&
  req.query.correo.trim().toLowerCase() === req.solicitante?.correo;

const esMiId = (req: Request) => req.params.id === req.solicitante?.usuario.id;

rutasUsuarios.get("/", exigirPermiso(MODULOS.USUARIOS_ROLES, "ver"), getUsuarios);

// Va antes de "/:id" para que "por-correo" no se interprete como un id.
rutasUsuarios.get(
  "/por-correo",
  exigirPermisoOPropio(MODULOS.USUARIOS_ROLES, "ver", esMiCorreo),
  getUsuarioPorCorreo,
);

rutasUsuarios.get(
  "/:id",
  exigirPermisoOPropio(MODULOS.USUARIOS_ROLES, "ver", esMiId),
  getUsuario,
);

rutasUsuarios.post("/", exigirPermiso(MODULOS.USUARIOS_ROLES, "crear"), postUsuario);

rutasUsuarios.patch("/:id", exigirPermiso(MODULOS.USUARIOS_ROLES, "editar"), patchUsuario);

rutasUsuarios.delete("/:id", exigirPermiso(MODULOS.USUARIOS_ROLES, "eliminar"), deleteUsuario);
