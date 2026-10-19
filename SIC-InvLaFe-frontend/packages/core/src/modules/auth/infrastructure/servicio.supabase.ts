import type { ClienteApi } from "../../../infrastructure/http/cliente";
import type { ClienteSupabase } from "../../../infrastructure/supabase/cliente";
import { traducirErrorAuth } from "../../../infrastructure/supabase/errores";
import { ErrorAutenticacion } from "../../../shared/errores";
import { pareceCorreo } from "../../../shared/texto";
import type { Credenciales, SesionAuth } from "../domain/entidades";
import type { ServicioAutenticacion } from "../domain/repositorios";

interface UsuarioAuthCrudo {
  id: string;
  email?: string | null;
}

/** Tokens que devuelve `POST /api/acceso/iniciar-sesion`. */
interface RespuestaSesion {
  sesion: {
    accessToken: string;
    refreshToken: string;
  };
}

function aSesionAuth(usuario: UsuarioAuthCrudo | null | undefined): SesionAuth | null {
  if (!usuario?.email) return null;
  return { authUserId: usuario.id, correo: usuario.email.toLowerCase() };
}

export function crearServicioAutenticacion(
  cliente: ClienteSupabase,
  api: ClienteApi,
): ServicioAutenticacion {
  /**
   * Login por nombre de usuario, a través del backend.
   *
   * Supabase Auth solo acepta correo o teléfono como identificador, así que el
   * nombre hay que traducirlo antes; esa traducción exige leer `usuarios` sin
   * sesión, que es justo lo que RLS impide desde el navegador. El backend, con
   * la service key, sí puede, y devuelve los tokens ya emitidos para que el
   * cliente los instale como si hubiera entrado por su cuenta.
   */
  async function iniciarSesionPorNombreUsuario(
    credenciales: Credenciales,
  ): Promise<UsuarioAuthCrudo | null> {
    const { sesion } = await api.solicitar<RespuestaSesion>(
      "/api/acceso/iniciar-sesion",
      {
        metodo: "POST",
        contexto: "iniciar sesión",
        sinSesion: true,
        cuerpo: {
          identificador: credenciales.identificador,
          contrasena: credenciales.contrasena,
        },
      },
    );

    // `setSession` instala los tokens en el cliente y, de paso, devuelve el
    // usuario que llevan dentro: no hace falta una consulta extra.
    const { data, error } = await cliente.auth.setSession({
      access_token: sesion.accessToken,
      refresh_token: sesion.refreshToken,
    });

    if (error) throw traducirErrorAuth(error);
    return data.user;
  }

  return {
    async sesionActual() {
      const { data, error } = await cliente.auth.getSession();
      if (error) throw traducirErrorAuth(error);
      return aSesionAuth(data.session?.user);
    },

    /**
     * Dos caminos según lo que se haya escrito, y la diferencia importa:
     *
     * - **Correo**: se habla con Supabase directamente, como siempre. No pasa
     *   por el backend, así que entrar con el correo sigue funcionando aunque
     *   el servidor administrativo esté caído.
     * - **Nombre de usuario**: hay que traducirlo a correo primero, y eso solo
     *   puede hacerlo el backend.
     */
    async iniciarSesion(credenciales: Credenciales) {
      const { identificador, contrasena } = credenciales;

      let usuario: UsuarioAuthCrudo | null;

      if (pareceCorreo(identificador)) {
        const { data, error } = await cliente.auth.signInWithPassword({
          email: identificador,
          password: contrasena,
        });
        if (error) throw traducirErrorAuth(error);
        usuario = data.user;
      } else {
        usuario = await iniciarSesionPorNombreUsuario(credenciales);
      }

      const sesion = aSesionAuth(usuario);
      if (!sesion) {
        throw new ErrorAutenticacion(
          "La cuenta no tiene un correo asociado. Contacta al administrador.",
        );
      }
      return sesion;
    },

    async cerrarSesion() {
      const { error } = await cliente.auth.signOut();
      if (error) throw traducirErrorAuth(error);
    },

    async enviarCorreoRecuperacion(correo: string, urlRedireccion: string) {
      const { error } = await cliente.auth.resetPasswordForEmail(correo, {
        redirectTo: urlRedireccion,
      });
      if (error) throw traducirErrorAuth(error);
    },

    async actualizarContrasena(nueva: string) {
      const { error } = await cliente.auth.updateUser({ password: nueva });
      if (error) throw traducirErrorAuth(error);
    },

    async cambiarContrasenaObligatoria(nueva: string) {
      await api.solicitar<void>("/api/acceso/cambiar-contrasena", {
        metodo: "POST",
        contexto: "cambiar tu contraseña",
        cuerpo: { contrasena: nueva },
      });
    },

    /**
     * `onAuthStateChange` dispara también en el refresco de token. La app usa
     * este canal para invalidar la caché cuando la sesión cambia en otra
     * pestaña o cuando el enlace de recuperación crea una sesión temporal.
     */
    alCambiarSesion(escucha) {
      const { data } = cliente.auth.onAuthStateChange((_evento, sesion) => {
        escucha(aSesionAuth(sesion?.user));
      });
      return () => data.subscription.unsubscribe();
    },
  };
}
