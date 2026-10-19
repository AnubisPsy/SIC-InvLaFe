# SIC — Inversiones La Fe

Sistema de inventario y control de combustible: compras por lote, despacho a
clientes, cobros, cuadre de galones y administración de usuarios.

| Carpeta | Qué es | README |
|---|---|---|
| [`SIC-InvLaFe-frontend/`](SIC-InvLaFe-frontend) | Monorepo de npm (core, query, app web) con la lógica de negocio y la interfaz | [frontend/README.md](SIC-InvLaFe-frontend/README.md) |
| [`SIC-InvLaFe-backend/`](SIC-InvLaFe-backend) | API con el inicio de sesión y todo el acceso a PostgreSQL | [backend/README.md](SIC-InvLaFe-backend/README.md) |

```
Navegador ──► nginx (frontend) ──► /api ──► backend (Node) ──► PostgreSQL
```

El navegador nunca habla con la base: le pide todo al backend, que exige una
sesión válida en cada petición.

---

## Desarrollo

```bash
# Backend
cd SIC-InvLaFe-backend
npm install
cp .env.example .env          # DATABASE_URL, JWT_SECRETO, CORS_ORIGENES
npm run dev                   # http://localhost:3000

# Frontend, en otra terminal
cd SIC-InvLaFe-frontend
npm install
cp apps/web/.env.example apps/web/.env   # VITE_API_URL=http://localhost:3000
npm run dev                              # http://localhost:5173
```

---

## Servidor (Docker)

`compose.yaml` levanta dos contenedores:

| Servicio | Qué hace | Memoria máxima |
|---|---|---|
| `web` | nginx: sirve la app ya compilada y reenvía `/api` al backend | 64 MB |
| `backend` | La API en Node | 256 MB |

La base de datos **no** está en este compose: vive en el suyo propio
(`~/postgres`), para que reconstruir o apagar la app nunca toque los datos. El
backend la alcanza por el puerto 5432 del servidor.

### Primera vez

Requisitos: Docker y PostgreSQL ya corriendo en `~/postgres`.

```bash
cd ~/dev/SIC-InvLaFe
git pull

cp .env.example .env
nano .env            # DATABASE_URL y JWT_SECRETO (instrucciones dentro)
chmod 600 .env       # solo tu usuario puede leerlo

docker compose up -d --build
```

Comprueba:

```bash
docker compose ps                          # los dos en "Up"
curl http://localhost:8081/api/salud       # "baseDatos":"ok"
```

La app queda en `http://192.168.1.201:8081`.

Si la base es nueva (otra instalación, otro servidor), créala antes con los
archivos de `SIC-InvLaFe-backend/db/` y crea el primer administrador. Los pasos
están en el README del backend.

### Actualizar a una versión nueva

```bash
cd ~/dev/SIC-InvLaFe
git pull
docker compose up -d --build
```

Docker reconstruye solo lo que cambió. Los usuarios conectados tendrán que
recargar la página.

### Comandos del día a día

| Comando | Qué hace |
|---|---|
| `docker compose ps` | Estado de los contenedores |
| `docker compose logs -f backend` | Ver lo que hace el backend (Ctrl+C para salir) |
| `docker compose restart backend` | Reiniciar el backend |
| `docker compose up -d` | Aplicar cambios del `.env` (`restart` no los lee) |
| `docker compose down` | Apagar la app. Los datos siguen en PostgreSQL |
| `docker compose exec backend node dist/herramientas/crear-admin.js --correo ...` | Crear o recuperar el administrador |
| `docker image prune` | Borrar imágenes viejas que quedan tras actualizar |
