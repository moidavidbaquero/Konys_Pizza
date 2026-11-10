-- ============================================================
-- KONYS PIZZA — Esquema de Supabase
-- ------------------------------------------------------------
-- Ejecuta este archivo UNA VEZ en el SQL Editor de un proyecto
-- Supabase nuevo (Database > SQL Editor > New query).
--
-- Incluye:
--   · Tablas, relaciones, checks e índices.
--   · Restricción de exclusión para impedir doble reserva.
--   · Row Level Security (lecturas públicas mínimas).
--   · RPC públicas: reservas_ocupadas, crear_reserva.
--   · RPC protegidas de administración + sesiones y rate limit.
--
-- La contraseña inicial del panel es: konys2026
-- Cámbiala después del primer ingreso con el bloque comentado
-- al final del archivo. En el frontend SOLO se usa la anon key.
-- La service_role key nunca debe llegar al navegador.
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- En Supabase las extensiones viven en el esquema "extensions".
-- Lo agregamos al search_path para que crypt()/gen_salt() funcionen
-- también fuera de las funciones (por ejemplo en este script).
set search_path = public, extensions, pg_temp;

-- ------------------------------------------------------------
-- 1. Tablas
-- ------------------------------------------------------------

create table if not exists public.mesas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  zona text not null default 'salon' check (zona in ('salon', 'terraza')),
  capacidad integer not null check (capacidad between 1 and 30),
  activa boolean not null default true,
  foto_url text,
  creado_en timestamptz not null default now(),
  constraint mesas_nombre_largo check (char_length(btrim(nombre)) between 2 and 40)
);

-- El nombre no distingue mayúsculas ni espacios exteriores.
create unique index if not exists mesas_nombre_lower_idx
  on public.mesas (lower(btrim(nombre)));

create index if not exists mesas_activa_idx on public.mesas (activa);

create table if not exists public.horarios (
  id uuid primary key default gen_random_uuid(),
  dia_semana text not null check (dia_semana in (
    'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'
  )),
  jornada text not null check (jornada in ('almuerzo', 'noche')),
  hora_inicio time not null,
  hora_fin time not null,
  duracion_slot integer not null default 60 check (duracion_slot between 30 and 180),
  activo boolean not null default true,
  constraint horarios_dia_jornada_unico unique (dia_semana, jornada),
  constraint horarios_rango_valido check (hora_fin > hora_inicio)
);

create index if not exists horarios_activo_idx on public.horarios (activo);

create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references public.mesas (id) on delete restrict,
  cliente_nombre text not null,
  cliente_contacto text,
  num_personas integer not null check (num_personas between 1 and 30),
  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,
  estado text not null default 'confirmada'
    check (estado in ('confirmada', 'cancelada', 'completada')),
  creado_en timestamptz not null default now(),

  -- Rangos en hora de Colombia para que la restricción de exclusión
  -- funcione incluso si el servidor de base de datos está en UTC.
  inicio_ts timestamptz generated always as (
    ((fecha + hora_inicio) at time zone 'America/Bogota')
  ) stored,
  fin_ts timestamptz generated always as (
    ((fecha + hora_fin) at time zone 'America/Bogota')
  ) stored,

  constraint reservas_cliente_largo check (char_length(btrim(cliente_nombre)) between 2 and 120),
  constraint reservas_rango_valido check (hora_fin > hora_inicio),

  -- Corazón anti-doble-reserva: dos reservas confirmadas de la misma
  -- mesa no pueden solaparse. Las canceladas quedan fuera del índice.
  constraint reservas_sin_solape exclude using gist (
    mesa_id with =,
    tstzrange(inicio_ts, fin_ts, '[)') with &&
  ) where (estado = 'confirmada')
);

create index if not exists reservas_fecha_idx on public.reservas (fecha, hora_inicio);
create index if not exists reservas_mesa_fecha_idx on public.reservas (mesa_id, fecha);
create index if not exists reservas_estado_idx on public.reservas (estado);
create index if not exists reservas_creado_idx on public.reservas (creado_en desc);

create table if not exists public.platos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null check (categoria in ('pizzas', 'entradas', 'postres', 'bebidas')),
  descripcion text,
  precio integer not null check (precio >= 0),
  disponible boolean not null default true,
  foto_url text,
  creado_en timestamptz not null default now(),
  constraint platos_nombre_largo check (char_length(btrim(nombre)) between 2 and 60)
);

create index if not exists platos_categoria_idx on public.platos (categoria, nombre);
create index if not exists platos_disponible_idx on public.platos (disponible);

-- ------------------------------------------------------------
-- 2. Seguridad del panel
-- ------------------------------------------------------------

create table if not exists public.admin_config (
  id boolean primary key default true,
  password_hash text not null,
  actualizado_en timestamptz not null default now(),
  constraint admin_config_singleton check (id = true)
);

create table if not exists public.admin_sesiones (
  token uuid primary key default gen_random_uuid(),
  creado_en timestamptz not null default now(),
  ultimo_uso timestamptz not null default now(),
  expira_en timestamptz not null
);

create index if not exists admin_sesiones_expira_idx on public.admin_sesiones (expira_en);

create table if not exists public.admin_intentos (
  id bigint generated always as identity primary key,
  ip text not null default 'desconocida',
  exito boolean not null default false,
  creado_en timestamptz not null default now()
);

create index if not exists admin_intentos_ip_fecha_idx on public.admin_intentos (ip, creado_en desc);

-- Contraseña inicial SOLO para la primera instalación.
-- Hash bcrypt (pgcrypto), nunca texto plano.
insert into public.admin_config (id, password_hash)
values (true, crypt('konys2026', gen_salt('bf', 12)))
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 3. Row Level Security
-- ------------------------------------------------------------

alter table public.mesas enable row level security;
alter table public.horarios enable row level security;
alter table public.reservas enable row level security;
alter table public.platos enable row level security;
alter table public.admin_config enable row level security;
alter table public.admin_sesiones enable row level security;
alter table public.admin_intentos enable row level security;

-- El cliente anónimo solo puede leer filas públicas y activas.
drop policy if exists mesas_lectura_publica on public.mesas;
create policy mesas_lectura_publica
  on public.mesas for select
  to anon, authenticated
  using (activa = true);

drop policy if exists horarios_lectura_publica on public.horarios;
create policy horarios_lectura_publica
  on public.horarios for select
  to anon, authenticated
  using (activo = true);

drop policy if exists platos_lectura_publica on public.platos;
create policy platos_lectura_publica
  on public.platos for select
  to anon, authenticated
  using (disponible = true);

-- reservas y tablas admin no tienen políticas: acceso directo denegado.
-- Todo pasa por RPCs SECURITY DEFINER que validan la sesión.

-- ------------------------------------------------------------
-- 4. Permisos de tablas
-- ------------------------------------------------------------

revoke all on table public.mesas from anon, authenticated;
revoke all on table public.horarios from anon, authenticated;
revoke all on table public.reservas from anon, authenticated;
revoke all on table public.platos from anon, authenticated;
revoke all on table public.admin_config from anon, authenticated;
revoke all on table public.admin_sesiones from anon, authenticated;
revoke all on table public.admin_intentos from anon, authenticated;

grant select on table public.mesas to anon, authenticated;
grant select on table public.horarios to anon, authenticated;
grant select on table public.platos to anon, authenticated;

-- ------------------------------------------------------------
-- 5. Utilidades internas
-- ------------------------------------------------------------

create or replace function public._konys_client_ip()
returns text
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select coalesce(
    nullif(
      split_part(
        coalesce(
          (nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for'),
          ''
        ),
        ',',
        1
      ),
      ''
    ),
    'desconocida'
  );
$$;

create or replace function public._admin_assert(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if p_token is null then
    raise exception 'SESION_INVALIDA';
  end if;

  update public.admin_sesiones
     set ultimo_uso = now()
   where token = p_token
     and expira_en > now();

  if not found then
    raise exception 'SESION_INVALIDA';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 6. Autenticación del panel
-- ------------------------------------------------------------

create or replace function public.admin_login(p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ip text := public._konys_client_ip();
  v_hash text;
  v_failures integer;
  v_token uuid;
  v_expira timestamptz;
begin
  -- Limpieza ligera de intentos y sesiones vencidas.
  delete from public.admin_intentos where creado_en < now() - interval '1 day';
  delete from public.admin_sesiones where expira_en < now();

  select count(*) into v_failures
    from public.admin_intentos
   where ip = v_ip
     and exito = false
     and creado_en > now() - interval '15 minutes';

  if v_failures >= 8 then
    raise exception 'DEMASIADOS_INTENTOS';
  end if;

  select password_hash into v_hash
    from public.admin_config
   where id = true;

  if v_hash is null
     or p_password is null
     or crypt(p_password, v_hash) <> v_hash then
    insert into public.admin_intentos (ip, exito) values (v_ip, false);
    raise exception 'CLAVE_INCORRECTA';
  end if;

  insert into public.admin_intentos (ip, exito) values (v_ip, true);

  insert into public.admin_sesiones (expira_en)
  values (now() + interval '8 hours')
  returning token, expira_en into v_token, v_expira;

  return jsonb_build_object(
    'token', v_token,
    'expira_en', v_expira
  );
end;
$$;

create or replace function public.admin_sesion_valida(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if p_token is null then
    return false;
  end if;

  update public.admin_sesiones
     set ultimo_uso = now()
   where token = p_token
     and expira_en > now();

  return found;
end;
$$;

create or replace function public.admin_logout(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if p_token is not null then
    delete from public.admin_sesiones where token = p_token;
  end if;
  return true;
end;
$$;

-- ------------------------------------------------------------
-- 7. Mesas (admin)
-- ------------------------------------------------------------

create or replace function public.admin_listar_mesas(p_token uuid)
returns setof public.mesas
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public._admin_assert(p_token);
  return query
    select * from public.mesas
     order by creado_en asc, nombre asc;
end;
$$;

create or replace function public.admin_crear_mesa(
  p_token uuid,
  p_nombre text,
  p_zona text,
  p_capacidad integer,
  p_foto_url text,
  p_activa boolean
)
returns public.mesas
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_nombre text := nullif(btrim(coalesce(p_nombre, '')), '');
  v_zona text := coalesce(nullif(btrim(coalesce(p_zona, '')), ''), 'salon');
  v_mesa public.mesas%rowtype;
begin
  perform public._admin_assert(p_token);

  if v_nombre is null or char_length(v_nombre) < 2 or char_length(v_nombre) > 40 then
    raise exception 'DATOS_INVALIDOS';
  end if;
  if v_zona not in ('salon', 'terraza') then
    raise exception 'DATOS_INVALIDOS';
  end if;
  if p_capacidad is null or p_capacidad < 1 or p_capacidad > 30 then
    raise exception 'CAPACIDAD_INVALIDA';
  end if;
  if exists (
    select 1 from public.mesas
     where lower(btrim(nombre)) = lower(v_nombre)
  ) then
    raise exception 'NOMBRE_DUPLICADO';
  end if;

  insert into public.mesas (nombre, zona, capacidad, foto_url, activa)
  values (
    v_nombre,
    v_zona,
    p_capacidad,
    nullif(btrim(coalesce(p_foto_url, '')), ''),
    coalesce(p_activa, true)
  )
  returning * into v_mesa;

  return v_mesa;
end;
$$;

create or replace function public.admin_actualizar_mesa(
  p_token uuid,
  p_id uuid,
  p_nombre text,
  p_zona text,
  p_capacidad integer,
  p_foto_url text,
  p_activa boolean
)
returns public.mesas
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_mesa public.mesas%rowtype;
  v_nombre text;
  v_zona text;
  v_capacidad integer;
  v_max_personas integer;
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_ahora time := (now() at time zone 'America/Bogota')::time;
begin
  perform public._admin_assert(p_token);

  select * into v_mesa
    from public.mesas
   where id = p_id
   for update;

  if not found then
    raise exception 'MESA_NO_ENCONTRADA';
  end if;

  -- null = conservar el valor (permite activar/desactivar sin reenviar todo).
  v_nombre := case
    when p_nombre is null then v_mesa.nombre
    else nullif(btrim(p_nombre), '')
  end;
  v_zona := coalesce(p_zona, v_mesa.zona);
  v_capacidad := coalesce(p_capacidad, v_mesa.capacidad);

  if v_nombre is null or char_length(v_nombre) < 2 or char_length(v_nombre) > 40 then
    raise exception 'DATOS_INVALIDOS';
  end if;
  if v_zona not in ('salon', 'terraza') then
    raise exception 'DATOS_INVALIDOS';
  end if;
  if v_capacidad < 1 or v_capacidad > 30 then
    raise exception 'CAPACIDAD_INVALIDA';
  end if;
  if exists (
    select 1 from public.mesas
     where id <> p_id
       and lower(btrim(nombre)) = lower(v_nombre)
  ) then
    raise exception 'NOMBRE_DUPLICADO';
  end if;

  -- No permitir bajar la capacidad por debajo de una reserva futura.
  select coalesce(max(num_personas), 0)
    into v_max_personas
    from public.reservas
   where mesa_id = p_id
     and estado = 'confirmada'
     and (
       fecha > v_hoy
       or (fecha = v_hoy and hora_fin >= v_ahora)
     );

  if v_capacidad < v_max_personas then
    raise exception 'MESA_CON_RESERVAS_FUTURAS';
  end if;

  update public.mesas
     set nombre = v_nombre,
         zona = v_zona,
         capacidad = v_capacidad,
         foto_url = case
           when p_foto_url is null then foto_url
           else nullif(btrim(p_foto_url), '')
         end,
         activa = coalesce(p_activa, activa)
   where id = p_id
  returning * into v_mesa;

  return v_mesa;
end;
$$;

create or replace function public.admin_eliminar_mesa(p_token uuid, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public._admin_assert(p_token);

  if exists (select 1 from public.reservas where mesa_id = p_id) then
    raise exception 'MESA_CON_RESERVAS';
  end if;

  begin
    delete from public.mesas where id = p_id;
  exception
    when foreign_key_violation then
      raise exception 'MESA_CON_RESERVAS';
  end;

  if not found then
    raise exception 'MESA_NO_ENCONTRADA';
  end if;

  return true;
end;
$$;

-- ------------------------------------------------------------
-- 8. Horarios (admin)
-- ------------------------------------------------------------

create or replace function public.admin_listar_horarios(p_token uuid)
returns setof public.horarios
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public._admin_assert(p_token);
  return query
    select * from public.horarios
     order by case dia_semana
       when 'lunes' then 1
       when 'martes' then 2
       when 'miércoles' then 3
       when 'jueves' then 4
       when 'viernes' then 5
       when 'sábado' then 6
       else 7
     end,
     case jornada when 'almuerzo' then 1 else 2 end;
end;
$$;

create or replace function public.admin_guardar_horarios(
  p_token uuid,
  p_horarios jsonb
)
returns setof public.horarios
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_item jsonb;
  v_dia text;
  v_jornada text;
  v_inicio time;
  v_fin time;
  v_duracion integer;
  v_activo boolean;
  v_key text;
  v_seen text[] := '{}';
  v_count integer;
begin
  perform public._admin_assert(p_token);

  if p_horarios is null or jsonb_typeof(p_horarios) <> 'array' then
    raise exception 'DATOS_INVALIDOS';
  end if;

  v_count := jsonb_array_length(p_horarios);
  if v_count <> 14 then
    raise exception 'DATOS_INVALIDOS';
  end if;

  -- Validar TODO antes de borrar.
  for v_item in select * from jsonb_array_elements(p_horarios)
  loop
    v_dia := v_item ->> 'dia_semana';
    v_jornada := v_item ->> 'jornada';

    if v_dia not in ('lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo') then
      raise exception 'DATOS_INVALIDOS';
    end if;
    if v_jornada not in ('almuerzo', 'noche') then
      raise exception 'DATOS_INVALIDOS';
    end if;

    if coalesce(v_item ->> 'hora_inicio', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
       or coalesce(v_item ->> 'hora_fin', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' then
      raise exception 'DATOS_INVALIDOS';
    end if;

    v_inicio := (v_item ->> 'hora_inicio')::time;
    v_fin := (v_item ->> 'hora_fin')::time;

    if v_fin <= v_inicio then
      raise exception 'DATOS_INVALIDOS';
    end if;

    if coalesce(v_item ->> 'duracion_slot', '') !~ '^\d+$' then
      raise exception 'DATOS_INVALIDOS';
    end if;

    v_duracion := (v_item ->> 'duracion_slot')::integer;
    if v_duracion < 30 or v_duracion > 180 then
      raise exception 'DATOS_INVALIDOS';
    end if;

    v_activo := coalesce((v_item ->> 'activo')::boolean, true);

    v_key := v_dia || '|' || v_jornada;
    if v_key = any(v_seen) then
      raise exception 'DATOS_INVALIDOS';
    end if;
    v_seen := array_append(v_seen, v_key);
  end loop;

  -- Reemplazo atómico de la matriz completa (7 días x 2 jornadas).
  delete from public.horarios;

  for v_item in select * from jsonb_array_elements(p_horarios)
  loop
    insert into public.horarios (
      dia_semana, jornada, hora_inicio, hora_fin, duracion_slot, activo
    )
    values (
      v_item ->> 'dia_semana',
      v_item ->> 'jornada',
      (v_item ->> 'hora_inicio')::time,
      (v_item ->> 'hora_fin')::time,
      (v_item ->> 'duracion_slot')::integer,
      coalesce((v_item ->> 'activo')::boolean, true)
    );
  end loop;

  return query
    select * from public.horarios
     order by case dia_semana
       when 'lunes' then 1
       when 'martes' then 2
       when 'miércoles' then 3
       when 'jueves' then 4
       when 'viernes' then 5
       when 'sábado' then 6
       else 7
     end,
     case jornada when 'almuerzo' then 1 else 2 end;
end;
$$;

-- ------------------------------------------------------------
-- 9. Reservas (admin)
-- ------------------------------------------------------------

create or replace function public.admin_listar_reservas(
  p_token uuid,
  p_fecha date default null,
  p_mesa_id uuid default null,
  p_estado text default null
)
returns table (
  id uuid,
  mesa_id uuid,
  cliente_nombre text,
  cliente_contacto text,
  num_personas integer,
  fecha date,
  hora_inicio time,
  hora_fin time,
  estado text,
  creado_en timestamptz,
  mesa_nombre text,
  mesa_zona text
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public._admin_assert(p_token);

  if p_estado is not null and p_estado <> ''
     and p_estado not in ('confirmada', 'cancelada', 'completada') then
    raise exception 'ESTADO_INVALIDO';
  end if;

  return query
    select
      r.id,
      r.mesa_id,
      r.cliente_nombre,
      r.cliente_contacto,
      r.num_personas,
      r.fecha,
      r.hora_inicio,
      r.hora_fin,
      r.estado,
      r.creado_en,
      coalesce(m.nombre, 'Mesa eliminada')::text as mesa_nombre,
      coalesce(m.zona, '')::text as mesa_zona
    from public.reservas r
    left join public.mesas m on m.id = r.mesa_id
    where (p_fecha is null or r.fecha = p_fecha)
      and (p_mesa_id is null or r.mesa_id = p_mesa_id)
      and (p_estado is null or p_estado = '' or r.estado = p_estado)
    order by r.fecha desc, r.hora_inicio desc, r.creado_en desc;
end;
$$;

create or replace function public.admin_actualizar_estado_reserva(
  p_token uuid,
  p_id uuid,
  p_estado text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_reserva public.reservas%rowtype;
  v_mesa public.mesas%rowtype;
begin
  perform public._admin_assert(p_token);

  if p_estado is null or p_estado not in ('confirmada', 'cancelada', 'completada') then
    raise exception 'ESTADO_INVALIDO';
  end if;

  select * into v_reserva
    from public.reservas
   where id = p_id
   for update;

  if not found then
    raise exception 'RESERVA_NO_ENCONTRADA';
  end if;

  begin
    update public.reservas
       set estado = p_estado
     where id = p_id
    returning * into v_reserva;
  exception
    when exclusion_violation then
      raise exception 'HORARIO_OCUPADO';
  end;

  select * into v_mesa
    from public.mesas
   where id = v_reserva.mesa_id;

  return to_jsonb(v_reserva) || jsonb_build_object(
    'mesa_nombre', coalesce(v_mesa.nombre, 'Mesa eliminada'),
    'mesa_zona', coalesce(v_mesa.zona, '')
  );
end;
$$;

-- ------------------------------------------------------------
-- 10. Carta (admin)
-- ------------------------------------------------------------

create or replace function public.admin_listar_platos(p_token uuid)
returns setof public.platos
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public._admin_assert(p_token);
  return query
    select * from public.platos
     order by case categoria
       when 'pizzas' then 1
       when 'entradas' then 2
       when 'postres' then 3
       else 4
     end,
     nombre asc;
end;
$$;

create or replace function public.admin_crear_plato(
  p_token uuid,
  p_nombre text,
  p_categoria text,
  p_descripcion text,
  p_precio numeric,
  p_disponible boolean,
  p_foto_url text
)
returns public.platos
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_nombre text := nullif(btrim(coalesce(p_nombre, '')), '');
  v_plato public.platos%rowtype;
begin
  perform public._admin_assert(p_token);

  if v_nombre is null or char_length(v_nombre) < 2 or char_length(v_nombre) > 60 then
    raise exception 'DATOS_INVALIDOS';
  end if;
  if p_categoria is null or p_categoria not in ('pizzas', 'entradas', 'postres', 'bebidas') then
    raise exception 'CATEGORIA_INVALIDA';
  end if;
  if p_precio is null or p_precio < 0 or p_precio > 100000000 then
    raise exception 'PRECIO_INVALIDO';
  end if;

  insert into public.platos (
    nombre, categoria, descripcion, precio, disponible, foto_url
  )
  values (
    v_nombre,
    p_categoria,
    nullif(btrim(coalesce(p_descripcion, '')), ''),
    round(p_precio)::integer,
    coalesce(p_disponible, true),
    nullif(btrim(coalesce(p_foto_url, '')), '')
  )
  returning * into v_plato;

  return v_plato;
end;
$$;

create or replace function public.admin_actualizar_plato(
  p_token uuid,
  p_id uuid,
  p_nombre text,
  p_categoria text,
  p_descripcion text,
  p_precio numeric,
  p_disponible boolean,
  p_foto_url text
)
returns public.platos
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_plato public.platos%rowtype;
  v_nombre text;
  v_categoria text;
  v_precio numeric;
begin
  perform public._admin_assert(p_token);

  select * into v_plato
    from public.platos
   where id = p_id
   for update;

  if not found then
    raise exception 'PLATO_NO_ENCONTRADO';
  end if;

  v_nombre := case
    when p_nombre is null then v_plato.nombre
    else nullif(btrim(p_nombre), '')
  end;
  v_categoria := coalesce(p_categoria, v_plato.categoria);
  v_precio := coalesce(p_precio, v_plato.precio);

  if v_nombre is null or char_length(v_nombre) < 2 or char_length(v_nombre) > 60 then
    raise exception 'DATOS_INVALIDOS';
  end if;
  if v_categoria not in ('pizzas', 'entradas', 'postres', 'bebidas') then
    raise exception 'CATEGORIA_INVALIDA';
  end if;
  if v_precio < 0 or v_precio > 100000000 then
    raise exception 'PRECIO_INVALIDO';
  end if;

  update public.platos
     set nombre = v_nombre,
         categoria = v_categoria,
         descripcion = case
           when p_descripcion is null then descripcion
           else nullif(btrim(p_descripcion), '')
         end,
         precio = round(v_precio)::integer,
         disponible = coalesce(p_disponible, disponible),
         foto_url = case
           when p_foto_url is null then foto_url
           else nullif(btrim(p_foto_url), '')
         end
   where id = p_id
  returning * into v_plato;

  return v_plato;
end;
$$;

create or replace function public.admin_eliminar_plato(p_token uuid, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform public._admin_assert(p_token);

  delete from public.platos where id = p_id;

  if not found then
    raise exception 'PLATO_NO_ENCONTRADO';
  end if;

  return true;
end;
$$;

-- ------------------------------------------------------------
-- 11. API pública de reservas
-- ------------------------------------------------------------

-- Devuelve SOLO mesa y rango horario ocupado: nunca datos del cliente.
create or replace function public.reservas_ocupadas(p_fecha date)
returns table (
  mesa_id uuid,
  hora_inicio time,
  hora_fin time
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if p_fecha is null then
    raise exception 'FECHA_INVALIDA';
  end if;

  return query
    select r.mesa_id, r.hora_inicio, r.hora_fin
      from public.reservas r
     where r.fecha = p_fecha
       and r.estado = 'confirmada'
     order by r.hora_inicio asc;
end;
$$;

create or replace function public.crear_reserva(
  p_mesa_id uuid,
  p_cliente_nombre text,
  p_cliente_contacto text,
  p_num_personas integer,
  p_fecha date,
  p_hora_inicio time
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_mesa public.mesas%rowtype;
  v_horario public.horarios%rowtype;
  v_reserva public.reservas%rowtype;
  v_nombre text := nullif(btrim(coalesce(p_cliente_nombre, '')), '');
  v_contacto text := nullif(btrim(coalesce(p_cliente_contacto, '')), '');
  v_dia text;
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_ahora time := (now() at time zone 'America/Bogota')::time;
  v_fin time;
begin
  if v_nombre is null or char_length(v_nombre) < 2 then
    raise exception 'NOMBRE_REQUERIDO';
  end if;
  if char_length(v_nombre) > 120 then
    raise exception 'DATOS_INVALIDOS';
  end if;
  if p_mesa_id is null then
    raise exception 'MESA_NO_ENCONTRADA';
  end if;
  if p_fecha is null then
    raise exception 'FECHA_INVALIDA';
  end if;
  if p_hora_inicio is null then
    raise exception 'HORARIO_INVALIDO';
  end if;

  if p_fecha < v_hoy then
    raise exception 'FECHA_PASADA';
  end if;
  if p_fecha > v_hoy + 60 then
    raise exception 'FECHA_INVALIDA';
  end if;

  if p_num_personas is null or p_num_personas < 1 or p_num_personas > 30 then
    raise exception 'CAPACIDAD_INVALIDA';
  end if;

  select * into v_mesa
    from public.mesas
   where id = p_mesa_id;

  if not found then
    raise exception 'MESA_NO_ENCONTRADA';
  end if;
  if not v_mesa.activa then
    raise exception 'MESA_INACTIVA';
  end if;
  if p_num_personas > v_mesa.capacidad then
    raise exception 'CAPACIDAD_EXCEDIDA';
  end if;

  v_dia := case extract(dow from p_fecha)::integer
    when 0 then 'domingo'
    when 1 then 'lunes'
    when 2 then 'martes'
    when 3 then 'miércoles'
    when 4 then 'jueves'
    when 5 then 'viernes'
    else 'sábado'
  end;

  select * into v_horario
    from public.horarios h
   where h.dia_semana = v_dia
     and h.activo = true
     and p_hora_inicio >= h.hora_inicio
     and p_hora_inicio + make_interval(mins => h.duracion_slot) <= h.hora_fin
     and mod(
       (extract(epoch from (p_hora_inicio - h.hora_inicio)) / 60)::integer,
       h.duracion_slot
     ) = 0
   order by h.hora_inicio asc
   limit 1;

  if not found then
    raise exception 'HORARIO_INVALIDO';
  end if;

  if p_fecha = v_hoy and p_hora_inicio < v_ahora + interval '15 minutes' then
    raise exception 'SLOT_PASADO';
  end if;

  v_fin := p_hora_inicio + make_interval(mins => v_horario.duracion_slot);

  -- Serializa las reservas de la misma mesa y fecha. La restricción
  -- de exclusión sigue siendo la última línea de defensa ante carreras.
  perform pg_advisory_xact_lock(
    hashtextextended('konys:' || p_mesa_id::text || ':' || p_fecha::text, 0)
  );

  if exists (
    select 1
      from public.reservas r
     where r.mesa_id = p_mesa_id
       and r.fecha = p_fecha
       and r.estado = 'confirmada'
       and r.hora_inicio < v_fin
       and r.hora_fin > p_hora_inicio
  ) then
    raise exception 'HORARIO_OCUPADO';
  end if;

  begin
    insert into public.reservas (
      mesa_id, cliente_nombre, cliente_contacto, num_personas,
      fecha, hora_inicio, hora_fin, estado
    )
    values (
      p_mesa_id, v_nombre, v_contacto, p_num_personas,
      p_fecha, p_hora_inicio, v_fin, 'confirmada'
    )
    returning * into v_reserva;
  exception
    when exclusion_violation then
      raise exception 'HORARIO_OCUPADO';
  end;

  return jsonb_build_object(
    'reserva', to_jsonb(v_reserva) || jsonb_build_object(
      'mesa_nombre', v_mesa.nombre,
      'mesa_zona', v_mesa.zona
    )
  );
end;
$$;

-- ------------------------------------------------------------
-- 12. Permisos de funciones
-- ------------------------------------------------------------

revoke all on function public._konys_client_ip() from public;
revoke all on function public._admin_assert(uuid) from public;

revoke all on function public.admin_login(text) from public;
revoke all on function public.admin_sesion_valida(uuid) from public;
revoke all on function public.admin_logout(uuid) from public;
revoke all on function public.admin_listar_mesas(uuid) from public;
revoke all on function public.admin_crear_mesa(uuid, text, text, integer, text, boolean) from public;
revoke all on function public.admin_actualizar_mesa(uuid, uuid, text, text, integer, text, boolean) from public;
revoke all on function public.admin_eliminar_mesa(uuid, uuid) from public;
revoke all on function public.admin_listar_horarios(uuid) from public;
revoke all on function public.admin_guardar_horarios(uuid, jsonb) from public;
revoke all on function public.admin_listar_reservas(uuid, date, uuid, text) from public;
revoke all on function public.admin_actualizar_estado_reserva(uuid, uuid, text) from public;
revoke all on function public.admin_listar_platos(uuid) from public;
revoke all on function public.admin_crear_plato(uuid, text, text, text, numeric, boolean, text) from public;
revoke all on function public.admin_actualizar_plato(uuid, uuid, text, text, text, numeric, boolean, text) from public;
revoke all on function public.admin_eliminar_plato(uuid, uuid) from public;
revoke all on function public.reservas_ocupadas(date) from public;
revoke all on function public.crear_reserva(uuid, text, text, integer, date, time) from public;

grant execute on function public.admin_login(text) to anon, authenticated;
grant execute on function public.admin_sesion_valida(uuid) to anon, authenticated;
grant execute on function public.admin_logout(uuid) to anon, authenticated;
grant execute on function public.admin_listar_mesas(uuid) to anon, authenticated;
grant execute on function public.admin_crear_mesa(uuid, text, text, integer, text, boolean) to anon, authenticated;
grant execute on function public.admin_actualizar_mesa(uuid, uuid, text, text, integer, text, boolean) to anon, authenticated;
grant execute on function public.admin_eliminar_mesa(uuid, uuid) to anon, authenticated;
grant execute on function public.admin_listar_horarios(uuid) to anon, authenticated;
grant execute on function public.admin_guardar_horarios(uuid, jsonb) to anon, authenticated;
grant execute on function public.admin_listar_reservas(uuid, date, uuid, text) to anon, authenticated;
grant execute on function public.admin_actualizar_estado_reserva(uuid, uuid, text) to anon, authenticated;
grant execute on function public.admin_listar_platos(uuid) to anon, authenticated;
grant execute on function public.admin_crear_plato(uuid, text, text, text, numeric, boolean, text) to anon, authenticated;
grant execute on function public.admin_actualizar_plato(uuid, uuid, text, text, text, numeric, boolean, text) to anon, authenticated;
grant execute on function public.admin_eliminar_plato(uuid, uuid) to anon, authenticated;
grant execute on function public.reservas_ocupadas(date) to anon, authenticated;
grant execute on function public.crear_reserva(uuid, text, text, integer, date, time) to anon, authenticated;

-- ------------------------------------------------------------
-- 13. Cambiar la contraseña del panel (ejecutar manualmente)
-- ------------------------------------------------------------
-- update public.admin_config
--    set password_hash = crypt('TU_NUEVA_CLAVE_SEGURA', gen_salt('bf', 12)),
--        actualizado_en = now()
--  where id = true;
--
-- Para cerrar todas las sesiones activas:
-- delete from public.admin_sesiones;
