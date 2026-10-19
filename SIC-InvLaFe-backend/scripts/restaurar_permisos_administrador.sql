-- Restaura permisos completos (ver/crear/editar/eliminar) para el rol
-- Administrador sobre todos los módulos que existen hoy en `modulos`.
-- Se quedó sin ninguna fila por el bug de guardarPorRol (delete + insert no
-- atómicos, ver conversación). Corre esto como postgres en el SQL Editor,
-- que bypassa RLS.

insert into permisos_rol (rol_id, modulo_id, puede_ver, puede_crear, puede_editar, puede_eliminar)
select 'b2c4f333-629a-4eda-a493-c0928499e04a', m.id, true, true, true, true
from modulos m
where not exists (
  select 1
  from permisos_rol p
  where p.rol_id = 'b2c4f333-629a-4eda-a493-c0928499e04a'
    and p.modulo_id = m.id
);

-- Verificación.
select m.nombre as modulo, p.puede_ver, p.puede_crear, p.puede_editar, p.puede_eliminar
from permisos_rol p
join modulos m on m.id = p.modulo_id
where p.rol_id = 'b2c4f333-629a-4eda-a493-c0928499e04a'
order by m.nombre;
