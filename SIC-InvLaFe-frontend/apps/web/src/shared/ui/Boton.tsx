import { Button, type ButtonProps } from "@mui/material";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variante = "primario" | "contorno" | "fantasma" | "peligro";
type Tamano = "sm" | "md";

const VARIANTE_A_MUI: Record<Variante, Pick<ButtonProps, "variant" | "color">> = {
  primario: { variant: "contained", color: "primary" },
  contorno: { variant: "outlined", color: "inherit" },
  fantasma: { variant: "text", color: "inherit" },
  peligro: { variant: "contained", color: "error" },
};

const TAMANO_A_MUI: Record<Tamano, ButtonProps["size"]> = {
  sm: "small",
  md: "medium",
};

export interface PropsBoton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
  iconoInicio?: ReactNode;
  iconoFin?: ReactNode;
  /** Muestra un spinner y bloquea el botón mientras la mutación está en curso. */
  cargando?: boolean;
  anchoCompleto?: boolean;
  sx?: ButtonProps["sx"];
}

export function Boton({
  variante = "primario",
  tamano = "md",
  iconoInicio,
  iconoFin,
  cargando = false,
  anchoCompleto = false,
  className,
  children,
  disabled,
  type = "button",
  sx,
  ...resto
}: PropsBoton) {
  const { variant, color } = VARIANTE_A_MUI[variante];

  return (
    <Button
      type={type}
      variant={variant}
      color={color}
      size={TAMANO_A_MUI[tamano]}
      disabled={disabled}
      loading={cargando}
      loadingPosition="start"
      fullWidth={anchoCompleto}
      startIcon={cargando ? undefined : iconoInicio}
      endIcon={cargando ? undefined : iconoFin}
      className={className}
      sx={sx}
      {...(resto as ButtonProps)}
    >
      {children}
    </Button>
  );
}
