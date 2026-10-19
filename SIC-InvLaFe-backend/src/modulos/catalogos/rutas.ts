import { Router } from "express";
import { parametroDeRuta } from "../../compartido/http.js";
import { exigirAutenticacion } from "../../middleware/autenticacion.js";
import {
  CLIENTES,
  PRODUCTOS,
  PROVEEDORES,
  actualizar,
  crear,
  eliminar,
  listar,
  obtener,
  validarDatos,
  type DefinicionCatalogo,
} from "./servicio.js";

/**
 * Crea las 5 rutas de un catálogo. Todas exigen sesión, nada más: qué
 * pantallas ve cada usuario lo decide el frontend según su rol.
 *
 * - GET    /       → { registros: [...] }
 * - GET    /:id    → { registro: {...} | null }
 * - POST   /       → { registro: {...} }
 * - PATCH  /:id    → { registro: {...} }
 * - DELETE /:id    → 204 sin cuerpo
 */
function rutasDeCatalogo(def: DefinicionCatalogo): Router {
  const rutas = Router();
  rutas.use(exigirAutenticacion);

  rutas.get("/", async (_req, res) => {
    res.status(200).json({ registros: await listar(def) });
  });

  rutas.get("/:id", async (req, res) => {
    res.status(200).json({ registro: await obtener(def, parametroDeRuta(req, "id")) });
  });

  rutas.post("/", async (req, res) => {
    res.status(201).json({ registro: await crear(def, validarDatos(def, req.body)) });
  });

  rutas.patch("/:id", async (req, res) => {
    const registro = await actualizar(def, parametroDeRuta(req, "id"), validarDatos(def, req.body));
    res.status(200).json({ registro });
  });

  rutas.delete("/:id", async (req, res) => {
    await eliminar(def, parametroDeRuta(req, "id"));
    res.status(204).end();
  });

  return rutas;
}

export const rutasClientes = rutasDeCatalogo(CLIENTES);
export const rutasProveedores = rutasDeCatalogo(PROVEEDORES);
export const rutasProductos = rutasDeCatalogo(PRODUCTOS);
