import { MODULOS, PRODUCTOS, claveDeProducto } from "@invlafe/core";
import { useProductos } from "@invlafe/query";
import { Box } from "@mui/material";
import { Alerta, Cargador } from "../../../shared/ui";
import { PantallaCompras } from "../../compras/componentes/PantallaCompras";

/**
 * Mismo flujo que "Pago a proveedor", restringido al producto aceite.
 *
 * El id del producto se resuelve del catálogo en tiempo de ejecución porque no
 * es estable entre entornos; si no existe la fila, se avisa en lugar de dejar
 * la pantalla vacía sin explicación.
 */
export function ControlAceite() {
  const productos = useProductos();

  const aceite = (productos.data ?? []).find(
    (producto) => claveDeProducto(producto) === PRODUCTOS.ACEITE,
  );

  if (productos.isPending) return <Cargador etiqueta="Cargando el catálogo…" />;

  if (!aceite) {
    return (
      <Box sx={{ mx: "auto", maxWidth: 576, py: 5 }}>
        <Alerta tipo="advertencia" titulo="Falta el producto aceite">
          No hay ninguna fila en <code>productos</code> cuyo nombre corresponda a
          «aceite» o «lubricante». Créala en la base para poder usar este módulo.
        </Alerta>
      </Box>
    );
  }

  return (
    <PantallaCompras
      modulo={MODULOS.CONTROL_ACEITE}
      titulo="Control de aceite"
      descripcion="Compras, saldos y abonos de las facturas que traen aceite (incluye lubricante)."
      soloProducto="aceite"
      productoFijo={aceite.id}
      nombreProducto={aceite.nombre}
    />
  );
}
