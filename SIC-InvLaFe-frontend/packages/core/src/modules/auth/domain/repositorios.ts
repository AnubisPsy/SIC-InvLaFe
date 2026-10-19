import type { Credenciales, SesionAuth } from "./entidades";

/**
 * Puerto de autenticación. Lo implementa el backend propio (`servicio.backend.ts`);
 * otra implementación podría sustituirlo sin tocar los casos de uso.
 */
export interface ServicioAutenticacion {
  sesionActual(): Promise<SesionAuth | null>;
  iniciarSesion(credenciales: Credenciales): Promise<SesionAuth>;
  cerrarSesion(): Promise<void>;

  /** Cambia la contraseña del usuario autenticado. */
  actualizarContrasena(nueva: string): Promise<void>;

  /**
   * Cambia la contraseña **y** da por cumplido el cambio obligatorio.
   *
   * El backend cambia la contraseña y limpia la marca en `usuarios` en una
   * sola operación.
   */
  cambiarContrasenaObligatoria(nueva: string): Promise<void>;

  /**
   * Notifica login, logout y refresco de token.
   * Devuelve la función para cancelar la suscripción.
   */
  alCambiarSesion(escucha: (sesion: SesionAuth | null) => void): () => void;
}
