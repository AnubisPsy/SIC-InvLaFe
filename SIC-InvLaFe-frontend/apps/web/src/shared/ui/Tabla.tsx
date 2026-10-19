import {
  Table as MuiTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  type SxProps,
  type Theme,
} from "@mui/material";
import type { ReactNode } from "react";

/**
 * Ancho por debajo del cual la tabla se desplaza en lugar de estrujarse.
 *
 * Sin suelo, una tabla de diez columnas en un teléfono reparte 30 px a cada
 * una y no se lee ninguna. Con él, en escritorio la tabla se adapta al ancho
 * disponible —que es lo normal— y solo en pantallas pequeñas aparece el
 * desplazamiento lateral.
 */
const ANCHOS_MINIMOS = {
  auto: undefined,
  md: "46rem",
  lg: "58rem",
} as const;

export type AnchoMinimoTabla = keyof typeof ANCHOS_MINIMOS;

/**
 * Contenedor de tabla.
 *
 * La tabla ocupa el ancho disponible y deja que el texto fluya a varias
 * líneas: así, añadir una columna reparte el espacio en vez de empujar el
 * total hacia la derecha. Lo único que no se parte son las cifras, que con un
 * salto de línea dejarían de poder compararse de un vistazo.
 */
export function Tabla({
  children,
  className,
  anchoMinimo = "auto",
}: {
  children: ReactNode;
  className?: string;
  /** Suelo por debajo del cual se desplaza. `md` y `lg` son para tablas anchas. */
  anchoMinimo?: AnchoMinimoTabla;
}) {
  return (
    <TableContainer
      className={className}
      sx={{
        borderRadius: 3,
        border: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <MuiTable className="custom-scrollbar" sx={{ minWidth: ANCHOS_MINIMOS[anchoMinimo] }}>
        {children}
      </MuiTable>
    </TableContainer>
  );
}

export function Cabecera({ children }: { children: ReactNode }) {
  return (
    <TableHead
      sx={{
        bgcolor: (tema) => (tema.palette.mode === "light" ? "grey.50" : "rgba(255,255,255,0.02)"),
      }}
    >
      {children}
    </TableHead>
  );
}

export function Cuerpo({ children }: { children: ReactNode }) {
  return <TableBody>{children}</TableBody>;
}

export function Fila({
  children,
  className,
  sx,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  sx?: SxProps<Theme>;
  onClick?: () => void;
}) {
  return (
    <TableRow
      hover={Boolean(onClick)}
      onClick={onClick}
      className={className}
      sx={[onClick ? { cursor: "pointer" } : {}, ...(Array.isArray(sx) ? sx : [sx])]}
    >
      {children}
    </TableRow>
  );
}

export function Celda({
  children,
  cabecera = false,
  alineacion = "izquierda",
  className,
  sx,
  colSpan,
}: {
  children?: ReactNode;
  cabecera?: boolean;
  alineacion?: "izquierda" | "derecha" | "centro";
  className?: string;
  sx?: SxProps<Theme>;
  colSpan?: number;
}) {
  const alineaciones = {
    izquierda: "left",
    derecha: "right",
    centro: "center",
  } as const;

  return (
    <TableCell
      component={cabecera ? "th" : "td"}
      scope={cabecera ? "col" : undefined}
      colSpan={colSpan}
      align={alineaciones[alineacion]}
      className={className}
      sx={[
        {
          py: 1.25,
          px: 1.5,
          wordBreak: "break-word",
          ...(cabecera
            ? { fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.4, color: "text.secondary" }
            : { fontSize: 14, color: "text.primary" }),
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </TableCell>
  );
}

/**
 * Celda con cifras alineadas por dígito, para columnas de dinero.
 * No se parte en dos líneas, porque una cantidad rota deja de leerse como una.
 */
export function CeldaNumero({
  children,
  className,
  sx,
  destacado = false,
}: {
  children: ReactNode;
  className?: string;
  sx?: SxProps<Theme>;
  destacado?: boolean;
}) {
  return (
    <Celda
      alineacion="derecha"
      className={className}
      sx={sx}
      // La celda base ya define tipografía; esta sobreescribe con tabular-nums.
    >
      <Typography
        component="span"
        sx={{
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          fontSize: "inherit",
          fontWeight: destacado ? 600 : 400,
          color: destacado ? "text.primary" : "inherit",
        }}
      >
        {children}
      </Typography>
    </Celda>
  );
}

/**
 * Segunda línea de una celda, en gris pequeño.
 *
 * Es lo que permite quitar columnas sin perder el dato: el número de factura o
 * el lote de origen acompañan al nombre en lugar de reclamar 90 px propios.
 */
export function Subtexto({ children }: { children: ReactNode }) {
  return (
    <Typography
      component="span"
      sx={{ mt: 0.25, display: "block", fontSize: 12, color: "text.secondary" }}
    >
      {children}
    </Typography>
  );
}
