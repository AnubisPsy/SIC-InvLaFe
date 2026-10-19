/**
 * Sesión guardada en el dispositivo.
 *
 * Al iniciar sesión, el backend entrega un token (JWT). Aquí se guarda, se lee
 * y se borra, y se avisa a quien escuche cada vez que cambia: así la
 * aplicación sabe cuándo mandar al usuario al login.
 */

/**
 * Dónde se guarda físicamente. En web se pasa `window.localStorage`; en
 * React Native se pasaría AsyncStorage. Sin almacenamiento, vive en memoria y
 * se pierde al recargar.
 */
export interface AlmacenamientoSesion {
  getItem(clave: string): Promise<string | null> | string | null;
  setItem(clave: string, valor: string): Promise<void> | void;
  removeItem(clave: string): Promise<void> | void;
}

export interface SesionGuardada {
  token: string;
  /** Momento de expiración del token, en formato ISO. */
  expiraEn: string;
  usuarioId: string;
  correo: string;
}

export interface AlmacenSesion {
  /** La sesión guardada, o `null` si no hay o ya expiró. */
  leer(): Promise<SesionGuardada | null>;
  guardar(sesion: SesionGuardada): Promise<void>;
  borrar(): Promise<void>;
  /** Avisa cada vez que se guarda o se borra la sesión. Devuelve cómo dejar de escuchar. */
  alCambiar(escucha: (sesion: SesionGuardada | null) => void): () => void;
}

const CLAVE = "invlafe:sesion";

function almacenamientoEnMemoria(): AlmacenamientoSesion {
  const datos = new Map<string, string>();
  return {
    getItem: (clave) => datos.get(clave) ?? null,
    setItem: (clave, valor) => void datos.set(clave, valor),
    removeItem: (clave) => void datos.delete(clave),
  };
}

function esSesionGuardada(valor: unknown): valor is SesionGuardada {
  const v = valor as Partial<SesionGuardada> | null;
  return (
    typeof v?.token === "string" &&
    typeof v.expiraEn === "string" &&
    typeof v.usuarioId === "string" &&
    typeof v.correo === "string"
  );
}

export function crearAlmacenSesion(
  almacenamiento: AlmacenamientoSesion = almacenamientoEnMemoria(),
): AlmacenSesion {
  const escuchas = new Set<(sesion: SesionGuardada | null) => void>();
  const avisar = (sesion: SesionGuardada | null) => {
    for (const escucha of escuchas) escucha(sesion);
  };

  async function borrar(): Promise<void> {
    await almacenamiento.removeItem(CLAVE);
    avisar(null);
  }

  return {
    async leer() {
      let texto: string | null;
      try {
        texto = await almacenamiento.getItem(CLAVE);
      } catch {
        return null;
      }
      if (!texto) return null;

      let sesion: unknown;
      try {
        sesion = JSON.parse(texto);
      } catch {
        await borrar();
        return null;
      }

      if (!esSesionGuardada(sesion) || Date.parse(sesion.expiraEn) <= Date.now()) {
        await borrar();
        return null;
      }
      return sesion;
    },

    async guardar(sesion) {
      await almacenamiento.setItem(CLAVE, JSON.stringify(sesion));
      avisar(sesion);
    },

    borrar,

    alCambiar(escucha) {
      escuchas.add(escucha);
      return () => escuchas.delete(escucha);
    },
  };
}
