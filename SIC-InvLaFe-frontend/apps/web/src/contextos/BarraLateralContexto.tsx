import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface ValorBarraLateral {
  /** Expandida en escritorio (con texto) frente a colapsada (solo iconos). */
  expandida: boolean;
  /** Abierta como panel deslizante en móvil. */
  abiertaMovil: boolean;
  sobrevolada: boolean;
  alternar: () => void;
  alternarMovil: () => void;
  cerrarMovil: () => void;
  setSobrevolada: (valor: boolean) => void;
}

const ContextoBarraLateral = createContext<ValorBarraLateral | null>(null);

const ESCRITORIO = 1024;

export function ProveedorBarraLateral({ children }: { children: ReactNode }) {
  const [expandida, setExpandida] = useState(true);
  const [abiertaMovil, setAbiertaMovil] = useState(false);
  const [sobrevolada, setSobrevolada] = useState(false);
  const [esEscritorio, setEsEscritorio] = useState(
    () => globalThis.innerWidth >= ESCRITORIO,
  );

  useEffect(() => {
    const consulta = globalThis.matchMedia(`(min-width: ${ESCRITORIO}px)`);

    const alCambiar = (evento: MediaQueryListEvent | MediaQueryList) => {
      setEsEscritorio(evento.matches);
      // Al pasar a escritorio se cierra el panel móvil: si no, quedaría un
      // backdrop invisible bloqueando los clics.
      if (evento.matches) setAbiertaMovil(false);
    };

    alCambiar(consulta);
    consulta.addEventListener("change", alCambiar);
    return () => consulta.removeEventListener("change", alCambiar);
  }, []);

  const alternar = useCallback(() => setExpandida((valor) => !valor), []);
  const alternarMovil = useCallback(() => setAbiertaMovil((valor) => !valor), []);
  const cerrarMovil = useCallback(() => setAbiertaMovil(false), []);

  return (
    <ContextoBarraLateral
      value={{
        // En móvil el ancho lo decide `abiertaMovil`, así que `expandida` se
        // reporta siempre `false` para que el layout no reserve el margen.
        expandida: esEscritorio ? expandida : false,
        abiertaMovil,
        sobrevolada,
        alternar,
        alternarMovil,
        cerrarMovil,
        setSobrevolada,
      }}
    >
      {children}
    </ContextoBarraLateral>
  );
}

export function useBarraLateral(): ValorBarraLateral {
  const valor = useContext(ContextoBarraLateral);
  if (!valor) {
    throw new Error(
      "useBarraLateral debe usarse dentro de <ProveedorBarraLateral>.",
    );
  }
  return valor;
}
