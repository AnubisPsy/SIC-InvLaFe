import {
  Checkbox,
  FormControlLabel,
  FormHelperText,
  NativeSelect,
  OutlinedInput,
  Typography,
  type InputBaseProps,
  type NativeSelectProps,
  type SxProps,
  type Theme,
} from "@mui/material";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useId } from "react";

export function Etiqueta({
  htmlFor,
  requerido,
  children,
  className,
}: {
  htmlFor?: string;
  requerido?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Typography
      component="label"
      htmlFor={htmlFor}
      className={className}
      sx={{ display: "block", mb: 0.75, fontSize: 14, fontWeight: 500, color: "text.secondary" }}
    >
      {children}
      {requerido && (
        <Typography component="span" sx={{ ml: 0.5, color: "error.main" }}>
          *
        </Typography>
      )}
    </Typography>
  );
}

/**
 * Envoltorio de campo: etiqueta, control y mensaje de error o ayuda.
 *
 * Genera el `id` y lo enlaza con `htmlFor` y `aria-describedby`, de forma que
 * el lector de pantalla anuncie el error sin que cada formulario tenga que
 * acordarse de cablearlo.
 */
export function Campo({
  etiqueta,
  error,
  ayuda,
  requerido,
  className,
  children,
}: {
  etiqueta: string;
  error?: string;
  ayuda?: string;
  requerido?: boolean;
  className?: string;
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby": string | undefined;
  }) => ReactNode;
}) {
  const id = useId();
  const idMensaje = `${id}-mensaje`;
  const mensaje = error ?? ayuda;

  return (
    <div className={className}>
      <Etiqueta htmlFor={id} requerido={requerido}>
        {etiqueta}
      </Etiqueta>
      {children({
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": mensaje ? idMensaje : undefined,
      })}
      {mensaje && (
        <FormHelperText id={idMensaje} error={Boolean(error)} sx={{ mx: 0, mt: 0.75 }}>
          {mensaje}
        </FormHelperText>
      )}
    </div>
  );
}

export interface PropsEntrada extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  sx?: SxProps<Theme>;
}

export function Entrada({ error = false, className, sx, ...resto }: PropsEntrada) {
  return (
    <OutlinedInput
      fullWidth
      error={error}
      className={className}
      sx={[{ height: 44 }, ...(Array.isArray(sx) ? sx : [sx])]}
      {...(resto as InputBaseProps)}
    />
  );
}

export interface OpcionSelector {
  valor: string;
  etiqueta: string;
}

export interface PropsSelector
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  opciones: readonly OpcionSelector[];
  marcador?: string;
  error?: boolean;
  sx?: SxProps<Theme>;
}

export function Selector({
  opciones,
  marcador = "Selecciona una opción",
  error = false,
  className,
  sx,
  ...resto
}: PropsSelector) {
  return (
    <NativeSelect
      fullWidth
      error={error}
      className={className}
      sx={sx}
      input={<OutlinedInput sx={{ height: 44 }} />}
      {...(resto as NativeSelectProps)}
    >
      <option value="" disabled>
        {marcador}
      </option>
      {opciones.map((opcion) => (
        <option key={opcion.valor} value={opcion.valor}>
          {opcion.etiqueta}
        </option>
      ))}
    </NativeSelect>
  );
}

export interface PropsAreaTexto
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  sx?: SxProps<Theme>;
}

export function AreaTexto({ error = false, className, sx, ...resto }: PropsAreaTexto) {
  return (
    <OutlinedInput
      fullWidth
      multiline
      minRows={4}
      error={error}
      className={className}
      sx={sx}
      {...(resto as InputBaseProps)}
    />
  );
}

export function Casilla({
  checked,
  onChange,
  etiqueta,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (valor: boolean) => void;
  etiqueta?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <FormControlLabel
      className={className}
      disabled={disabled}
      control={
        <Checkbox
          checked={checked}
          onChange={(evento) => onChange(evento.target.checked)}
          size="small"
        />
      }
      label={etiqueta}
      sx={{ ml: -1 }}
    />
  );
}
