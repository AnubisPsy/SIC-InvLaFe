# SIC — Inversiones La Fe

Sistema de inventario y control de combustible: compras por lote, despacho a
clientes, cobros, cuadre de galones y administración de usuarios.

Este repositorio agrupa los dos proyectos que componen el sistema:

| Carpeta | Qué es | README |
|---|---|---|
| [`SIC-InvLaFe-frontend/`](SIC-InvLaFe-frontend) | Monorepo de npm (core, query, app web) con toda la lógica de negocio y la interfaz | [frontend/README.md](SIC-InvLaFe-frontend/README.md) |
| [`SIC-InvLaFe-backend/`](SIC-InvLaFe-backend) | API administrativa mínima: solo las operaciones que requieren la `service_role` key de Supabase | [backend/README.md](SIC-InvLaFe-backend/README.md) |

## Puesta en marcha rápida

```bash
# Frontend (app web)
cd SIC-InvLaFe-frontend
npm install
cp apps/web/.env.example apps/web/.env   # y rellena las credenciales
npm run dev                              # http://localhost:5173

# Backend (solo necesario para alta/baja de usuarios)
cd ../SIC-InvLaFe-backend
npm install
cp .env.example .env                     # y rellena las credenciales
npm run dev                               # http://localhost:3000
```

Cada proyecto tiene su propio `README.md` con el detalle de arquitectura,
variables de entorno y decisiones de diseño. La configuración de la base de
datos (Supabase) está documentada en
[`SIC-InvLaFe-frontend/docs/supabase.md`](SIC-InvLaFe-frontend/docs/supabase.md).

## Por qué dos proyectos separados

El frontend habla directamente contra Supabase (protegido por RLS) para casi
todo: proveedores, lotes, ventas, cobros, cotizaciones, y también *leer*
usuarios y roles. El backend existe únicamente porque crear, editar o eliminar
una cuenta de acceso requiere la `service_role` key de Supabase, que nunca
puede vivir en el navegador. Ninguno de los dos duplica al otro.

## Workspace

`SIC-InvLaFe-frontend.code-workspace` abre ambos proyectos juntos en VS Code.
