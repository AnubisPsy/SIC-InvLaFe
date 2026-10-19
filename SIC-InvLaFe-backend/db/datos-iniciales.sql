-- Datos mínimos para una base nueva de SIC-InvLaFe.
-- Se ejecuta una sola vez, después de db/esquema.sql. Se puede repetir sin
-- duplicar nada.
--
-- Crea los 10 módulos del sistema y el rol Administrador con todos los
-- permisos. El primer usuario se crea después con la herramienta crear-admin
-- (ver README).

insert into modulos (nombre) values
  ('pago_proveedor'),
  ('control_carga'),
  ('cobro_clientes'),
  ('cuadre_galones'),
  ('control_aceite'),
  ('cotizaciones'),
  ('clientes'),
  ('proveedores'),
  ('productos'),
  ('usuarios_roles')
on conflict (nombre) do nothing;

insert into roles (nombre) values ('Administrador')
on conflict (nombre) do nothing;

insert into permisos_rol (rol_id, modulo_id, puede_ver, puede_crear, puede_editar, puede_eliminar)
select r.id, m.id, true, true, true, true
from roles r cross join modulos m
where r.nombre = 'Administrador'
on conflict (rol_id, modulo_id) do nothing;
