import { MODULOS } from "@invlafe/core";
import {
  useActualizarCliente,
  useClientes,
  useCrearCliente,
  useEliminarCliente,
} from "@invlafe/query";
import { Users } from "lucide-react";
import { EncabezadoPagina } from "../../../shared/ui";
import { PanelContactos } from "../componentes/PanelContactos";

export function Clientes() {
  return (
    <>
      <EncabezadoPagina
        titulo="Clientes"
        descripcion="Directorio de clientes. Son los que aparecen al registrar una venta, un cobro o una cotización."
      />

      <PanelContactos
        modulo={MODULOS.CLIENTES}
        singular="cliente"
        plural="clientes"
        icono={Users}
        usarLista={useClientes}
        usarCrear={useCrearCliente}
        usarActualizar={useActualizarCliente}
        usarEliminar={useEliminarCliente}
      />
    </>
  );
}
