-- `productos` solo tenía política de SELECT (lectura abierta a cualquier
-- autenticado). Faltan INSERT/UPDATE/DELETE, atadas al módulo "productos"
-- (el mismo que ya aparece en la matriz de Usuarios y roles). La de SELECT
-- se deja igual: varios módulos leen el catálogo sin necesitar el permiso
-- explícito de "productos".

create policy productos_insert_permiso
on productos
for insert
with check (tiene_permiso('productos', 'crear'));

create policy productos_update_permiso
on productos
for update
using (tiene_permiso('productos', 'editar'));

create policy productos_delete_permiso
on productos
for delete
using (tiene_permiso('productos', 'eliminar'));

-- Verificación.
select tablename, policyname, cmd, qual, with_check
from pg_policies
where tablename = 'productos'
order by cmd;
