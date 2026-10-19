import { MODULOS } from "@invlafe/core";
import { PantallaCompras } from "../../compras/componentes/PantallaCompras";

export function PagosProveedor() {
  return (
    <PantallaCompras
      modulo={MODULOS.PAGO_PROVEEDOR}
      titulo="Pago a proveedor"
      descripcion="Cada factura del proveedor puede traer varios productos. El saldo se calcula restando los abonos al valor facturado."
    />
  );
}
