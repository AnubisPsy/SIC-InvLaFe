-- Compara las políticas de RLS de `productos` (nuevo, solo tenía lectura)
-- contra `proveedores` (ya soporta crear/editar/eliminar desde la app), para
-- ver qué le falta a productos.

select tablename, policyname, cmd, qual, with_check
from pg_policies
where tablename in ('productos', 'proveedores')
order by tablename, cmd;

-- ¿RLS está habilitado en productos?
select relname, relrowsecurity, relforcerowsecurity
from pg_class
where relname = 'productos';
