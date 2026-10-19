# SIC — Inversiones La Fe

Sistema de inventario y control de combustible: compras por lote, despacho a
clientes, cobros, cuadre de galones y administración de usuarios.

## Puesta en marcha

```bash
npm install
cp apps/web/.env.example apps/web/.env   # y rellena las credenciales
npm run dev
```

La aplicación queda en <http://localhost:5173>.

> Antes de que muestre datos hay que configurar la base. Está todo en
> [`docs/supabase.md`](docs/supabase.md): credenciales, filas de `modulos`, el
> enlace entre Auth y `usuarios`, y la URL de recuperación de contraseña.

### El backend administrativo

La pantalla de **Usuarios y roles** necesita además el backend
(`SIC-InvLaFe-backend`) encendido, porque crear o borrar una cuenta de acceso
exige la `service_role` key de Supabase, que no puede vivir en el navegador:

```bash
cd ../SIC-InvLaFe-backend
npm install && npm run dev      # http://localhost:3000
```

Su URL va en `VITE_API_URL`. El resto de la aplicación —proveedores, lotes,
ventas, cobros, cotizaciones, y también *leer* usuarios y roles— habla
directamente con Supabase y funciona con el backend apagado; solo fallan las
altas, ediciones y bajas de usuarios, con un mensaje que lo explica.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Typecheck de todo el monorepo + build de producción |
| `npm run typecheck` | Solo typecheck |
| `npm run lint` | oxlint sobre la app web |

## Arquitectura

Monorepo con workspaces de npm. La separación no es decorativa: `core` y `query`
no importan nada del DOM ni de `react-dom`, así que una futura app de React
Native puede consumirlos sin tocar una línea.

```
packages/core     Dominio, casos de uso e infraestructura. Cero React.
packages/query    Hooks de TanStack Query sobre core. React, pero sin UI.
apps/web          Interfaz. Vite + React + Tailwind v4 + react-router.
```

### El flujo de una operación

```
Pantalla (apps/web)
   ↓ llama a un hook
Hook (packages/query)          ← caché, estados, invalidación
   ↓ llama a un caso de uso
Caso de uso (core/application) ← orquestación y reglas que cruzan entidades
   ↓ usa un puerto
Repositorio (core/domain)      ← interfaz, sin implementación
   ↑ lo implementa
Adaptador Supabase (core/infrastructure)
```

La dirección de las dependencias siempre apunta hacia dentro: infraestructura
conoce el dominio, el dominio no conoce a nadie.

### Estructura de `packages/core`

```
src/
  shared/                 Tipos, errores, dinero, fechas, texto
  infrastructure/supabase/ Cliente, tipos de fila, traducción de errores
  composition/            Ensambla repositorios + casos de uso
  modules/
    auth/                 Sesión, login, recuperación
    acceso/               Usuarios, roles, módulos, permisos
    catalogos/            Proveedores, clientes, productos
    compras/              Facturas de compra, sus líneas y los pagos a proveedor
    ventas/               Ventas + pagos de cliente
    inventario/           Cuadre (compone compras y ventas)
    cotizaciones/         Cotizaciones y conversión en venta
```

Cada módulo tiene `domain/` (entidades y puertos), `application/` (casos de uso)
e `infrastructure/` (adaptador Supabase).

Los siete módulos del núcleo dan servicio a los ocho de la interfaz: **Pago a
proveedor** y **Control de aceite** son la misma pantalla con distinto filtro de
producto, y **Cuadre** compone `compras` + `ventas` sin tabla propia.

### Estructura de `apps/web`

```
src/
  app/            Proveedores, enrutador, guardias, navegación
  config/         Lectura y validación del entorno
  contextos/      Tema y barra lateral
  layout/         Marco de la app y de las pantallas de auth
  shared/ui/      Kit de componentes (Boton, Tabla, Modal, Campo…)
  shared/componentes/  Piezas transversales (filtros, insignias de estado)
  modules/<modulo>/paginas|componentes/
```

## Decisiones que conviene conocer

**Una compra tiene cabecera y detalle.** `compras` es la factura del proveedor
—fecha, número, importe— y `lotes_compra` son sus líneas, una por producto. La
línea sigue siendo la unidad de inventario a la que apuntan las ventas; lo que
subió a la cabecera es lo que pertenece a la factura, incluidos los abonos al
proveedor. Filtrar por producto decide **qué facturas se listan**, no las
recorta: en «Control de aceite» sigues viendo qué más venía en el mismo camión.

**Una cotización también.** `cotizacion_items` guarda producto, cantidad y
precio ofertado; `cotizaciones.detalle` quedó como nota libre. Convertirla emite
una venta por línea —el inventario se descuenta por lote— y es todo o nada: si
una falla, se anulan las anteriores.

**La sesión caduca a la hora de inactividad.** Supabase refrescaría el token
para siempre, así que el corte lo pone la aplicación: aviso con cuenta atrás a
los 58 minutos y `signOut` real a los 60. Los números viven en
`core/src/shared/config.ts` y la marca de actividad se comparte entre pestañas.

**Los ids se manejan como texto.** El esquema puede usar `bigint` o `uuid`; los
mappers normalizan con `String(...)` al leer y PostgREST acepta texto al
escribir. Así el dominio no depende del tipo de la llave.

**El saldo del proveedor no se guarda.** Se deriva de `valor_factura` menos la
suma de sus abonos, cada vez. El saldo del cliente sí es columna
(`ventas.saldo_pendiente`) porque así está el esquema.

**Venta y abono usan bloqueo optimista con compensación.** El navegador no tiene
transacciones: se reserva primero con un `UPDATE` condicional y se inserta
después, revirtiendo si falla. Cubre carreras entre usuarios y fallos de red. La
versión atómica de verdad es una función RPC, y el SQL está listo en
[`docs/supabase.md`](docs/supabase.md#6-atomicidad-de-venta-y-abono-recomendado).

**Los permisos del frontend son cosméticos.** Ocultan lo que el rol no puede
hacer para que la experiencia sea coherente; quien autoriza de verdad es RLS.

**Los nombres de `modulos` y `productos` se casan por alias normalizados.** Son
texto libre en la base y no controlamos su escritura, así que `"Diésel"`,
`"diesel"` y `"DIESEL"` colapsan al mismo valor. Los alias están en
`core/src/modules/acceso/domain/modulos.ts` y
`core/src/modules/catalogos/domain/entidades.ts`.

**La moneda y la zona horaria viven en un solo archivo:**
`core/src/shared/config.ts`. Ahora mismo, `es-DO` / `DOP` /
`America/Santo_Domingo`.

## Diseño

El sistema visual está tomado de la plantilla TailAdmin: paleta, escala
tipográfica, sombras y el patrón de barra lateral colapsable. Los componentes se
reescribieron en `shared/ui` con nombres del dominio y **lucide-react** como
única fuente de iconos (sin emojis). Modo claro y oscuro incluidos.

## Camino a React Native

1. `apps/mobile` con Expo, dentro de los workspaces.
2. Depender de `@invlafe/core` y `@invlafe/query`.
3. Pasar AsyncStorage como `almacenamiento` a `crearContenedor` y
   `detectarSesionEnUrl: false`.
4. Escribir solo las pantallas. Toda la lógica de datos ya está compartida.
