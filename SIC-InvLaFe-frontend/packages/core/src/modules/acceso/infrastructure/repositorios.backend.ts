import type { ClienteApi } from "../../../infrastructure/http/cliente";
import type { ID } from "../../../shared/tipos";
import type { DatosUsuario, Usuario } from "../domain/entidades";
import type { RepositorioUsuarios } from "../domain/repositorios";

/**
 * Repositorio de usuarios que escribe a través del backend administrativo.
 *
 * Es un decorador sobre el repositorio de Supabase: las **lecturas** siguen
 * yendo directas a PostgREST, donde RLS ya las protege y no hace falta ningún
 * privilegio especial; solo las **escrituras** pasan por el backend, porque
 * crear o borrar una cuenta de acceso exige la `service_role` key.
 *
 * Ese reparto mantiene el frontend rápido —listar usuarios no gana nada
 * pasando por un servidor intermedio— y deja el backend reducido a lo que
 * únicamente él puede hacer.
 */
export function crearRepositorioUsuariosBackend(
  base: RepositorioUsuarios,
  api: ClienteApi,
): RepositorioUsuarios {
  /** El backend devuelve la entidad ya en la forma del dominio. */
  interface RespuestaUsuario {
    usuario: Usuario;
  }

  return {
    // --- Lecturas: sin cambios, directas a Supabase ---
    listar: () => base.listar(),
    obtener: (id) => base.obtener(id),
    obtenerPorCorreo: (correo) => base.obtenerPorCorreo(correo),

    // --- Escrituras: por el backend ---

    /**
     * Crea la cuenta de acceso en Supabase Auth y la fila en `usuarios`, en una
     * sola llamada. Antes esto solo insertaba la fila, y el administrador tenía
     * que crear la cuenta a mano en el panel de Supabase.
     */
    async crear(datos: DatosUsuario) {
      const respuesta = await api.solicitar<RespuestaUsuario>("/api/usuarios", {
        metodo: "POST",
        contexto: "crear el usuario",
        cuerpo: {
          nombre: datos.nombre,
          correo: datos.correo,
          usuario: datos.usuario,
          telefono: datos.telefono,
          rolId: datos.rolId,
          activo: datos.activo,
          debeCambiarContrasena: datos.debeCambiarContrasena,
          contrasena: datos.contrasena,
        },
      });
      return respuesta.usuario;
    },

    async actualizar(id: ID, datos: DatosUsuario) {
      const respuesta = await api.solicitar<RespuestaUsuario>(
        `/api/usuarios/${encodeURIComponent(id)}`,
        {
          metodo: "PATCH",
          contexto: "actualizar el usuario",
          cuerpo: {
            nombre: datos.nombre,
            correo: datos.correo,
            usuario: datos.usuario,
            telefono: datos.telefono,
            rolId: datos.rolId,
            activo: datos.activo,
            debeCambiarContrasena: datos.debeCambiarContrasena,
            // Solo viaja si el administrador escribió una nueva: el backend
            // ignora la cadena vacía y deja la contraseña actual intacta.
            ...(datos.contrasena ? { contrasena: datos.contrasena } : {}),
          },
        },
      );
      return respuesta.usuario;
    },

    /**
     * Desactivar no solo marca la fila: el backend bloquea además la cuenta en
     * Auth, así que el usuario deja de poder iniciar sesión. Antes seguía
     * entrando, solo que sin ver ningún módulo.
     */
    async cambiarActivo(id: ID, activo: boolean) {
      const respuesta = await api.solicitar<RespuestaUsuario>(
        `/api/usuarios/${encodeURIComponent(id)}`,
        {
          metodo: "PATCH",
          contexto: activo ? "activar el usuario" : "desactivar el usuario",
          cuerpo: { activo },
        },
      );
      return respuesta.usuario;
    },

    /** Borra la fila y la cuenta de acceso, sin dejar ninguna de las dos huérfana. */
    async eliminar(id: ID) {
      await api.solicitar<void>(`/api/usuarios/${encodeURIComponent(id)}`, {
        metodo: "DELETE",
        contexto: "eliminar el usuario",
      });
    },
  };
}
