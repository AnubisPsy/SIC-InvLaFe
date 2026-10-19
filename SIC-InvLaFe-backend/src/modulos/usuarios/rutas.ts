import { Router } from "express";
import { exigirAutenticacion } from "../../middleware/autenticacion.js";
import { exigirPermiso } from "../../middleware/autorizacion.js";
import { MODULOS } from "../acceso/modulos.js";
import { deleteUsuario, patchUsuario, postUsuario } from "./controlador.js";

/**
 * Endpoints de administración de usuarios.
 *
 * Los tres exigen sesión válida y el permiso correspondiente sobre el módulo
 * «Usuarios y roles». Las lecturas (listar usuarios, roles, permisos) no están
 * aquí a propósito: el frontend las hace directamente contra Supabase, donde
 * RLS ya las protege, y duplicarlas solo añadiría código que mantener.
 */
export const rutasUsuarios: Router = Router();

rutasUsuarios.use(exigirAutenticacion);

rutasUsuarios.post(
  "/",
  exigirPermiso(MODULOS.USUARIOS_ROLES, "crear"),
  postUsuario,
);

rutasUsuarios.patch(
  "/:id",
  exigirPermiso(MODULOS.USUARIOS_ROLES, "editar"),
  patchUsuario,
);

rutasUsuarios.delete(
  "/:id",
  exigirPermiso(MODULOS.USUARIOS_ROLES, "eliminar"),
  deleteUsuario,
);
