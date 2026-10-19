-- Confirma si usuarios.rol_id apunta a un rol que ya no existe.

-- 1) ¿Existe un rol con ese id?
select *
from roles
where id = 'b2c4f333-629a-4eda-a493-c0928499e04a';

-- 2) Todos los roles que sí existen hoy.
select id, nombre, creado_en
from roles
order by creado_en;
