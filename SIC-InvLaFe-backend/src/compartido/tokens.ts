import jwt from "jsonwebtoken";
import { leerEntorno } from "../config/entorno.js";
import { ErrorAutenticacion } from "./errores.js";

/**
 * Tokens de sesión (JWT).
 *
 * Un JWT es un texto firmado con `JWT_SECRETO`. Dentro lleva el id del usuario
 * (`sub`) y la fecha de expiración. Como solo este servidor conoce la clave,
 * nadie puede fabricar ni modificar un token sin que la firma deje de cuadrar.
 */
export interface TokenEmitido {
  token: string;
  /** Momento en que el token deja de ser válido, en formato ISO. */
  expiraEn: string;
}

export function emitirToken(usuarioId: string): TokenEmitido {
  const entorno = leerEntorno();

  const token = jwt.sign({}, entorno.jwtSecreto, {
    algorithm: "HS256",
    subject: usuarioId,
    expiresIn: entorno.jwtDuracion as jwt.SignOptions["expiresIn"],
  });

  const { exp } = jwt.decode(token) as { exp: number };
  return { token, expiraEn: new Date(exp * 1000).toISOString() };
}

/** Devuelve el id del usuario del token, o lanza 401 si es inválido o expiró. */
export function verificarToken(token: string): string {
  try {
    const carga = jwt.verify(token, leerEntorno().jwtSecreto, {
      algorithms: ["HS256"],
    });
    if (typeof carga === "string" || !carga.sub) throw new Error("Token sin sujeto");
    return carga.sub;
  } catch {
    throw new ErrorAutenticacion("Tu sesión expiró o no es válida. Vuelve a iniciar sesión.");
  }
}
