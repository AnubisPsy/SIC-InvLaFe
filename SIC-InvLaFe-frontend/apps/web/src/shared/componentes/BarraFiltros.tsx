import { inicioDeMesISO, hoyISO, type FechaISO } from "@invlafe/core";
import { Box } from "@mui/material";
import { RotateCcw, Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Boton, Entrada, Etiqueta, SelectorFecha } from "../ui";

export interface EstadoFiltros {
  busqueda: string;
  desde: FechaISO;
  hasta: FechaISO;
}

/**
 * Estado de filtros compartido por los listados.
 *
 * Arranca en el mes corriente en lugar de "todo": los listados de un negocio en
 * marcha crecen sin parar y abrir la pantalla con miles de filas no ayuda a
 * nadie.
 */
export function useFiltros(inicial?: Partial<EstadoFiltros>) {
  const porDefecto: EstadoFiltros = {
    busqueda: "",
    desde: inicioDeMesISO(),
    hasta: hoyISO(),
    ...inicial,
  };

  const [filtros, setFiltros] = useState<EstadoFiltros>(porDefecto);

  return {
    filtros,
    cambiar: <C extends keyof EstadoFiltros>(campo: C, valor: EstadoFiltros[C]) =>
      setFiltros((actual) => ({ ...actual, [campo]: valor })),
    reiniciar: () => setFiltros(porDefecto),
  };
}

export function BarraFiltros({
  filtros,
  alCambiar,
  alReiniciar,
  marcadorBusqueda = "Buscar…",
  children,
}: {
  filtros: EstadoFiltros;
  alCambiar: <C extends keyof EstadoFiltros>(
    campo: C,
    valor: EstadoFiltros[C],
  ) => void;
  alReiniciar: () => void;
  marcadorBusqueda?: string;
  /** Selectores propios del módulo (proveedor, cliente, estado…). */
  children?: ReactNode;
}) {
  return (
    <Box sx={{ mb: 2.5, borderRadius: 4, border: 1, borderColor: "divider", bgcolor: "background.paper", p: 2 }}>
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            lg: "repeat(4, 1fr)",
            xl: "repeat(5, 1fr)",
          },
        }}
      >
        <Box sx={{ gridColumn: { sm: "span 2" } }}>
          <Etiqueta>Buscar</Etiqueta>
          <Box sx={{ position: "relative" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                opacity: 0.5,
              }}
              aria-hidden
            />
            <Entrada
              type="search"
              value={filtros.busqueda}
              placeholder={marcadorBusqueda}
              sx={{ pl: 5 }}
              onChange={(evento) => alCambiar("busqueda", evento.target.value)}
            />
          </Box>
        </Box>

        <Box>
          <Etiqueta htmlFor="filtro-desde">Desde</Etiqueta>
          <SelectorFecha
            id="filtro-desde"
            value={filtros.desde}
            max={filtros.hasta}
            onChange={(fecha) => alCambiar("desde", fecha)}
          />
        </Box>

        <Box>
          <Etiqueta htmlFor="filtro-hasta">Hasta</Etiqueta>
          <SelectorFecha
            id="filtro-hasta"
            value={filtros.hasta}
            min={filtros.desde}
            onChange={(fecha) => alCambiar("hasta", fecha)}
          />
        </Box>

        {children}

        <Box sx={{ display: "flex", alignItems: "flex-end" }}>
          <Boton
            variante="contorno"
            anchoCompleto
            onClick={alReiniciar}
            iconoInicio={<RotateCcw size={16} aria-hidden />}
          >
            Limpiar
          </Boton>
        </Box>
      </Box>
    </Box>
  );
}
