import { CssBaseline, ThemeProvider } from "@mui/material";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { construirTema } from "../config/tema";

type Tema = "claro" | "oscuro";

const CLAVE_ALMACENAMIENTO = "invlafe:tema";

interface ValorTema {
  tema: Tema;
  alternar: () => void;
}

const ContextoTema = createContext<ValorTema | null>(null);

/**
 * Tema claro/oscuro persistido en `localStorage`, y fuente del `ThemeProvider`
 * de MUI para toda la app.
 *
 * El estado inicial se calcula de forma perezosa dentro de `useState` y no en
 * un efecto: leerlo después provocaría un parpadeo del tema claro en cada
 * recarga para quien tiene el oscuro activado.
 */
export function ProveedorTema({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(() => {
    const guardado = localStorage.getItem(CLAVE_ALMACENAMIENTO);
    if (guardado === "claro" || guardado === "oscuro") return guardado;

    return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "oscuro"
      : "claro";
  });

  useEffect(() => {
    localStorage.setItem(CLAVE_ALMACENAMIENTO, tema);
  }, [tema]);

  const alternar = useCallback(() => {
    setTema((actual) => (actual === "claro" ? "oscuro" : "claro"));
  }, []);

  const temaMUI = useMemo(
    () => construirTema(tema === "oscuro" ? "dark" : "light"),
    [tema],
  );

  return (
    <ContextoTema value={{ tema, alternar }}>
      <ThemeProvider theme={temaMUI}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ContextoTema>
  );
}

export function useTema(): ValorTema {
  const valor = useContext(ContextoTema);
  if (!valor) throw new Error("useTema debe usarse dentro de <ProveedorTema>.");
  return valor;
}
