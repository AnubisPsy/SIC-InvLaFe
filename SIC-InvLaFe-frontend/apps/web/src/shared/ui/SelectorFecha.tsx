import { esFechaISOValida, formatearFecha, hoyISO, type FechaISO } from "@invlafe/core";
import { Box, ButtonBase, Paper, Typography } from "@mui/material";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const DIAS_SEMANA = ["D", "L", "M", "M", "J", "V", "S"];

const NOMBRE_MES = new Intl.DateTimeFormat("es-HN", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Todo el cálculo del calendario vive en UTC para que ningún huso corra el día. */
function aISO(fecha: Date): FechaISO {
  return fecha.toISOString().slice(0, 10);
}

function primerDiaVisible(anio: number, mes: number): Date {
  const primerDiaDelMes = new Date(Date.UTC(anio, mes, 1));
  const inicio = new Date(primerDiaDelMes);
  // Retrocede hasta el domingo de esa semana, así la grilla siempre arranca en domingo.
  inicio.setUTCDate(primerDiaDelMes.getUTCDate() - primerDiaDelMes.getUTCDay());
  return inicio;
}

/** 42 celdas (6 semanas) alcanzan para cualquier mes, incluyendo días del mes vecino. */
function celdasDelMes(anio: number, mes: number): Date[] {
  const inicio = primerDiaVisible(anio, mes);
  return Array.from({ length: 42 }, (_, indice) => {
    const dia = new Date(inicio);
    dia.setUTCDate(inicio.getUTCDate() + indice);
    return dia;
  });
}

/** Normaliza mes fuera de 0-11 (p. ej. -1 o 12) al año/mes que le corresponde. */
function normalizarMes(anio: number, mes: number): { anio: number; mes: number } {
  const fecha = new Date(Date.UTC(anio, mes, 1));
  return { anio: fecha.getUTCFullYear(), mes: fecha.getUTCMonth() };
}

export interface PropsSelectorFecha {
  id?: string;
  value: FechaISO;
  onChange: (fecha: FechaISO) => void;
  /** No deja elegir (ni navegar visualmente más allá con sentido) fechas fuera de este rango. */
  min?: FechaISO;
  max?: FechaISO;
  error?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/**
 * Campo de fecha con calendario propio en vez del selector nativo del
 * navegador: mismo aspecto en Chrome, Firefox o Safari, y respeta el tema
 * oscuro, que el `<input type="date">` del sistema operativo no puede.
 */
export function SelectorFecha({
  id,
  value,
  onChange,
  min,
  max,
  error = false,
  ...aria
}: PropsSelectorFecha) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  const base = esFechaISOValida(value) ? value : hoyISO();
  const [visible, setVisible] = useState(() => {
    const [anio, mes] = base.split("-").map(Number);
    return { anio, mes: mes - 1 };
  });

  // Cierra al hacer clic afuera, igual que los demás menús desplegables de la app.
  useEffect(() => {
    if (!abierto) return;
    const alHacerClic = (evento: MouseEvent) => {
      if (!contenedor.current?.contains(evento.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", alHacerClic);
    return () => document.removeEventListener("mousedown", alHacerClic);
  }, [abierto]);

  // Al abrir, el mes visible salta al de la fecha ya elegida (o a hoy si no hay).
  useEffect(() => {
    if (!abierto) return;
    const [anio, mes] = base.split("-").map(Number);
    setVisible({ anio, mes: mes - 1 });
  }, [abierto, base]);

  const hoy = hoyISO();
  const celdas = celdasDelMes(visible.anio, visible.mes);

  function irAMes(delta: number) {
    setVisible((actual) => normalizarMes(actual.anio, actual.mes + delta));
  }

  function elegir(iso: FechaISO) {
    if (min && iso < min) return;
    if (max && iso > max) return;
    onChange(iso);
    setAbierto(false);
  }

  const hoyFueraDeRango = (min !== undefined && hoy < min) || (max !== undefined && hoy > max);

  return (
    <Box sx={{ position: "relative" }} ref={contenedor}>
      <ButtonBase
        id={id}
        onClick={() => setAbierto((valor) => !valor)}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        {...aria}
        sx={{
          display: "flex",
          height: 44,
          width: "100%",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          borderRadius: 2,
          border: 1,
          borderColor: error ? "error.main" : "divider",
          px: 2,
          fontSize: 14,
          textAlign: "left",
          "&:focus-visible": {
            outline: "2px solid",
            outlineColor: error ? "error.main" : "primary.main",
            outlineOffset: 2,
          },
        }}
      >
        <Typography
          component="span"
          sx={{ fontSize: 14, color: esFechaISOValida(value) ? "text.primary" : "text.disabled" }}
        >
          {esFechaISOValida(value) ? formatearFecha(value) : "Selecciona una fecha"}
        </Typography>
        <Calendar size={16} color="currentColor" style={{ flexShrink: 0, opacity: 0.6 }} aria-hidden />
      </ButtonBase>

      {abierto && (
        <Paper
          role="dialog"
          aria-label="Elegir fecha"
          elevation={0}
          sx={{
            position: "absolute",
            left: 0,
            zIndex: 20,
            mt: 1,
            width: 288,
            borderRadius: 3,
            border: 1,
            borderColor: "divider",
            p: 1.5,
            boxShadow: 6,
          }}
        >
          <Box sx={{ mb: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <ButtonBase
              onClick={() => irAMes(-1)}
              aria-label="Mes anterior"
              sx={{ borderRadius: 2, p: 0.75, color: "text.secondary" }}
            >
              <ChevronLeft size={16} aria-hidden />
            </ButtonBase>
            <Typography sx={{ fontSize: 14, fontWeight: 500, textTransform: "capitalize" }}>
              {NOMBRE_MES.format(new Date(Date.UTC(visible.anio, visible.mes, 1)))}
            </Typography>
            <ButtonBase
              onClick={() => irAMes(1)}
              aria-label="Mes siguiente"
              sx={{ borderRadius: 2, p: 0.75, color: "text.secondary" }}
            >
              <ChevronRight size={16} aria-hidden />
            </ButtonBase>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              rowGap: 0.5,
              textAlign: "center",
              fontSize: 12,
              color: "text.disabled",
            }}
          >
            {DIAS_SEMANA.map((dia, indice) => (
              <Typography key={indice} component="span" sx={{ py: 0.5, fontSize: 12 }}>
                {dia}
              </Typography>
            ))}
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", rowGap: 0.5 }}>
            {celdas.map((celda) => {
              const iso = aISO(celda);
              const delMesVisible = celda.getUTCMonth() === visible.mes;
              const seleccionado = iso === value;
              const esHoy = iso === hoy;
              const deshabilitado = (min !== undefined && iso < min) || (max !== undefined && iso > max);

              return (
                <ButtonBase
                  key={iso}
                  onClick={() => elegir(iso)}
                  disabled={deshabilitado}
                  aria-current={esHoy ? "date" : undefined}
                  sx={{
                    mx: "auto",
                    display: "flex",
                    width: 36,
                    height: 36,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 2,
                    fontSize: 14,
                    color: !delMesVisible ? "text.disabled" : seleccionado ? "primary.contrastText" : "text.primary",
                    fontWeight: seleccionado || (esHoy && !seleccionado) ? 600 : 400,
                    bgcolor: seleccionado ? "primary.main" : "transparent",
                    "&:hover": {
                      bgcolor: seleccionado ? "primary.main" : deshabilitado ? "transparent" : "action.hover",
                    },
                  }}
                >
                  {celda.getUTCDate()}
                </ButtonBase>
              );
            })}
          </Box>

          <ButtonBase
            onClick={() => elegir(hoy)}
            disabled={hoyFueraDeRango}
            sx={{
              mt: 1,
              width: "100%",
              borderRadius: 2,
              py: 0.75,
              textAlign: "center",
              fontSize: 12,
              fontWeight: 500,
              color: "primary.main",
              "&:hover": { bgcolor: hoyFueraDeRango ? "transparent" : "action.hover" },
            }}
          >
            Hoy
          </ButtonBase>
        </Paper>
      )}
    </Box>
  );
}
