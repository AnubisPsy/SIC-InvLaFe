import { CONFIG_SESION } from "@invlafe/core";
import { useCallback, useEffect, useState } from "react";

/**
 * Marca de la última actividad, compartida entre pestañas.
 *
 * Va en `localStorage` a propósito: si alguien trabaja en dos pestañas, la
 * actividad en una no debe dejar caducar la otra. Es el mismo almacén donde
 * se guarda la sesión, así que ambas cosas se borran a la vez si el usuario
 * limpia el navegador.
 */
const CLAVE_ACTIVIDAD = "invlafe:ultima-actividad";

/** Bandera que sobrevive a la redirección para que el login explique el cierre. */
const CLAVE_EXPIRADA = "invlafe:sesion-expirada";

const LIMITE_MS = CONFIG_SESION.minutosLimite * 60 * 1000;
const AVISO_MS = CONFIG_SESION.minutosAviso * 60 * 1000;

/** Cada cuánto se recalcula el tiempo restante. */
const INTERVALO_MS = 1000;

/**
 * Escribir en cada evento del ratón saturaría `localStorage` sin ganar nada:
 * la resolución que necesitamos es de segundos, no de milisegundos.
 */
const PERIODO_ESCRITURA_MS = 5000;

const EVENTOS: readonly (keyof WindowEventMap)[] = [
  "pointerdown",
  "keydown",
  "wheel",
  "touchstart",
];

function leerUltimaActividad(): number {
  try {
    const guardado = Number(window.localStorage.getItem(CLAVE_ACTIVIDAD));
    return Number.isFinite(guardado) && guardado > 0 ? guardado : 0;
  } catch {
    // Modo privado o almacenamiento bloqueado: sin marca no hay caducidad,
    // preferible a dejar al usuario fuera cada minuto.
    return 0;
  }
}

function escribirUltimaActividad(momento: number): void {
  try {
    window.localStorage.setItem(CLAVE_ACTIVIDAD, String(momento));
  } catch {
    /* ídem: si no se puede escribir, la sesión simplemente no caduca. */
  }
}

export function marcarSesionExpirada(): void {
  try {
    window.sessionStorage.setItem(CLAVE_EXPIRADA, "1");
  } catch {
    /* sin bandera solo se pierde el mensaje explicativo. */
  }
}

/** Lee y consume la bandera: el aviso se muestra una sola vez. */
export function consumirSesionExpirada(): boolean {
  try {
    const expirada = window.sessionStorage.getItem(CLAVE_EXPIRADA) === "1";
    if (expirada) window.sessionStorage.removeItem(CLAVE_EXPIRADA);
    return expirada;
  } catch {
    return false;
  }
}

export function limpiarActividad(): void {
  try {
    window.localStorage.removeItem(CLAVE_ACTIVIDAD);
  } catch {
    /* nada que limpiar si no hay almacenamiento. */
  }
}

export type FaseInactividad = "activa" | "avisando" | "expirada";

export interface EstadoInactividad {
  fase: FaseInactividad;
  /** Segundos que faltan para el cierre; solo tiene sentido en `avisando`. */
  segundosRestantes: number;
  /** Reinicia la cuenta desde cero. Lo llama el botón «Sigo aquí». */
  reanudar: () => void;
}

/**
 * Vigila la inactividad del usuario.
 *
 * El estado se deriva de una marca de tiempo en vez de un temporizador que se
 * reinicia: un `setTimeout` no corre mientras el portátil está suspendido, así
 * que al despertar la sesión parecería fresca cuando lleva horas abandonada.
 * Comparando contra el reloj, dormir cuenta como inactividad.
 */
export function useInactividad(activo: boolean): EstadoInactividad {
  const [fase, setFase] = useState<FaseInactividad>("activa");
  const [segundosRestantes, setSegundosRestantes] = useState(
    CONFIG_SESION.minutosAviso * 60,
  );

  const reanudar = useCallback(() => {
    escribirUltimaActividad(Date.now());
    setFase("activa");
    setSegundosRestantes(CONFIG_SESION.minutosAviso * 60);
  }, []);

  useEffect(() => {
    if (!activo) return;

    // Al entrar (o al recargar con sesión abierta) la cuenta arranca ahora.
    if (leerUltimaActividad() === 0) escribirUltimaActividad(Date.now());

    let ultimaEscritura = 0;
    /**
     * Copia local de la fase para los manejadores, que se suscriben una sola
     * vez y no verían el estado de React.
     */
    let faseActual: FaseInactividad = "activa";

    const registrarActividad = () => {
      // Durante el aviso la interacción no cuenta: el usuario tiene que decir
      // explícitamente que sigue ahí, o el propio clic de cerrar el modal
      // resucitaría la sesión sin querer.
      if (faseActual === "avisando" || faseActual === "expirada") return;

      const ahora = Date.now();
      if (ahora - ultimaEscritura < PERIODO_ESCRITURA_MS) return;
      ultimaEscritura = ahora;
      escribirUltimaActividad(ahora);
    };

    const revisar = () => {
      const ultima = leerUltimaActividad();
      if (ultima === 0) return;

      const transcurrido = Date.now() - ultima;

      if (transcurrido >= LIMITE_MS) {
        faseActual = "expirada";
        setFase("expirada");
        setSegundosRestantes(0);
        return;
      }

      const restante = LIMITE_MS - transcurrido;

      if (restante <= AVISO_MS) {
        faseActual = "avisando";
        setFase("avisando");
        setSegundosRestantes(Math.ceil(restante / 1000));
        return;
      }

      // Otra pestaña pudo reanudar por nosotros: si el margen volvió a crecer,
      // el aviso se retira solo.
      faseActual = "activa";
      setFase("activa");
    };

    for (const evento of EVENTOS) {
      window.addEventListener(evento, registrarActividad, { passive: true });
    }
    // Volver a la pestaña recalcula al instante, sin esperar al intervalo:
    // los temporizadores de una pestaña en segundo plano van al ralentí.
    document.addEventListener("visibilitychange", revisar);

    const temporizador = window.setInterval(revisar, INTERVALO_MS);
    revisar();

    return () => {
      for (const evento of EVENTOS) {
        window.removeEventListener(evento, registrarActividad);
      }
      document.removeEventListener("visibilitychange", revisar);
      window.clearInterval(temporizador);
    };
  }, [activo]);

  return { fase, segundosRestantes, reanudar };
}
