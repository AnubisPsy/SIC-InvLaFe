-- Diagnóstico de por qué falla "Guardar permisos" con error 42501 / PGRST301
-- (RLS rechazó la escritura). Todo de solo lectura, no modifica nada.
-- Correr en el SQL Editor de Supabase, logueado con tu usuario normal
-- (no como service_role) para que auth.uid() refleje tu sesión real.

-- 1) Quién eres para Postgres ahora mismo.
select auth.uid() as mi_auth_uid;

-- 2) Tu fila en `usuarios`: rol_id, activo, y si el id coincide con auth.uid().
select id, nombre, correo, usuario, rol_id, activo, debe_cambiar_contrasena
from usuarios
where id = auth.uid();

-- 3) Tu rol.
select r.id, r.nombre
from roles r
join usuarios u on u.rol_id = r.id
where u.id = auth.uid();

-- 4) Los permisos que tu rol tiene hoy sobre "usuarios_roles" (el módulo que
--    controla la pantalla de Roles y permisos). Si esto no tiene una fila con
--    puede_editar = true, la política de RLS te va a bloquear aunque seas
--    "Administrador" de nombre.
select m.nombre as modulo, p.puede_ver, p.puede_crear, p.puede_editar, p.puede_eliminar
from permisos_rol p
join modulos m on m.id = p.modulo_id
join usuarios u on u.rol_id = p.rol_id
where u.id = auth.uid()
order by m.nombre;

-- 5) Las políticas de RLS activas sobre permisos_rol: qué condición exige
--    exactamente para permitir un UPDATE/INSERT/DELETE.
select policyname, cmd, qual, with_check
from pg_policies
where tablename = 'permisos_rol';

-- 6) ¿RLS está siquiera habilitado en la tabla? (por si el problema es al revés)
select relname, relrowsecurity, relforcerowsecurity
from pg_class
where relname = 'permisos_rol';
