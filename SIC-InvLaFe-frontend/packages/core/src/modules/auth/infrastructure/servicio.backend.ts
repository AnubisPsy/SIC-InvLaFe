import type { ClienteApi } from "../../../infrastructure/http/cliente";
import type { AlmacenSesion, SesionGuardada } from "../../../infrastructure/http/sesion";
import { ErrorAutenticacion } from "../../../shared/errores";
import type { Credenciales, SesionAuth } from "../domain/entidades";
import type { ServicioAutenticacion } from "../domain/repositorios";

/** Lo que devuelve `POST /api/acceso/iniciar-sesion`. */
interface RespuestaLogin {
  sesion: SesionGuardada;
}

/** Lo que devuelve `GET /api/acceso/sesion`. */
interface RespuestaSesion {
  sesion: SesionAuth;
}

const aSesionAuth = (sesion: SesionGuardada): SesionAuth => ({
  authUserId: sesion.usuarioId,
  correo: sesion.correo.toLowerCase(),
});

/**
 * Autenticación contra el backend propio.
 *
 * El backend comprueba la contraseña y entrega un token (JWT). El token se
 * guarda en el dispositivo y viaja en cada petición. Cerrar sesión es borrarlo.
 */
export function crearServicioAutenticacion(
  api: ClienteApi,
  sesion: AlmacenSesion,
): ServicioAutenticacion {
  return {
    /**
     * Comprueba con el backend que el token guardado sigue valiendo. Si no
     * (expiró, o el usuario fue desactivado), se borra y no hay sesión.
     */
    async sesionActual() {
      const guardada = await sesion.leer();
      if (!guardada) return null;

      try {
        const respuesta = await api.solicitar<RespuestaSesion>("/api/acceso/sesion", {
          contexto: "recuperar tu sesión",
        });
        return respuesta.sesion;
      } catch (error) {
        if (error instanceof ErrorAutenticacion) {
          await sesion.borrar();
          return null;
        }
        throw error;
      }
    },

    /** Acepta correo o nombre de usuario: el backend decide cuál es. */
    async iniciarSesion(credenciales: Credenciales) {
      const respuesta = await api.solicitar<RespuestaLogin>("/api/acceso/iniciar-sesion", {
        metodo: "POST",
        contexto: "iniciar sesión",
        sinSesion: true,
        cuerpo: {
          identificador: credenciales.identificador,
          contrasena: credenciales.contrasena,
        },
      });

      await sesion.guardar(respuesta.sesion);
      return aSesionAuth(respuesta.sesion);
    },

    async cerrarSesion() {
      await sesion.borrar();
    },

    async actualizarContrasena(nueva: string) {
      await api.solicitar<void>("/api/acceso/cambiar-contrasena", {
        metodo: "POST",
        contexto: "cambiar tu contraseña",
        cuerpo: { contrasena: nueva },
      });
    },

    async cambiarContrasenaObligatoria(nueva: string) {
      await api.solicitar<void>("/api/acceso/cambiar-contrasena", {
        metodo: "POST",
        contexto: "cambiar tu contraseña",
        cuerpo: { contrasena: nueva },
      });
    },

    alCambiarSesion(escucha) {
      return sesion.alCambiar((guardada) => escucha(guardada ? aSesionAuth(guardada) : null));
    },
  };
}
