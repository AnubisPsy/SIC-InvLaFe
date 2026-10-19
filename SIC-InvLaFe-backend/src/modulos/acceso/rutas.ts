import { Router } from "express";
import { exigirAutenticacion } from "../../middleware/autenticacion.js";
import { limitarIntentos } from "../../middleware/limite-intentos.js";
import { getSesion, postCambiarContrasena, postIniciarSesion } from "./controlador.js";

/**
 * Rutas de acceso: las que hacen falta para entrar y para poder empezar a
 * trabajar, antes de tener permiso sobre ningún módulo.
 *
 * `iniciar-sesion` va **sin autenticación**, por motivos evidentes, y existe
 * únicamente para el login por nombre de usuario: quien entra con su correo
 * sigue hablando directamente con Supabase desde el navegador, así que ese
 * camino funciona aunque este servidor esté caído.
 *
 * `cambiar-contrasena` sí exige sesión, pero ningún permiso: es una acción
 * sobre uno mismo.
 */
export const rutasAcceso: Router = Router();

// 10 intentos cada 5 minutos por IP. Da margen de sobra a quien se equivoca
// tecleando y corta en seco la prueba automatizada de contraseñas.
rutasAcceso.post(
  "/iniciar-sesion",
  limitarIntentos({ maximo: 10, ventanaMs: 5 * 60 * 1000 }),
  postIniciarSesion,
);

rutasAcceso.post("/cambiar-contrasena", exigirAutenticacion, postCambiarContrasena);

rutasAcceso.get("/sesion", exigirAutenticacion, getSesion);
