import { MODULOS, mensajeDeError, type Producto } from "@invlafe/core";
import {
  useCrearProducto,
  useActualizarProducto,
  useEliminarProducto,
  useProductos,
} from "@invlafe/query";
import { Box, Stack, Typography } from "@mui/material";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Alerta,
  Boton,
  Cabecera,
  Celda,
  Cuerpo,
  Entrada,
  EstadoConsulta,
  EstadoVacio,
  Fila,
  Modal,
  Tabla,
  useModal,
  usePuede,
} from "../../../shared/ui";
import { ModalProducto } from "./ModalProducto";

/** Catálogo de productos: mismo patrón que Clientes/Proveedores, pero solo con nombre. */
export function PanelProductos() {
  const [enEdicion, setEnEdicion] = useState<Producto | null>(null);
  const [aEliminar, setAEliminar] = useState<Producto | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const permisos = usePuede(MODULOS.PRODUCTOS);
  const modalProducto = useModal();

  const consulta = useProductos();
  const crear = useCrearProducto();
  const actualizar = useActualizarProducto();
  const eliminar = useEliminarProducto();

  const visibles = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    const lista = consulta.data ?? [];
    if (!termino) return lista;
    return lista.filter((producto) => producto.nombre.toLowerCase().includes(termino));
  }, [consulta.data, busqueda]);

  function abrirNuevo() {
    setEnEdicion(null);
    modalProducto.abrir();
  }

  return (
    <>
      <Stack
        direction="row"
        sx={{ mb: 2, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}
      >
        <Box sx={{ width: { xs: "100%", sm: "auto" }, maxWidth: { sm: 320 } }}>
          <Entrada
            type="search"
            value={busqueda}
            placeholder="Buscar productos…"
            aria-label="Buscar productos"
            onChange={(evento) => setBusqueda(evento.target.value)}
          />
        </Box>

        {permisos.crear && (
          <Boton onClick={abrirNuevo} iconoInicio={<Plus size={16} aria-hidden />}>
            Nuevo producto
          </Boton>
        )}
      </Stack>

      {eliminar.error && (
        <Alerta tipo="error" sx={{ mb: 2 }} titulo="No se pudo eliminar">
          {mensajeDeError(eliminar.error)}
        </Alerta>
      )}

      <Tabla>
        <Cabecera>
          <Fila>
            <Celda cabecera>Nombre</Celda>
            <Celda cabecera alineacion="derecha">Acciones</Celda>
          </Fila>
        </Cabecera>
        <Cuerpo>
          <EstadoConsulta
            enTabla
            cargando={consulta.isPending}
            error={consulta.error}
            datos={visibles}
            vacio={
              <Fila>
                <Celda colSpan={2}>
                  <EstadoVacio
                    icono={<Package size={24} aria-hidden />}
                    titulo={
                      busqueda.trim()
                        ? "Ningún producto coincide con la búsqueda"
                        : "Todavía no hay productos"
                    }
                    descripcion={
                      busqueda.trim()
                        ? "Prueba con otro nombre."
                        : "Da de alta el primero para poder seleccionarlo al registrar compras, ventas o cotizaciones."
                    }
                    accion={
                      permisos.crear &&
                      !busqueda.trim() && (
                        <Boton onClick={abrirNuevo} iconoInicio={<Plus size={16} aria-hidden />}>
                          Nuevo producto
                        </Boton>
                      )
                    }
                  />
                </Celda>
              </Fila>
            }
          >
            {(items) =>
              items.map((producto) => (
                <Fila key={producto.id}>
                  <Celda>
                    <Typography sx={{ fontSize: "inherit", fontWeight: 500, color: "text.primary" }}>
                      {producto.nombre}
                    </Typography>
                  </Celda>
                  <Celda alineacion="derecha">
                    <Stack direction="row" sx={{ justifyContent: "flex-end", gap: 0.5 }}>
                      {permisos.editar && (
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          aria-label={`Editar ${producto.nombre}`}
                          onClick={() => {
                            setEnEdicion(producto);
                            modalProducto.abrir();
                          }}
                          iconoInicio={<Pencil size={16} aria-hidden />}
                        />
                      )}
                      {permisos.eliminar && (
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          aria-label={`Eliminar ${producto.nombre}`}
                          onClick={() => setAEliminar(producto)}
                          iconoInicio={
                            <Box component="span" sx={{ display: "flex", color: "error.500" }}>
                              <Trash2 size={16} color="currentColor" aria-hidden />
                            </Box>
                          }
                        />
                      )}
                    </Stack>
                  </Celda>
                </Fila>
              ))
            }
          </EstadoConsulta>
        </Cuerpo>
      </Tabla>

      <ModalProducto
        abierto={modalProducto.abierto}
        producto={enEdicion}
        crear={crear}
        actualizar={actualizar}
        alCerrar={() => {
          modalProducto.cerrar();
          setEnEdicion(null);
        }}
      />

      <Modal
        abierto={Boolean(aEliminar)}
        alCerrar={() => setAEliminar(null)}
        titulo="Eliminar producto"
        ancho="sm"
        acciones={
          <>
            <Boton variante="contorno" onClick={() => setAEliminar(null)}>
              Cancelar
            </Boton>
            <Boton
              variante="peligro"
              cargando={eliminar.isPending}
              onClick={() => {
                if (!aEliminar) return;
                eliminar.mutate(aEliminar.id, {
                  onSuccess: () => setAEliminar(null),
                });
              }}
            >
              Eliminar
            </Boton>
          </>
        }
      >
        <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
          Se eliminará <strong>{aEliminar?.nombre}</strong> del catálogo. Los
          movimientos ya registrados con este producto no se borran, pero la
          base puede rechazar el borrado si todavía hay algún lote o venta que
          lo referencia.
        </Typography>
      </Modal>
    </>
  );
}
