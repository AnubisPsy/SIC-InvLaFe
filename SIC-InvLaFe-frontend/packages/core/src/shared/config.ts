/**
 * Configuración regional del negocio.
 *
 * Está aislada en un solo lugar porque es lo primero que cambia si el sistema
 * se usa en otro país: moneda, formato de fecha y unidad de medida.
 */
export const CONFIG_REGIONAL = {
  locale: "es-HN",
  moneda: "LPS",
  /** Unidad en la que se compra y vende el combustible. */
  unidadCantidad: "gal",
  zonaHoraria: "America/Tegucigalpa",
} as const;

/**
 * Caducidad de la sesión por inactividad.
 *
 * El token del backend dura varias horas, así que el corte por inactividad lo
 * pone la aplicación: pasado `minutosLimite` sin que el
 * usuario toque nada, se cierra la sesión. Vive aquí, y no en la app web,
 * porque la política es del negocio y una app móvil tendría que respetarla.
 */
export const CONFIG_SESION = {
  minutosLimite: 60,
  /** Minutos de aviso previo, para no perder un formulario a medio llenar. */
  minutosAviso: 2,
} as const;
