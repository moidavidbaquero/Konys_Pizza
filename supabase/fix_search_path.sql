-- ============================================================
-- KONYS PIZZA — Corrección de search_path (pgcrypto)
-- ------------------------------------------------------------
-- En Supabase la extensión pgcrypto se instala en el esquema
-- "extensions". Las funciones de Konys se crearon con
--   set search_path = public, pg_temp
-- así que no encontraban crypt() ni gen_salt() y el inicio de
-- sesión del panel fallaba con:
--   function crypt(text, text) does not exist
--
-- Ejecuta este archivo UNA VEZ en el SQL Editor si tu base de
-- datos se creó con una versión anterior de schema.sql.
-- Las instalaciones nuevas ya incluyen el search_path correcto
-- y no necesitan este script.
-- ============================================================

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.prokind = 'f'
       and (
         p.proname like 'admin%'
         or p.proname in ('_admin_assert', '_konys_client_ip', 'crear_reserva', 'reservas_ocupadas')
       )
  loop
    execute format('alter function %s set search_path = public, extensions, pg_temp', r.sig);
  end loop;
end
$$;

-- Comprobación: todas las funciones deben mostrar
-- "search_path=public, extensions, pg_temp".
select p.proname, p.proconfig
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and (
     p.proname like 'admin%'
     or p.proname in ('_admin_assert', '_konys_client_ip', 'crear_reserva', 'reservas_ocupadas')
   )
 order by p.proname;
