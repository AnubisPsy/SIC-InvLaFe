# SIC-InvLaFe · Backend

API administrativa de Inversiones La Fe. Cubre **solo** las operaciones que
exigen la `service_role` key de Supabase, que nunca puede vivir en el navegador:
crear, editar y eliminar usuarios junto con su cuenta de acceso.

Todo lo demás —proveedores, lotes, ventas, cobros, cotizaciones, y también
*leer* usuarios, roles y permisos— lo hace el frontend directamente contra
Supabase, protegido por RLS. Este backend no lo duplica.

---

## Puesta en marcha

```bash
npm install
cp .env.example .env      # y rellena los valores
npm run dev               # http://localhost:3000
```

Comprueba que responde:

```bash
curl http://localhost:3000/api/salud
# {"estado":"ok","servicio":"sic-invlafe-backend"}
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor con recarga automática (tsx watch) |
| `npm run build` | Compila TypeScript a `dist/` |
| `npm start` | Ejecuta lo compilado (producción) |
| `npm run typecheck` | Solo comprueba tipos |

Requiere Node 20.6 o superior.

---

## Variables de entorno

Van en `.env`, que está en `.gitignore`. `.env.example` lista los nombres sin
valores; cópialo y rellénalo.

| Variable | Obligatoria | Descripción |
|---|---|---|
| `SUPABASE_URL` | sí | Project Settings → Data API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | sí | Project Settings → API Keys → **Secret key** (`sb_secret_…`) |
| `SUPABASE_PUBLISHABLE_KEY` | sí | Project Settings → API Keys → **Publishable key** (`sb_publishable_…`). La misma del frontend; la usa el login por nombre de usuario |
| `CORS_ORIGENES` | sí | Orígenes del frontend separados por comas, p. ej. `http://localhost:5173` |
| `PORT` | no | Puerto de escucha (3000 por defecto) |
| `NODE_ENV` | no | `production` en el servidor; cualquier otra cosa se trata como desarrollo |

> **La secret key ignora RLS por completo.** Con ella se puede leer y escribir
> cualquier fila y administrar las cuentas de Auth. Solo vive en el `.env` de
> este backend. Si se filtra, revócala en el panel de Supabase.

El servidor valida la configuración al arrancar y se niega a levantar si falta
algo o si detecta que las dos claves están intercambiadas, en cualquiera de los
dos sentidos.

---

## Endpoints

Todos bajo `/api`. Las tres rutas de usuarios exigen cabecera
`Authorization: Bearer <access_token>` con el token de sesión de Supabase Auth.

| Método | Ruta | Permiso requerido |
|---|---|---|
| `GET` | `/api/salud` | ninguno |
| `POST` | `/api/acceso/iniciar-sesion` | ninguno (es donde se obtiene la sesión) |
| `POST` | `/api/acceso/cambiar-contrasena` | ninguno, pero exige sesión (acción sobre uno mismo) |
| `POST` | `/api/usuarios` | `crear` sobre «Usuarios y roles» |
| `PATCH` | `/api/usuarios/:id` | `editar` sobre «Usuarios y roles» |
| `DELETE` | `/api/usuarios/:id` | `eliminar` sobre «Usuarios y roles» |

### `POST /api/acceso/iniciar-sesion`

Inicia sesión aceptando **correo o nombre de usuario**.

```json
{ "identificador": "mperez", "contrasena": "unaClaveSegura" }
```

Responde `200` con `{ "sesion": { accessToken, refreshToken } }`, que el
navegador instala con `supabase.auth.setSession`.

Existe porque Supabase Auth solo admite correo o teléfono como identificador: el
nombre de usuario hay que traducirlo a correo antes de autenticar, y esa
consulta a `usuarios` se hace sin sesión, algo que RLS impide desde el
navegador. La traducción usa la secret key; la autenticación, la publishable,
de modo que la sesión emitida no tiene ningún privilegio extra.

El frontend **solo llama aquí cuando el identificador no lleva arroba**: entrar
con el correo sigue siendo una llamada directa del navegador a Supabase, y por
eso funciona aunque este backend esté caído.

Dos decisiones a tener presentes:

- Un identificador inexistente y una contraseña equivocada devuelven el **mismo**
  `401`, para que el endpoint no sirva como forma de averiguar qué nombres de
  usuario existen.
- Está limitado a **10 intentos cada 5 minutos por IP**. Hace falta porque las
  llamadas a Supabase ahora salen desde la IP de este servidor y no desde la de
  cada persona, así que el límite propio de GoTrue ya no distingue entre unos y
  otros. El contador vive en memoria: si algún día hay varias réplicas, hay que
  moverlo al proxy de entrada o a Redis.

### `POST /api/acceso/cambiar-contrasena`

Cambia la contraseña de quien llama y, si tenía un cambio obligatorio pendiente,
lo da por cumplido. Responde `204` sin cuerpo.

```json
{ "contrasena": "laNuevaClave" }
```

Exige sesión pero **ningún permiso de módulo**: es una acción sobre uno mismo, y
precisamente quien la necesita es quien todavía no puede usar el sistema.

Son dos escrituras —la contraseña vive en Auth y la marca en `usuarios`— y por
eso están aquí y no en el navegador: limpiar la marca desde el cliente exigiría
una política de RLS que dejara a cada persona modificar su propia fila, donde
también viven el rol y el estado activo.

El orden es contraseña primero, marca después. Si falla lo segundo, la
contraseña ya cambió y el sistema volverá a pedir el cambio en el siguiente
acceso: molesta, pero nunca deja a nadie con la contraseña del administrador y
la marca limpia.

### `POST /api/usuarios`

Crea la cuenta de acceso en Supabase Auth **y** la fila en `usuarios`.

```json
{
  "nombre": "María Pérez",
  "correo": "maria@ejemplo.com",
  "usuario": "mperez",
  "telefono": "809 555 1234",
  "rolId": "b2c4f333-629a-4eda-a493-c0928499e04a",
  "activo": true,
  "contrasena": "unaClaveSegura",
  "debeCambiarContrasena": true
}
```

Responde `201` con el usuario creado, incluidos `usuario` y
`debeCambiarContrasena`.

`usuario` es opcional y se guarda en minúsculas: es el nombre con el que podrá
iniciar sesión sin escribir el correo. Vive en `usuarios.usuario`, con índice
único sobre `lower(usuario)`. Quien no lo tenga entra con su correo igual que
siempre.

`debeCambiarContrasena` **vale `true` si no se envía**. Es el comportamiento
seguro: la contraseña del alta la elige el administrador, así que hasta que el
usuario la sustituya hay dos personas que la conocen. Se guarda en
`usuarios.debe_cambiar_contrasena`.

La cuenta queda con el correo confirmado: el usuario puede entrar de inmediato
con la contraseña que fijó el administrador, y cambiarla luego desde
«Recuperar contraseña».

### `PATCH /api/usuarios/:id`

Todos los campos son opcionales; se aplica solo lo que se envíe.

```json
{ "nombre": "María Pérez Gómez", "activo": false }
```

- `correo` se cambia en Auth y en la tabla a la vez.
- `usuario` acepta `null` o `""` para quitar el nombre de usuario; la cuenta
  queda accesible solo por correo.
- `contrasena` la fija el administrador sin que el usuario intervenga.
- `activo: false` desactiva la fila **y bloquea el acceso** en Auth; `true` lo
  restablece.
- `debeCambiarContrasena: true` vuelve a exigir el cambio en el siguiente
  acceso. Es lo que conviene marcar al fijarle una contraseña a alguien que la
  perdió.

### `DELETE /api/usuarios/:id`

Borra la fila y la cuenta de Auth. Responde `204` sin cuerpo.

### Errores

Siempre con la misma forma:

```json
{
  "error": {
    "codigo": "VALIDACION",
    "mensaje": "Revisa los datos del usuario.",
    "campos": { "correo": "Este correo ya está registrado en el sistema." }
  }
}
```

| Código | HTTP | Cuándo |
|---|---|---|
| `VALIDACION` | 400 | Datos mal formados. `campos` trae el error de cada input |
| `AUTENTICACION` | 401 | Falta el token, expiró, o la cuenta no tiene fila en `usuarios` |
| `PERMISO_DENEGADO` | 403 | El rol no incluye la acción, u origen no permitido por CORS |
| `NO_ENCONTRADO` | 404 | El usuario o la ruta no existen |
| `CONFLICTO` | 409 | Correo duplicado, o intento de eliminarse/desactivarse a uno mismo |
| `INFRAESTRUCTURA` | 500/502 | Fallo de Supabase o error no previsto |

---

## Cómo se protege

Cada petición a `/api/usuarios` pasa por dos filtros, en este orden:

1. **Autenticación** (`middleware/autenticacion.ts`) — valida el token contra
   Supabase Auth y resuelve la fila de `usuarios` enlazada por correo. Rechaza
   si no hay fila o si el usuario está inactivo.
2. **Autorización** (`middleware/autorizacion.ts`) — consulta `permisos_rol`
   para el rol del solicitante y comprueba la acción concreta sobre el módulo
   «Usuarios y roles».

La validación del token se delega en Supabase en vez de verificar la firma
localmente: cuesta una llamada de red por petición, pero un usuario bloqueado o
eliminado deja de pasar de inmediato aunque su token siga vigente.

**RLS no protege nada aquí.** La `service_role` key la ignora, así que estos dos
middleware son la única barrera. Cualquier ruta nueva que los omita se ejecutará
con privilegios totales.

La única ruta que los omite a propósito es `POST /api/acceso/iniciar-sesion`,
que no puede exigir un token porque es donde se consigue. A cambio, no expone
ninguna consulta libre: solo traduce un nombre de usuario a correo por dentro,
responde con un mensaje único ante cualquier fallo y está limitada por IP.

Además, nadie puede eliminarse ni desactivarse a sí mismo: evita que el único
administrador se deje fuera del sistema por accidente.

---

## Consistencia entre Auth y la tabla

No hay transacción posible entre Supabase Auth y Postgres, así que cada
operación se compensa si falla a medias:

| Operación | Orden | Si falla el segundo paso |
|---|---|---|
| Crear | Auth → tabla | Se borra la cuenta de Auth recién creada |
| Editar | Auth → tabla | Se restauran en Auth el correo y el estado anteriores |
| Eliminar | tabla → Auth | Se reinserta la fila con su id original |

El orden no es arbitrario. Al crear, una cuenta huérfana se borra fácil; una
fila sin cuenta deja al usuario sin poder entrar, que es justo el problema que
este backend viene a resolver. Al eliminar es al revés: la fila se puede
restaurar entera, pero una cuenta de Auth borrada se lleva su contraseña con
ella.

La contraseña es la única excepción: si la edición falla tras haberla cambiado,
no se restaura, porque Auth solo guarda su hash. El administrador puede volver a
fijarla.

Si una compensación falla también, queda registrado en el log del servidor con
las instrucciones para arreglarlo a mano.

---

## Enlace entre Auth y `usuarios`

El esquema no tiene clave foránea entre las dos, pero hay dos vínculos:

- **Por correo** — `auth.users.email` = `usuarios.correo`, sin distinguir
  mayúsculas. Es el que usa el frontend para componer la sesión.
- **Por id** — `usuarios.id` = `auth.users.id`. Es la convención con la que se
  creó la base, y este backend la mantiene: al dar de alta inserta la fila con
  el id de la cuenta recién creada.

El backend usa el id como vía rápida para localizar la cuenta y cae al correo si
no coincide, así que las filas creadas a mano antes de existir este servicio
siguen funcionando.

Para comprobar el enlace basta con cruzar `auth.users` y `usuarios` por correo:
las filas que aparezcan en la primera y no en la segunda son cuentas de acceso
sin usuario del sistema, y podrán entrar pero sin ningún permiso.

---

## Esquema

No queda ningún script pendiente: las migraciones están aplicadas y la base es
ya la que el código espera. La forma de las tablas —y por qué es esa— está en
[`docs/supabase.md`](../SIC-InvLaFe-frontend/docs/supabase.md) del frontend, que
es de donde salen casi todas las consultas.

Si alguna vez hay que levantar una base desde cero, ese documento es la
referencia; el esquema en sí se saca de Supabase con **Database → Schema
Visualizer** o con un `pg_dump --schema-only`.

---

## Estructura

```
src/
├─ index.ts                  arranque y cierre ordenado
├─ app.ts                    construcción de la app (CORS, JSON, rutas)
├─ config/entorno.ts         lectura y validación de las variables
├─ compartido/
│   ├─ errores.ts            jerarquía ErrorHttp → respuestas JSON uniformes
│   └─ validacion.ts         validación de payloads y normalización de texto
├─ infraestructura/supabase/
│   ├─ admin.ts              cliente con la service_role key
│   ├─ publico.ts            cliente con la publishable key (solo para el login)
│   ├─ errores.ts            PostgREST y Auth → ErrorHttp
│   └─ tablas.ts             nombres de tabla y forma cruda de las filas
├─ middleware/
│   ├─ autenticacion.ts      valida el token → req.solicitante
│   ├─ autorizacion.ts       exigirPermiso(modulo, accion)
│   ├─ limite-intentos.ts    tope de peticiones por IP para las rutas abiertas
│   └─ errores.ts            manejador central y 404
├─ modulos/
│   ├─ acceso/               login por usuario o correo, módulos y permisos_rol
│   └─ usuarios/             rutas · controlador · esquema · servicio
└─ tipos/express.d.ts        req.solicitante
```

Para añadir un módulo nuevo: una carpeta bajo `modulos/` con el mismo reparto
(rutas, controlador, esquema, servicio) y un `app.use()` en `app.ts`.

### Un aviso sobre `modulos/acceso/modulos.ts`

La tabla `modulos` guarda nombres libres, así que el cruce con las claves del
código se hace por nombre normalizado, con una lista de alias. Esa lista y la
función `normalizar` son **copia literal** de las del frontend
(`packages/core/src/modules/acceso/`). Si se añade un alias en un lado hay que
añadirlo en el otro: si divergen, el backend denegará acciones que la interfaz
sí ofrece.

---

## Despliegue

```bash
npm ci
npm run build
npm start
```

Antes de exponerlo:

- `NODE_ENV=production` — deja de incluir detalles de error en las respuestas.
- `CORS_ORIGENES` con el dominio real del frontend, sin barra final.
- Servirlo por HTTPS: por la cabecera `Authorization` viajan tokens de sesión.
- `SUPABASE_SERVICE_ROLE_KEY` como secreto del proveedor de hosting, nunca en el
  repositorio ni en la imagen.

`GET /api/salud` sirve como health check.
