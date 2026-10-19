import type {
  RepositorioModulos,
  RepositorioPermisos,
  RepositorioUsuarios,
} from "../../acceso/domain/repositorios";
import { modulosSinMapear } from "../../acceso/domain/modulos";
import {
  construirMapaPermisos,
  mapaPermisosVacio,
} from "../../acceso/domain/permisos";
import { ErrorAutenticacion } from "../../../shared/errores";
import type { Credenciales, Sesion, SesionAuth } from "../domain/entidades";
import {
  validarCorreoRecuperacion,
  validarCredenciales,
  validarNuevaContrasena,
} from "../domain/entidades";
import type { ServicioAutenticacion } from "../domain/repositorios";

export interface CasosUsoAuth {
  /** Sesión completa a partir de la que ya está guardada, o `null`. */
  cargarSesion(): Promise<Sesion | null>;
  iniciarSesion(credenciales: Credenciales): Promise<Sesion>;
  cerrarSesion(): Promise<void>;
  enviarCorreoRecuperacion(correo: string, urlRedireccion: string): Promise<void>;
  cambiarContrasena(nueva: string, confirmacion: string): Promise<void>;
  /**
   * Cambia la contraseña y levanta el cambio obligatorio. Devuelve la sesión
   * recompuesta, ya sin la marca, para que quien llama actualice su caché sin
   * tener que volver a leerla.
   */
  cambiarContrasenaObligatoria(nueva: string, confirmacion: string): Promise<Sesion>;
  alCambiarSesion(escucha: (sesion: SesionAuth | null) => void): () => void;
}

export function crearCasosUsoAuth(deps: {
  auth: ServicioAutenticacion;
  usuarios: RepositorioUsuarios;
  modulos: RepositorioModulos;
  permisos: RepositorioPermisos;
}): CasosUsoAuth {
  const { auth, usuarios, modulos, permisos } = deps;

  /**
   * Convierte la identidad de Auth en la sesión de negocio.
   *
   * Es un encadenado deliberado: correo → fila de `usuarios` → rol → permisos.
   * Si falta cualquier eslabón la sesión sigue siendo válida pero sin permisos,
   * para poder explicarle al usuario qué le falta en vez de expulsarlo al login.
   */
  async function componerSesion(identidad: SesionAuth): Promise<Sesion> {
    const usuario = await usuarios.obtenerPorCorreo(identidad.correo);

    if (!usuario || !usuario.rolId || !usuario.activo) {
      return {
        auth: identidad,
        usuario,
        permisos: mapaPermisosVacio(),
        modulosSinConfigurar: [],
      };
    }

    const [listaModulos, listaPermisos] = await Promise.all([
      modulos.listar(),
      permisos.listarPorRol(usuario.rolId),
    ]);

    return {
      auth: identidad,
      usuario,
      permisos: construirMapaPermisos(listaPermisos, listaModulos),
      modulosSinConfigurar: modulosSinMapear(listaModulos),
    };
  }

  return {
    async cargarSesion() {
      const identidad = await auth.sesionActual();
      return identidad ? componerSesion(identidad) : null;
    },

    async iniciarSesion(credenciales) {
      const identidad = await auth.iniciarSesion(validarCredenciales(credenciales));
      return componerSesion(identidad);
    },

    cerrarSesion: () => auth.cerrarSesion(),

    enviarCorreoRecuperacion(correo, urlRedireccion) {
      return auth.enviarCorreoRecuperacion(
        validarCorreoRecuperacion(correo),
        urlRedireccion,
      );
    },

    cambiarContrasena(nueva, confirmacion) {
      return auth.actualizarContrasena(validarNuevaContrasena(nueva, confirmacion));
    },

    async cambiarContrasenaObligatoria(nueva, confirmacion) {
      await auth.cambiarContrasenaObligatoria(
        validarNuevaContrasena(nueva, confirmacion),
      );

      const identidad = await auth.sesionActual();
      if (!identidad) {
        throw new ErrorAutenticacion(
          "Tu contraseña se cambió, pero la sesión ya no es válida. Vuelve a entrar.",
        );
      }

      return componerSesion(identidad);
    },

    alCambiarSesion: (escucha) => auth.alCambiarSesion(escucha),
  };
}
