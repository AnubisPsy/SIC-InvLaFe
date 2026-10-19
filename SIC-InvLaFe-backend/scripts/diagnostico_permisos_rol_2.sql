-- Segunda vuelta del diagnóstico: el SQL Editor corre como `postgres`, así que
-- auth.uid() siempre da null ahí (por eso el script anterior no encontró
-- filas). Esta vez comparamos por correo, sin depender de auth.uid().

-- 1) Tu fila en `usuarios`. Cambia el correo si hace falta.
select id, nombre, correo, usuario, rol_id, activo, debe_cambiar_contrasena
from usuarios
where correo = 'denuarh525@gmail.com';

-- 2) El id que Supabase Auth tiene para ese mismo correo.
select id, email
from auth.users
where email = 'denuarh525@gmail.com';

-- Si el `id` del paso 1 y el `id` del paso 2 NO son iguales, ahí está el bug:
-- rol_del_solicitante()/tiene_permiso() buscan por auth.uid(), y si
-- usuarios.id no coincide con auth.users.id, nunca te van a encontrar sin
-- importar qué rol tengas asignado.

-- 3) Qué hacen exactamente las funciones que usan las políticas de RLS.
select proname, prosrc
from pg_proc
where proname in ('tiene_permiso', 'rol_del_solicitante');

-- 4) Tu rol y sus permisos sobre "usuarios_roles", buscando por correo en vez
--    de auth.uid() (para confirmar que el rol SÍ tiene el permiso marcado,
--    independientemente del problema de id del paso 2).
select r.nombre as rol, m.nombre as modulo,
       p.puede_ver, p.puede_crear, p.puede_editar, p.puede_eliminar
from usuarios u
join roles r on r.id = u.rol_id
left join permisos_rol p on p.rol_id = r.id
left join modulos m on m.id = p.modulo_id
where u.correo = 'TU_CORREO_AQUI'
order by m.nombre;
