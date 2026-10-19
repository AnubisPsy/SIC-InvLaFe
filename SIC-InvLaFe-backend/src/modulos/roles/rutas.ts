import { Router, type Request } from "express";
import { exigirAutenticacion } from "../../middleware/autenticacion.js";
import { exigirPermiso, exigirPermisoOPropio } from "../../middleware/autorizacion.js";
import { MODULOS } from "../acceso/modulos.js";
import {
  deleteRol,
  getCantidadUsuarios,
  getModulos,
  getPermisos,
  getRol,
  getRoles,
  patchRol,
  postRol,
  putPermisos,
} from "./controlador.js";

const USUARIOS_ROLES = MODULOS.USUARIOS_ROLES;

/** `true` si la petición es sobre el rol de quien la hace. */
const esMiRol = (req: Request) =>
  Boolean(req.solicitante?.usuario.rolId) && req.params.id === req.solicitante?.usuario.rolId;

/**
 * Endpoints de roles y permisos.
 *
 * Leer tu propio rol y sus permisos no exige nada más que la sesión: la
 * aplicación lo necesita para saber qué menús mostrarte.
 */
export const rutasRoles: Router = Router();

rutasRoles.use(exigirAutenticacion);

rutasRoles.get("/", exigirPermiso(USUARIOS_ROLES, "ver"), getRoles);
rutasRoles.get("/:id", exigirPermisoOPropio(USUARIOS_ROLES, "ver", esMiRol), getRol);
rutasRoles.post("/", exigirPermiso(USUARIOS_ROLES, "crear"), postRol);
rutasRoles.patch("/:id", exigirPermiso(USUARIOS_ROLES, "editar"), patchRol);
rutasRoles.delete("/:id", exigirPermiso(USUARIOS_ROLES, "eliminar"), deleteRol);

rutasRoles.get("/:id/usuarios/cantidad", exigirPermiso(USUARIOS_ROLES, "ver"), getCantidadUsuarios);

rutasRoles.get(
  "/:id/permisos",
  exigirPermisoOPropio(USUARIOS_ROLES, "ver", esMiRol),
  getPermisos,
);
rutasRoles.put("/:id/permisos", exigirPermiso(USUARIOS_ROLES, "editar"), putPermisos);

/** Los módulos los necesita cualquiera con sesión, para armar su menú. */
export const rutasModulos: Router = Router();

rutasModulos.get("/", exigirAutenticacion, getModulos);
