import type { Credenciales, SesionAuth } from "./entidades";

/**
 * Puerto de autenticación. Lo implementa Supabase Auth en la web y lo
 * implementaría el SDK equivalente en React Native sin tocar los casos de uso.
 */
export interface ServicioAutenticacion {
  sesionActual(): Promise<SesionAuth | null>;
  iniciarSesion(credenciales: Credenciales): Promise<SesionAuth>;
  cerrarSesion(): Promise<void>;

  /** Envía el correo de recuperación apuntando a `urlRedireccion`. */
  enviarCorreoRecuperacion(correo: string, urlRedireccion: string): Promise<void>;

  /** Cambia la contraseña del usuario autenticado (tras abrir el enlace del correo). */
  actualizarContrasena(nueva: string): Promise<void>;

  /**
   * Cambia la contraseña **y** da por cumplido el cambio obligatorio.
   *
   * Va por el backend, no por Supabase directamente, porque además de la
   * contraseña hay que limpiar la marca en `usuarios`, y permitir esa escritura
   * desde el navegador exigiría abrir por RLS la fila donde también viven el
   * rol y el estado activo.
   */
  cambiarContrasenaObligatoria(nueva: string): Promise<void>;

  /**
   * Notifica login, logout y refresco de token.
   * Devuelve la función para cancelar la suscripción.
   */
  alCambiarSesion(escucha: (sesion: SesionAuth | null) => void): () => void;
}
