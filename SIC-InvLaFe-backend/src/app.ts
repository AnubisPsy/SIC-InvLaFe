import cors from "cors";
import express, { type Express } from "express";
import { ErrorPermisoDenegado } from "./compartido/errores.js";
import { leerEntorno } from "./config/entorno.js";
import { manejarErrores, rutaNoEncontrada } from "./middleware/errores.js";
import { rutasAcceso } from "./modulos/acceso/rutas.js";
import { rutasUsuarios } from "./modulos/usuarios/rutas.js";

/**
 * Construcción de la aplicación, separada del arranque del servidor para poder
 * montarla en pruebas sin ocupar un puerto.
 */
export function crearApp(): Express {
  const entorno = leerEntorno();
  const app = express();

  // Detrás de un proxy (Render, Railway, nginx…) para que `req.ip` y el
  // protocolo reflejen al cliente real y no al proxy.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  /**
   * CORS restringido a los orígenes declarados en `CORS_ORIGENES`.
   *
   * Las peticiones sin `Origin` (curl, health checks, otro servidor) se dejan
   * pasar: CORS es una protección del navegador contra sitios de terceros, no
   * un control de acceso. Quien protege la API es el token, que sí se exige en
   * todas las rutas de administración.
   */
  app.use(
    cors({
      origin(origen, callback) {
        if (!origen || entorno.origenesPermitidos.includes(origen)) {
          callback(null, true);
          return;
        }
        // Un `ErrorHttp` en vez de un `Error` pelado: así el rechazo sale como
        // 403 con cuerpo JSON y no como un 500 que parecería un fallo nuestro.
        callback(
          new ErrorPermisoDenegado(
            `El origen ${origen} no está autorizado. Añádelo a CORS_ORIGENES.`,
          ),
        );
      },
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 86400,
    }),
  );

  // Las contraseñas y los nombres caben de sobra en 100 KB; un límite bajo
  // evita que una petición enorme ocupe memoria del servidor.
  app.use(express.json({ limit: "100kb" }));

  /**
   * Sonda de salud, sin autenticación: el frontend la usa para distinguir
   * «el backend está caído» de «el backend rechazó la operación», y es lo que
   * consultan los servicios de hosting para saber si el proceso vive.
   */
  app.get("/api/salud", (_req, res) => {
    res.json({ estado: "ok", servicio: "sic-invlafe-backend" });
  });

  // Sin autenticación: es donde se obtiene la sesión. Ver `rutasAcceso`.
  app.use("/api/acceso", rutasAcceso);
  app.use("/api/usuarios", rutasUsuarios);

  app.use(rutaNoEncontrada);
  app.use(manejarErrores);

  return app;
}
