-- Hace atómico el guardado de permisos de un rol, para no repetir el bug de
-- "guardarPorRol": delete + insert como dos llamadas separadas dejaban al rol
-- sin ninguna fila cuando el propio DELETE le quitaba el permiso que
-- necesitaba el INSERT siguiente (autobloqueo al editar el permiso de tu
-- propio rol sobre "usuarios_roles").
--
-- SECURITY DEFINER: corre con los privilegios del dueño de la función (que
-- bypassa RLS sobre permisos_rol, igual que el service_role), así que la
-- función valida el permiso ELLA MISMA, una sola vez, contra el estado
-- ANTERIOR al borrado — no contra el estado a mitad de la operación.
create or replace function guardar_permisos_rol(p_rol_id uuid, p_permisos jsonb)
returns setof permisos_rol
language plpgsql
security definer
set search_path = public
as $$
begin
  if not tiene_permiso('usuarios_roles', 'editar') then
    raise exception 'No tienes permiso para editar los permisos de un rol.'
      using errcode = '42501';
  end if;

  delete from permisos_rol where rol_id = p_rol_id;

  return query
  insert into permisos_rol (rol_id, modulo_id, puede_ver, puede_crear, puede_editar, puede_eliminar)
  select
    p_rol_id,
    (item ->> 'moduloId')::uuid,
    coalesce((item ->> 'ver')::boolean, false),
    coalesce((item ->> 'crear')::boolean, false),
    coalesce((item ->> 'editar')::boolean, false),
    coalesce((item ->> 'eliminar')::boolean, false)
  from jsonb_array_elements(p_permisos) as item
  where (item ->> 'ver')::boolean
     or (item ->> 'crear')::boolean
     or (item ->> 'editar')::boolean
     or (item ->> 'eliminar')::boolean
  returning *;
end;
$$;

-- Solo un usuario autenticado (con fila en `usuarios`) puede siquiera intentar
-- llamarla; el permiso real lo exige la función por dentro.
revoke all on function guardar_permisos_rol(uuid, jsonb) from public;
grant execute on function guardar_permisos_rol(uuid, jsonb) to authenticated;
