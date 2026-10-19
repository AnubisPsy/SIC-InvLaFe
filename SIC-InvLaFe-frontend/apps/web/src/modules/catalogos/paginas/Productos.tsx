import { EncabezadoPagina } from "../../../shared/ui";
import { PanelProductos } from "../componentes/PanelProductos";

export function Productos() {
  return (
    <>
      <EncabezadoPagina
        titulo="Productos"
        descripcion="Catálogo de productos. Son los que aparecen al registrar una compra, una venta o una cotización."
      />

      <PanelProductos />
    </>
  );
}
