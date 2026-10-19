# Configuración de Supabase

Lo que el frontend necesita de la base de datos para funcionar. La aplicación
compila y arranca sin nada de esto, pero no mostrará datos hasta completarlo.

> Describe el esquema **tal como está hoy**. Las migraciones que lo trajeron
> hasta aquí ya se aplicaron y sus scripts se borraron; lo que sigue vivo es la
> forma de las tablas, explicada en la [sección 8](#8-forma-del-esquema).

---

## 1. Credenciales (obligatorio)

Copia `apps/web/.env.example` a `apps/web/.env` y rellena:

```dotenv
VITE_SUPABASE_URL=https://tuproyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx
VITE_API_URL=http://localhost:3000
```

Los dos primeros están en **Project Settings → Data API** y **Project Settings →
API Keys**. La *publishable key* está diseñada para vivir en el navegador; quien
protege los datos es RLS. **Nunca** pongas aquí la `service_role` / secret key:
esa vive solo en el `.env` del backend.

`VITE_API_URL` es la URL del backend administrativo (`SIC-InvLaFe-backend`), que
es quien tiene la secret key y crea las cuentas de acceso.

---

## 2. Tabla `modulos` (obligatorio para los permisos)

El frontend protege nueve módulos. Para poder concederlos, cada uno necesita una
fila en `modulos`. Sin la fila, nadie puede acceder al módulo y la pantalla de
Usuarios y roles lo avisa en un recuadro amarillo.

El nombre se casa **normalizado** (sin acentos, minúsculas, separadores a `_`),
así que `"Pago a Proveedor"` y `"pagos_proveedor"` valen igual.

```sql
insert into public.modulos (nombre) values
  ('Pago a proveedor'),
  ('Control de carga'),
  ('Cobro a clientes'),
  ('Cuadre de galones'),
  ('Control de aceite'),
  ('Cotizaciones'),
  ('Clientes'),
  ('Proveedores'),
  ('Usuarios y roles')
on conflict do nothing;
```

> Crear la fila no basta: hay que **concederle el módulo a algún rol**, o nadie
> —ni el administrador— verá la pantalla. Si acabas de añadir uno y no aparece
> por ningún lado, es casi siempre esto.

Si tus filas ya existen con otros nombres, no las renombres: añade el nombre real
a la lista de alias en
[`packages/core/src/modules/acceso/domain/modulos.ts`](../packages/core/src/modules/acceso/domain/modulos.ts).

Los alias ya aceptados por módulo:

| Módulo | Alias reconocidos |
|---|---|
| Pago a proveedor | `pago_proveedor`, `pagos_proveedor`, `pago_a_proveedor`, `pagos_a_proveedores`, `pago_proveedores`, `compras` |
| Control de carga | `control_carga`, `control_de_carga`, `carga`, `ventas`, `despacho` |
| Cobro a clientes | `cobro_clientes`, `cobro_a_clientes`, `cobros_clientes`, `cobros`, `cuentas_por_cobrar` |
| Cuadre de galones | `cuadre_galones`, `cuadre_de_galones`, `cuadre_de_galones_cargados`, `cuadre`, `inventario` |
| Control de aceite | `control_aceite`, `control_de_aceite`, `aceite`, `lubricantes` |
| Cotizaciones | `cotizaciones`, `cotizacion`, `presupuestos` |
| Clientes | `clientes`, `catalogo_clientes`, `directorio_clientes`, `maestro_clientes` |
| Proveedores | `proveedores`, `catalogo_proveedores`, `directorio_proveedores`, `maestro_proveedores` |
| Usuarios y roles | `usuarios_roles`, `usuarios_y_roles`, `usuarios`, `roles`, `administracion`, `seguridad` |

> `proveedores` a secas **cambió de dueño**: antes era alias de *Pago a
> proveedor* y ahora lo es del catálogo. Si tienes una fila llamada así que
> pretendía conceder los pagos, renómbrala a `pago_proveedor`. En una base con
> los nombres canónicos no hay nada que hacer.

---

## 3. Tabla `productos`

Los nombres se reconocen igual, por alias normalizados:

| Clave | Alias |
|---|---|
| `regular` | `regular`, `gasolina`, `gasolina_regular` |
| `diesel` | `diesel`, `gasoil`, `gas_oil` |
| `kero` | `kero`, `kerosene`, `kerosen`, `keroseno` |
| `aceite` | `aceite`, `lubricante`, `aceites`, `lubricantes` |

**Control de aceite** necesita al menos una fila que case con `aceite`; si no
existe, la pantalla lo dice explícitamente en lugar de quedarse vacía.

---

## 4. Enlace entre Supabase Auth y la tabla `usuarios`

El esquema no tiene clave foránea entre `usuarios` y `auth.users`, pero hay dos
vínculos:

```
auth.users.email  ──(igual, sin distinguir mayúsculas)──►  usuarios.correo
auth.users.id     ──(mismo UUID)───────────────────────►  usuarios.id
```

**El correo es el que usa el frontend** para componer la sesión: con el email de
Auth resuelve la fila, de ahí el rol, y del rol los permisos
([`casos-uso.ts`](../packages/core/src/modules/auth/application/casos-uso.ts)).

**El id compartido** es la convención con la que se creó la base. El backend la
mantiene: al dar de alta inserta la fila con el id de la cuenta recién creada.
No hace falta para nada hoy, pero deja preparada la migración a un enlace por id
—más robusto, porque sobrevive a un cambio de correo— sin tener que reconstruir
el histórico.

Si los dos correos no coinciden exactamente, el usuario podrá iniciar sesión
pero entrará sin permisos. La app detecta ese caso y lo explica en pantalla.

### Las cuentas de acceso las crea el backend

Crear usuarios en Auth requiere la `service_role` key, que no puede estar en el
navegador. De eso se encarga **`SIC-InvLaFe-backend`**: la pantalla de *Usuarios
y roles* llama a sus endpoints y él crea, edita o borra la cuenta de Auth y la
fila de `usuarios` a la vez, compensando si una de las dos falla.

Consecuencias prácticas:

- Crear un usuario desde la pantalla crea también su **cuenta de acceso**, con
  la contraseña que fije el administrador. Ya no hay que darla de alta a mano en
  el panel de Supabase.
- Desactivar un usuario **bloquea su acceso** en Auth, no solo le quita los
  permisos. Antes seguía pudiendo entrar, solo que sin ver ningún módulo.
- Eliminar un usuario borra también su cuenta de acceso.
- Con el backend apagado, esas tres acciones fallan con un mensaje que lo dice.
  El resto de la pantalla (listar usuarios, roles y permisos) sigue funcionando,
  porque son lecturas directas a Supabase.

Los usuarios dados de alta a mano antes de existir el backend siguen
funcionando: si su id no coincide con el de Auth, el backend los localiza por
correo.

Para auditarlo, cruza las dos tablas por correo: lo que esté en `auth.users` y
no en `usuarios` es una cuenta de acceso sin usuario del sistema, y podrá entrar
pero sin ningún permiso.

```sql
select a.email, u.nombre, u.rol_id, u.activo
from auth.users a
left join public.usuarios u on lower(u.correo) = lower(a.email)
order by u.nombre nulls first;
```

### Iniciar sesión con nombre de usuario

Además del correo, cada usuario puede tener un **nombre de usuario** con el que
entrar. Vive en la columna `usuarios.usuario`, con un índice único sobre
`lower(usuario)` para que `"JPerez"` y `"jperez"` no puedan coexistir.

Es **opcional**: quien no lo tenga sigue entrando con su correo, exactamente
como antes.

El campo de la pantalla de acceso admite las dos cosas y decide por la arroba:

```
lleva @   →  es un correo   →  el navegador llama a Supabase directamente
no lleva  →  es un usuario  →  pasa por POST /api/acceso/iniciar-sesion
```

Ese rodeo existe porque **Supabase Auth solo acepta correo o teléfono** como
identificador: el nombre hay que traducirlo a correo antes de autenticar, y esa
consulta a `usuarios` se hace sin sesión, algo que RLS impide desde el
navegador. El backend la resuelve con la secret key y después autentica con la
publishable key, así que la sesión que emite es idéntica a la que habría
obtenido el navegador por su cuenta.

Consecuencias prácticas:

- El backend necesita ahora `SUPABASE_PUBLISHABLE_KEY` en su `.env`, además de
  la secret key que ya tenía. Es la misma que usa el frontend.
- **Entrar con el correo no depende del backend.** Si está apagado, quien use su
  correo entra igual; solo falla el acceso por nombre de usuario.
- El endpoint responde lo mismo ante un usuario inexistente que ante una
  contraseña equivocada, para que no sirva como forma de averiguar qué nombres
  existen. Está limitado a 10 intentos cada 5 minutos por IP.

### Cambio de contraseña en el primer acceso

Al crear un usuario, la casilla **«Debe cambiar la contraseña al entrar»** viene
marcada. Con ella, esa persona puede iniciar sesión pero la aplicación la lleva
directa a definir una contraseña nueva y no la deja entrar a ningún módulo hasta
que lo haga. La marca vive en `usuarios.debe_cambiar_contrasena`.

Resuelve el punto ciego de que la contraseña inicial la elige el administrador y,
por tanto, la conoce. La misma casilla está en la edición: márcala al asignarle
una contraseña a quien la perdió.

El cambio pasa por `POST /api/acceso/cambiar-contrasena` en vez de hacerse contra
Supabase desde el navegador, porque son dos escrituras —la contraseña en Auth y
la marca en `usuarios`— y permitir la segunda desde el cliente exigiría abrir por
RLS la fila donde también viven el rol y el estado activo.

> Es una medida de higiene, no una barrera de seguridad: quien entra ya conoce
> una contraseña válida. Sirve para que nadie se quede indefinidamente con la que
> le pusieron, no para defenderse de un usuario que quisiera saltársela.

### Si quieres enlazar por id en vez de por correo

Ya no requiere migración: `usuarios.id` es el id de Auth en las filas creadas
por el backend. Basta con cambiar `obtenerPorCorreo` por una búsqueda por id en
[`repositorios.supabase.ts`](../packages/core/src/modules/acceso/infrastructure/repositorios.supabase.ts)
y en el puerto correspondiente. Antes, comprueba con el script SQL de arriba que
todas las filas tienen el id correcto.

---

## 5. URL de redirección para recuperar contraseña

En **Authentication → URL Configuration → Redirect URLs**, añade:

```
http://localhost:5173/restablecer-contrasena
https://TU-DOMINIO/restablecer-contrasena
```

Sin esto, el enlace del correo rebota y la pantalla dirá que el enlace no es
válido.

---

## 6. Atomicidad de venta y abono (recomendado)

El navegador no tiene transacciones. Registrar una venta toca dos tablas
(`lotes_compra` y `ventas`), y registrar un abono toca otras dos (`ventas` y
`pagos_cliente`).

**Lo que hace hoy el código**: reserva primero con un `UPDATE` condicional —si
otro usuario se adelantó, la actualización no afecta ninguna fila y se aborta sin
haber escrito nada— y luego inserta; si el `INSERT` falla, revierte la reserva.
Eso cubre los errores de red y las carreras entre usuarios. Lo único que no cubre
es que el navegador muera justo entre las dos escrituras.

**Para cerrarlo del todo**, mueve la operación a Postgres y llama a la función
desde el repositorio.

> Los tipos de los parámetros asumen llaves `bigint`. Si tus tablas usan `uuid`,
> cambia `bigint` por `uuid` en las firmas.

```sql
create or replace function public.registrar_venta(
  p_lote_compra_id  bigint,
  p_cliente_id      bigint,
  p_fecha           date,
  p_numero_factura  text,
  p_cantidad        numeric,
  p_precio_unitario numeric
)
returns public.ventas
language plpgsql
-- `security invoker`: la función se ejecuta con los permisos de quien llama,
-- así que RLS sigue aplicando. No la pongas en `security definer`.
security invoker
set search_path = public
as $$
declare
  v_valor_total numeric;
  v_venta       public.ventas;
begin
  v_valor_total := round(p_cantidad * p_precio_unitario, 2);

  -- El WHERE hace de guarda: si no hay existencia suficiente, no afecta filas.
  update public.lotes_compra
     set cantidad_disponible = cantidad_disponible - p_cantidad
   where id = p_lote_compra_id
     and cantidad_disponible >= p_cantidad;

  if not found then
    raise exception 'Existencia insuficiente en el lote %', p_lote_compra_id
      using errcode = 'P0001';
  end if;

  insert into public.ventas (
    lote_compra_id, cliente_id, fecha, numero_factura,
    cantidad, precio_unitario, valor_total, saldo_pendiente
  ) values (
    p_lote_compra_id, p_cliente_id, p_fecha, nullif(p_numero_factura, ''),
    p_cantidad, p_precio_unitario, v_valor_total, v_valor_total
  )
  returning * into v_venta;

  return v_venta;
end;
$$;


create or replace function public.registrar_abono_cliente(
  p_venta_id bigint,
  p_fecha    date,
  p_monto    numeric
)
returns public.pagos_cliente
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_pago public.pagos_cliente;
begin
  update public.ventas
     set saldo_pendiente = round(saldo_pendiente - p_monto, 2)
   where id = p_venta_id
     and saldo_pendiente >= p_monto;

  if not found then
    raise exception 'El abono supera el saldo pendiente de la venta %', p_venta_id
      using errcode = 'P0001';
  end if;

  insert into public.pagos_cliente (venta_id, fecha, monto)
  values (p_venta_id, p_fecha, p_monto)
  returning * into v_pago;

  return v_pago;
end;
$$;
```

Después, en
[`casos-uso.ts` de ventas](../packages/core/src/modules/ventas/application/casos-uso.ts),
sustituye la secuencia `descontarExistencia` → `crear` → compensación por una
sola llamada `cliente.rpc("registrar_venta", { ... })`. El resto de la aplicación
no cambia: es exactamente el tipo de sustitución que la separación en capas
permite hacer en un solo archivo.

---

## 7. Notas sobre RLS

El frontend **oculta** botones y secciones según `permisos_rol`, pero eso es
cosmético: solo evita ofrecer acciones que van a fallar. La autorización real la
hace RLS.

Cuando una política rechaza una operación, PostgREST devuelve `42501`, y la app
lo traduce a *«No tienes permiso para …»* en lugar de mostrar el error crudo. Si
ves ese mensaje con permisos que crees correctos, revisa la política, no la
matriz de la pantalla.

---

## 8. Forma del esquema

Dos ideas del negocio llevan cabecera y detalle. Las migraciones que las
introdujeron ya están aplicadas; lo que sigue explica cómo quedaron las tablas,
que es lo que hay que entender para leer el código o tocar la base.

`compras` y `cotizacion_items` nacieron con **RLS activo y políticas para
`authenticated`**. Si el resto de tu esquema usa políticas más finas, revísalas:

```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

### Una compra, varios productos

Una factura del proveedor casi nunca trae un solo producto. Antes
`lotes_compra` era la factura y la línea de inventario a la vez, así que una
compra de diésel, regular y aceite se partía en tres filas y había que abonarle
al proveedor tres veces.

```
compras                cabecera: proveedor, fecha, nº de factura, importe
  └── lotes_compra     detalle:  producto, cantidad, precio, existencia
pagos_proveedor        abonos, ahora contra la factura entera
```

**`lotes_compra` sigue siendo la unidad de inventario** y `ventas` sigue
apuntando a ella, así que el control de carga, el cuadre y los cobros no
cambian. Lo que se movió a la cabecera son `proveedor_id`, `fecha`,
`numero_factura` y `valor_factura`.

Los lotes anteriores a la migración son ahora compras de una sola línea, que es
exactamente lo que eran.

La limpieza ya está hecha: `lotes_compra` perdió `proveedor_id`, `fecha`,
`numero_factura` y `valor_factura` —que ahora viven en la cabecera— y
`pagos_proveedor` perdió `lote_compra_id`, porque el abono es de la factura
entera y no de una línea. `compra_id` es obligatorio en ambas.

### Detalle de la carga en barriles (obligatorio para Control de carga)

El combustible se carga en barriles, no en galones sueltos: 1500 galones de
regular pueden salir como 25 barriles de 60, y esa cuenta hay que poder
anotarla junto a la venta. `ventas.detalle` guarda esa nota libre —«25x60»—
igual que `cotizaciones.detalle` guarda la nota de una cotización.

**Hay que crear la columna antes de usar esta versión de la app.** El
formulario de "Registrar carga" ya envía `detalle` en cada venta nueva; sin la
columna, Supabase rechaza el `insert` completo y **ninguna venta se puede
registrar**, no solo las que llevan detalle.

```sql
alter table public.ventas add column if not exists detalle text;
```

Es segura de ejecutar en cualquier momento: no toca las filas existentes, que
quedan con `detalle` en `null`.

### Una cotización, varios productos

`cotizaciones.detalle` era texto libre: «500 gl de diésel a 250 y 20 de aceite a
180». Eso no se puede sumar, ni comparar con lo facturado, ni convertir en
ventas sin volver a teclearlo.

```
cotizaciones           cliente, fecha, estado, nota
  └── cotizacion_items producto, cantidad, precio unitario, venta generada
```

`detalle` sobrevive como **nota libre opcional** para condiciones de entrega o
plazos, y las cotizaciones anteriores a la migración se quedaron tal cual: se
ven sin líneas, con su nota intacta, y se les pueden añadir a mano al editarlas.
No se intentó deducir las líneas del texto —un precio mal interpretado acabaría
en una venta mal facturada.

Al convertir, cada línea genera **su propia venta** contra el lote de su
producto, porque el inventario se descuenta por lote. La operación es todo o
nada: si una venta falla, se anulan las anteriores y la existencia vuelve a su
sitio. `cotizacion_items.venta_id` guarda qué venta salió de cada línea, y
`cotizaciones.venta_id` sigue apuntando a la primera, que es la marca de «esta
cotización ya se facturó».

---

## 9. Caducidad de la sesión

No requiere nada en la base. Supabase refresca el token indefinidamente
mientras la pestaña siga abierta, así que el corte lo pone la aplicación: tras
**60 minutos sin actividad** avisa con una cuenta atrás de dos minutos y, si
nadie responde, cierra la sesión de verdad —`signOut`, no un borrado local— y
lo explica en la pantalla de acceso.

Los dos números están en
[`core/src/shared/config.ts`](../packages/core/src/shared/config.ts)
(`CONFIG_SESION`). La marca de actividad se comparte entre pestañas, así que
trabajar en una no deja caducar la otra.
