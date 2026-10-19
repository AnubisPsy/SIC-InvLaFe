import { MODULOS } from "@invlafe/core";
import {
  useActualizarProveedor,
  useCrearProveedor,
  useEliminarProveedor,
  useProveedores,
} from "@invlafe/query";
import { Truck } from "lucide-react";
import { EncabezadoPagina } from "../../../shared/ui";
import { PanelContactos } from "../componentes/PanelContactos";

export function Proveedores() {
  return (
    <>
      <EncabezadoPagina
        titulo="Proveedores"
        descripcion="Directorio de proveedores. Son los que aparecen al registrar un lote de compra o un pago."
      />

      <PanelContactos
        modulo={MODULOS.PROVEEDORES}
        singular="proveedor"
        plural="proveedores"
        icono={Truck}
        usarLista={useProveedores}
        usarCrear={useCrearProveedor}
        usarActualizar={useActualizarProveedor}
        usarEliminar={useEliminarProveedor}
      />
    </>
  );
}
