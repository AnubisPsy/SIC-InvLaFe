select r.nombre as rol, m.nombre as modulo,
       p.puede_ver, p.puede_crear, p.puede_editar, p.puede_eliminar
from usuarios u
join roles r on r.id = u.rol_id
left join permisos_rol p on p.rol_id = r.id
left join modulos m on m.id = p.modulo_id
where u.correo = 'denuarh525@gmail.com'
order by m.nombre;
