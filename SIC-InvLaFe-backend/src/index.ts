import { crearApp } from "./app.js";
import { leerEntorno } from "./config/entorno.js";
import { cerrarPool } from "./infraestructura/db/pool.js";

/**
 * Arranque del servidor.
 *
 * La configuración se lee antes de levantar nada: si falta una variable, el
 * proceso muere con un mensaje que dice cuál, en lugar de aceptar peticiones
 * que fallarían más tarde con un 500 sin explicación.
 */
function arrancar(): void {
  let entorno;

  try {
    entorno = leerEntorno();
  } catch (error) {
    console.error(
      "\nNo se pudo arrancar el backend:\n\n" +
        (error instanceof Error ? error.message : String(error)) +
        "\n",
    );
    process.exit(1);
  }

  const app = crearApp();

  const servidor = app.listen(entorno.puerto, () => {
    console.log(
      `SIC-InvLaFe backend escuchando en http://localhost:${entorno.puerto}\n` +
        `  Entorno:  ${entorno.esProduccion ? "production" : "development"}\n` +
        `  Supabase: ${entorno.supabaseUrl}\n` +
        `  CORS:     ${entorno.origenesPermitidos.join(", ")}`,
    );
  });

  // Cierre ordenado: deja terminar las peticiones en curso antes de salir, para
  // no cortar una operación a medias entre Auth y la tabla `usuarios`.
  for (const senal of ["SIGINT", "SIGTERM"] as const) {
    process.on(senal, () => {
      console.log(`\n${senal} recibido, cerrando el servidor…`);
      servidor.close(() => {
        void cerrarPool().finally(() => process.exit(0));
      });
    });
  }
}

arrancar();
