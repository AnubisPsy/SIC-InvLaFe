import { Box, Typography } from "@mui/material";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Estado {
  error: Error | null;
}

/**
 * Límite de error de la aplicación.
 *
 * Existe sobre todo por el arranque: si faltan las variables de entorno, el
 * contenedor de Supabase lanza durante el primer render y sin esto el usuario
 * solo vería una página en blanco. Aquí al menos lee qué configurar.
 */
export class LimiteError extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { error: null };

  static getDerivedStateFromError(error: Error): Estado {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Error no controlado en la aplicación:", error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const esConfiguracion = error.message.includes("variable de entorno");

    /*
      Sin `sx` con tokens de tema: este límite de error puede renderizar antes
      de que `ProveedorTema` llegue a montarse (está por debajo en el árbol,
      dentro de `Proveedores`), así que los colores van fijos, tal como en el
      original sin variante oscura.
    */
    return (
      <Box
        sx={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "#f9fafb",
          p: 3,
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 512,
            borderRadius: 4,
            border: "1px solid #e4e7ec",
            bgcolor: "#ffffff",
            p: 3,
            boxShadow: "0px 20px 24px -4px rgba(16, 24, 40, 0.08), 0px 8px 8px -4px rgba(16, 24, 40, 0.03)",
          }}
        >
          <Typography variant="h1" sx={{ fontSize: 18, fontWeight: 600, color: "#1d2939" }}>
            {esConfiguracion
              ? "Falta configurar la conexión"
              : "Algo salió mal"}
          </Typography>

          <Typography sx={{ mt: 1, whiteSpace: "pre-wrap", fontSize: 14, color: "#475467" }}>
            {error.message}
          </Typography>

          {esConfiguracion && (
            <Box
              component="pre"
              sx={{
                mt: 2,
                overflowX: "auto",
                borderRadius: 2,
                bgcolor: "#f2f4f7",
                p: 2,
                fontSize: 12,
                color: "#344054",
              }}
            >
{`# apps/web/.env
VITE_SUPABASE_URL=https://tuproyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`}
            </Box>
          )}

          <Box
            component="button"
            type="button"
            onClick={() => globalThis.location.reload()}
            sx={{
              mt: 3,
              borderRadius: 2,
              border: 0,
              bgcolor: "#465fff",
              px: 2.5,
              py: 1.5,
              fontSize: 14,
              fontWeight: 500,
              color: "#ffffff",
              cursor: "pointer",
              transition: "background-color 0.2s",
              "&:hover": { bgcolor: "#3641f5" },
            }}
          >
            Recargar
          </Box>
        </Box>
      </Box>
    );
  }
}
