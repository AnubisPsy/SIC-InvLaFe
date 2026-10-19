import { createTheme, type PaletteMode, type ThemeOptions } from "@mui/material";

/**
 * Paleta heredada del diseño original en Tailwind: se conserva para que el
 * cambio a MUI no traiga un rediseño de color además del de sistema de UI.
 *
 * Cada color de estado (`success`, `error`, `warning`, `info`) trae, además de
 * `light`/`main`/`dark`, la escala numérica completa (`25`…`950`) vía
 * `declare module` más abajo, para poder escribir `sx={{ bgcolor:
 * "error.50" }}` igual que antes se escribía `bg-error-50`.
 */
const marca = {
  25: "#f2f7ff",
  50: "#ecf3ff",
  100: "#dde9ff",
  200: "#c2d6ff",
  300: "#9cb9ff",
  400: "#7592ff",
  500: "#465fff",
  600: "#3641f5",
  700: "#2a31d8",
  800: "#252dae",
  900: "#262e89",
  950: "#161950",
} as const;

const gris = {
  25: "#fcfcfd",
  50: "#f9fafb",
  100: "#f2f4f7",
  200: "#e4e7ec",
  300: "#d0d5dd",
  400: "#98a2b3",
  500: "#667085",
  600: "#475467",
  700: "#344054",
  800: "#1d2939",
  900: "#101828",
  950: "#0c111d",
} as const;

const exito = {
  25: "#f6fef9",
  50: "#ecfdf3",
  100: "#d1fadf",
  200: "#a6f4c5",
  300: "#6ce9a6",
  400: "#32d583",
  500: "#12b76a",
  600: "#039855",
  700: "#027a48",
  800: "#05603a",
  900: "#054f31",
  950: "#053321",
} as const;

const error = {
  25: "#fffbfa",
  50: "#fef3f2",
  100: "#fee4e2",
  200: "#fecdca",
  300: "#fda29b",
  400: "#f97066",
  500: "#f04438",
  600: "#d92d20",
  700: "#b42318",
  800: "#912018",
  900: "#7a271a",
  950: "#55160c",
} as const;

const advertencia = {
  25: "#fffcf5",
  50: "#fffaeb",
  100: "#fef0c7",
  200: "#fedf89",
  300: "#fec84b",
  400: "#fdb022",
  500: "#f79009",
  600: "#dc6803",
  700: "#b54708",
  800: "#93370d",
  900: "#7a2e0e",
  950: "#4e1d09",
} as const;

const info = {
  25: "#f5fbff",
  50: "#f0f9ff",
  100: "#e0f2fe",
  200: "#b9e6fe",
  300: "#7cd4fd",
  400: "#36bffa",
  500: "#0ba5ec",
  600: "#0086c9",
  700: "#026aa2",
  800: "#065986",
  900: "#0b4a6f",
  950: "#062c41",
} as const;

const fuente = "Outfit, ui-sans-serif, system-ui, sans-serif";

/** Sombra de menús y diálogos flotantes. */
const SOMBRA_MENU =
  "0px 12px 16px -4px rgba(16, 24, 40, 0.08), 0px 4px 6px -2px rgba(16, 24, 40, 0.03)";

export function construirTema(modo: PaletteMode) {
  const claro = modo === "light";

  const opciones: ThemeOptions = {
    palette: {
      mode: modo,
      primary: {
        ...marca,
        light: marca[300],
        main: marca[500],
        dark: marca[700],
        contrastText: "#ffffff",
      },
      success: { ...exito, light: exito[300], main: exito[500], dark: exito[700] },
      error: { ...error, light: error[300], main: error[500], dark: error[700] },
      warning: { ...advertencia, light: advertencia[300], main: advertencia[500], dark: advertencia[700] },
      info: { ...info, light: info[300], main: info[500], dark: info[700] },
      background: {
        default: claro ? gris[50] : gris[950],
        paper: claro ? "#ffffff" : gris[900],
      },
      text: {
        primary: claro ? gris[800] : "rgba(255, 255, 255, 0.9)",
        // gris[400] (el mismo que usaba el diseño original en Tailwind) se ve
        // apagado sobre el fondo casi negro del modo oscuro; gris[300] es más
        // legible sin perder la jerarquía frente al texto primario.
        secondary: claro ? gris[500] : gris[300],
      },
      divider: claro ? gris[200] : "rgba(255, 255, 255, 0.08)",
    },
    typography: {
      fontFamily: fuente,
      button: { textTransform: "none", fontWeight: 500 },
    },
    shape: { borderRadius: 8 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: claro ? gris[50] : gris[950],
          },
          // Sin esto, cualquier <a>/<NavLink> sin pasar por MuiLink hereda el
          // azul y el subrayado por defecto del navegador.
          a: {
            color: "inherit",
            textDecoration: "none",
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none" },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            border: `1px solid ${claro ? gris[200] : "rgba(255, 255, 255, 0.08)"}`,
            borderRadius: 16,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 8, boxShadow: "none", "&:hover": { boxShadow: "none" } },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 500 },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 16,
            boxShadow: SOMBRA_MENU,
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            border: `1px solid ${claro ? gris[200] : "rgba(255, 255, 255, 0.08)"}`,
            boxShadow: SOMBRA_MENU,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: claro ? gris[100] : "rgba(255, 255, 255, 0.06)",
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 8 },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: "none",
            borderBottom: `1px solid ${claro ? gris[200] : gris[800]}`,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRight: `1px solid ${claro ? gris[200] : gris[800]}`,
          },
        },
      },
    },
  };

  return createTheme(opciones);
}

/** Escala numérica añadida a `success`/`error`/`warning`/`info`/`primary`. */
interface EscalaColor {
  25?: string;
  50?: string;
  100?: string;
  200?: string;
  300?: string;
  400?: string;
  500?: string;
  600?: string;
  700?: string;
  800?: string;
  900?: string;
  950?: string;
}

declare module "@mui/material/styles" {
  interface PaletteColor extends EscalaColor {}
  interface SimplePaletteColorOptions extends EscalaColor {}
}
