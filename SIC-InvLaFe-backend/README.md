# SIC-InvLaFe · Backend

API de Inversiones La Fe. Es la única pieza que habla con la base de datos
PostgreSQL: el frontend le pide todo a ella.

- **Inicio de sesión propio.** Correo o nombre de usuario, contraseña cifrada con
  bcrypt en `usuarios.contrasena_hash` y un token JWT firmado por el backend.
- **Todas las rutas exigen sesión**, salvo `/api/salud` y el propio inicio de
  sesión. Administrar usuarios, roles y permisos exige además el permiso de
  «Usuarios y roles».
- **Operaciones de varias filas en transacción** (una compra con sus líneas, una
  cotización con sus productos). Los descuentos de existencia y de saldo usan
  bloqueo optimista: solo se aplican si el valor sigue siendo el que se leyó.

---

## Desarrollo

```bash
npm install
cp .env.example .env      # y rellena los valores
npm run dev               # http://localhost:3000
```

Comprueba que responde y que llega a la base:

```bash
curl http://localhost:3000/api/salud
# {"estado":"ok","servicio":"sic-invlafe-backend","baseDatos":"ok"}
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor con recarga automática (tsx watch). No recarga el `.env`: si lo cambias, reinicia |
| `npm run build` | Compila TypeScript a `dist/` |
| `npm start` | Ejecuta lo compilado |
| `npm run typecheck` | Solo comprueba tipos |

Requiere Node 20.6 o superior.

---

## Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | sí | `postgres://usuario:contraseña@servidor:5432/base`. Los símbolos de la contraseña van codificados (`@` es `%40`) |
| `JWT_SECRETO` | sí | Al menos 32 caracteres aleatorios. Cambiarla cierra todas las sesiones |
| `JWT_DURACION` | no | Duración del token, `8h` por defecto |
| `CORS_ORIGENES` | no | Orígenes extra separados por comas. En desarrollo, el de Vite: `http://localhost:5173`. Las peticiones del mismo origen se aceptan siempre |
| `PORT` | no | Puerto de escucha, 3000 por defecto |
| `NODE_ENV` | no | `production` en el servidor |

El servidor valida la configuración al arrancar y no levanta si falta algo.

---

## Base de datos

La carpeta `db/` tiene lo necesario para crear una base nueva:

| Archivo | Qué contiene |
|---|---|
| `db/esquema.sql` | Las 14 tablas, sin datos |
| `db/datos-iniciales.sql` | Los 10 módulos y el rol Administrador con todos los permisos. Se puede repetir sin duplicar nada |

Con PostgreSQL en Docker (`~/postgres` en el servidor), desde esta carpeta:

```bash
docker exec -i postgres-db-1 psql -U sic -d sic_invlafe < db/esquema.sql
docker exec -i postgres-db-1 psql -U sic -d sic_invlafe < db/datos-iniciales.sql
```

(`docker ps` muestra el nombre real del contenedor de PostgreSQL.)

### El primer administrador, o recuperar su acceso

No hay recuperación por correo. Para crear el primer usuario, o para darle una
contraseña nueva al administrador si la olvida:

```bash
# Con Docker, desde la raíz del repositorio:
docker compose exec backend node dist/herramientas/crear-admin.js \
  --correo admin@ejemplo.com --nombre "Nombre Apellido" --usuario admin

# En desarrollo:
npx tsx src/herramientas/crear-admin.ts --correo admin@ejemplo.com
```

Imprime una contraseña temporal y marca la cuenta para que pida cambiarla en el
primer acceso. Si el correo ya existe, solo restablece la contraseña y le
devuelve el rol Administrador.

Los demás usuarios se crean y se restablecen desde la pantalla «Usuarios y
roles».

---

## Endpoints

Todos bajo `/api`. Salvo los dos primeros, exigen la cabecera
`Authorization: Bearer <token>`.

### Acceso

| Método | Ruta | Notas |
|---|---|---|
| `GET` | `/salud` | Sin sesión. Comprueba también la base |
| `POST` | `/acceso/iniciar-sesion` | Sin sesión. `{ identificador, contrasena }` → `{ sesion: { token, expiraEn, usuarioId, correo } }` |
| `GET` | `/acceso/sesion` | El usuario de la sesión actual |
| `POST` | `/acceso/cambiar-contrasena` | `{ contrasena }`. Cambia la propia y levanta el cambio obligatorio |

El inicio de sesión responde el mismo `401` si el usuario no existe o si la
contraseña es incorrecta, y está limitado a 10 intentos cada 5 minutos por IP.

### Usuarios, roles y módulos

Exigen el permiso correspondiente sobre «Usuarios y roles».

| Método | Ruta |
|---|---|
| `GET` `POST` | `/usuarios` |
| `GET` `PATCH` `DELETE` | `/usuarios/:id` |
| `GET` `POST` | `/roles` |
| `GET` `PATCH` `DELETE` | `/roles/:id` |
| `GET` | `/roles/:id/usuarios/cantidad` |
| `PUT` | `/roles/:id/permisos` |
| `GET` | `/modulos` (solo sesión) |

### Catálogos

`/clientes`, `/proveedores` y `/productos`, cada uno con `GET` y `POST` en la
raíz y `GET`, `PATCH` y `DELETE` en `/:id`.

### Compras

| Método | Ruta |
|---|---|
| `GET` `POST` | `/compras` (filtros: `desde`, `hasta`, `proveedorId`, `limite`) |
| `GET` `DELETE` | `/compras/:id` |
| `GET` | `/compras/:id/pagos` |
| `GET` | `/lotes` (filtros: `desde`, `hasta`, `proveedorId`, `productoId`, `productoIds`, `soloDisponibles`, `limite`) |
| `GET` | `/lotes/:id` |
| `POST` | `/lotes/:id/descontar` · `/lotes/:id/devolver` |
| `POST` | `/pagos-proveedor` · `/pagos-proveedor/consulta-rango` |
| `DELETE` | `/pagos-proveedor/:id` |

### Ventas

| Método | Ruta |
|---|---|
| `GET` `POST` | `/ventas` (filtros: `desde`, `hasta`, `clienteId`, `loteCompraId`, `soloConSaldo`, `limite`) |
| `POST` | `/ventas/por-lotes` |
| `GET` `DELETE` | `/ventas/:id` |
| `POST` | `/ventas/:id/descontar-saldo` · `/ventas/:id/restituir-saldo` |
| `GET` | `/ventas/:id/pagos` |
| `POST` | `/pagos-cliente` · `/pagos-cliente/consulta-rango` |
| `DELETE` | `/pagos-cliente/:id` |

### Cotizaciones

| Método | Ruta |
|---|---|
| `GET` `POST` | `/cotizaciones` (filtros: `desde`, `hasta`, `clienteId`) |
| `GET` `PUT` `DELETE` | `/cotizaciones/:id` |
| `PATCH` | `/cotizaciones/:id/estado` · `/cotizaciones/:id/venta` |
| `PATCH` | `/cotizaciones/lineas/:lineaId/venta` |

Las lecturas devuelven las filas en snake_case y con sus relaciones anidadas
(por ejemplo, una venta trae su cliente y su lote). El frontend las convierte a
sus entidades.

### Errores

Todas las respuestas de error tienen la misma forma:

```json
{ "error": { "codigo": "VALIDACION", "mensaje": "Revisa los datos.", "campos": { "correo": "..." } } }
```

| Código HTTP | `codigo` | Cuándo |
|---|---|---|
| 400 | `VALIDACION` | Datos incompletos o con formato incorrecto |
| 401 | `AUTENTICACION` | Sin token, token vencido o credenciales incorrectas |
| 403 | `PERMISO_DENEGADO` | El rol no tiene el permiso, o el origen no está en CORS |
| 404 | `NO_ENCONTRADO` | El registro no existe |
| 409 | `CONFLICTO` | Choca con otro registro (duplicado, o tiene registros que dependen de él) |
| 429 | `CONFLICTO` | Límite de inicios de sesión (trae la cabecera `Retry-After`) |
| 502 | `INFRAESTRUCTURA` | La base de datos falló o no respondió |

---

## Docker

`Dockerfile` construye una imagen en dos etapas: compila con todas las
dependencias y deja en la imagen final solo lo compilado y las dependencias de
producción. Corre sin privilegios (`USER node`) y Docker comprueba su salud con
`/api/salud`.

No se levanta solo: lo hace el `compose.yaml` de la raíz del repositorio, junto
con el frontend. Las instrucciones están en el README de la raíz.
