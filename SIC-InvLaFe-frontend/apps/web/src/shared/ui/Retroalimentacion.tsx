import { mensajeDeError } from "@invlafe/core";
import {
  Alert as MuiAlert,
  AlertTitle,
  Box,
  CircularProgress,
  Stack,
  Typography,
  alpha,
  type SxProps,
  type Theme,
} from "@mui/material";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

type TipoAlerta = "exito" | "error" | "advertencia" | "info";

const TIPO_A_MUI: Record<TipoAlerta, "success" | "error" | "warning" | "info"> = {
  exito: "success",
  error: "error",
  advertencia: "warning",
  info: "info",
};

export function Alerta({
  tipo = "info",
  titulo,
  children,
  className,
  sx,
}: {
  tipo?: TipoAlerta;
  titulo?: string;
  children?: ReactNode;
  className?: string;
  sx?: SxProps<Theme>;
}) {
  return (
    <MuiAlert
      severity={TIPO_A_MUI[tipo]}
      className={className}
      sx={[{ borderRadius: 3 }, ...(Array.isArray(sx) ? sx : [sx])]}
    >
      {titulo && <AlertTitle sx={{ fontWeight: 600 }}>{titulo}</AlertTitle>}
      {children}
    </MuiAlert>
  );
}

export function Cargador({
  etiqueta = "Cargando…",
  className,
}: {
  etiqueta?: string;
  className?: string;
}) {
  return (
    <Stack
      role="status"
      className={className}
      sx={{ alignItems: "center", justifyContent: "center", gap: 1.5, py: 6, color: "text.secondary" }}
    >
      <CircularProgress size={24} />
      <Typography sx={{ fontSize: 14 }}>{etiqueta}</Typography>
    </Stack>
  );
}

export function EstadoVacio({
  titulo,
  descripcion,
  icono,
  accion,
}: {
  titulo: string;
  descripcion?: string;
  icono?: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <Stack sx={{ alignItems: "center", justifyContent: "center", textAlign: "center", px: 3, py: 7 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 48,
          height: 48,
          borderRadius: "50%",
          bgcolor: (tema) => (tema.palette.mode === "light" ? "grey.100" : alpha("#fff", 0.06)),
          color: "text.secondary",
        }}
      >
        {icono ?? <Inbox size={22} aria-hidden />}
      </Box>
      <Typography sx={{ mt: 2, fontSize: 14, fontWeight: 500 }}>{titulo}</Typography>
      {descripcion && (
        <Typography sx={{ mt: 0.5, maxWidth: 380, fontSize: 14, color: "text.secondary" }}>
          {descripcion}
        </Typography>
      )}
      {accion && <Box sx={{ mt: 2.5 }}>{accion}</Box>}
    </Stack>
  );
}

/**
 * Resuelve los tres estados de una consulta en un solo lugar.
 *
 * Sin esto cada pantalla repetiría el mismo `if (isPending) … if (error) … if
 * (!datos.length) …`, y bastaría con olvidarse de uno para que la página se
 * quedara en blanco sin explicación.
 */
export function EstadoConsulta<T>({
  cargando,
  error,
  datos,
  vacio,
  enTabla = false,
  children,
}: {
  cargando: boolean;
  error: unknown;
  datos: T[] | undefined;
  vacio: ReactNode;
  /**
   * `true` cuando se usa dentro de un `<Cuerpo>`.
   *
   * Un `<div>` suelto dentro de un `<tbody>` es HTML inválido: el navegador lo
   * saca fuera de la tabla y el mensaje aparece flotando por encima del marco
   * en vez de dentro. Con esto, la carga y el error se envuelven en una fila.
   */
  enTabla?: boolean;
  children: (datos: T[]) => ReactNode;
}) {
  const envolver = (contenido: ReactNode) =>
    enTabla ? (
      <tr>
        {/* Un colSpan generoso cubre cualquier tabla sin tener que contarle
            las columnas desde fuera. */}
        <td colSpan={100}>{contenido}</td>
      </tr>
    ) : (
      <>{contenido}</>
    );

  if (cargando) return envolver(<Cargador />);

  if (error) {
    return envolver(
      <Box sx={{ p: 2.5 }}>
        <Alerta tipo="error" titulo="No se pudieron cargar los datos">
          {mensajeDeError(error)}
        </Alerta>
      </Box>,
    );
  }

  if (!datos || datos.length === 0) return <>{vacio}</>;

  return <>{children(datos)}</>;
}
