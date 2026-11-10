# Base de datos

Motor: **PostgreSQL** administrado por Supabase. Esquema público `public`.

Scripts:

- `supabase/schema.sql`: instalación completa (tablas, RLS, constraints, RPCs).
- `supabase/seed.sql`: datos de demostración idempotentes.

---

## 1. Modelo relacional

```text
mesas 1 ──────── N reservas
  id (PK)             id (PK)
  nombre (único)      mesa_id (FK → mesas.id, ON DELETE RESTRICT)
  zona                cliente_nombre
  capacidad           cliente_contacto
  activa              num_personas
  foto_url            fecha
  creado_en           hora_inicio
                      hora_fin
                      estado
                      inicio_ts (generado)
                      fin_ts (generado)
                      creado_en

horarios (independiente, configuración global)
  id (PK)
  dia_semana + jornada (único)
  hora_inicio, hora_fin, duracion_slot, activo

platos (independiente)
  id (PK), nombre, categoria, descripcion, precio,
  disponible, foto_url, creado_en

admin_config (singleton)
admin_sesiones (tokens)
admin_intentos (rate limit)
```

`reservas` no guarda una copia de la mesa: la relación es por `mesa_id` y se conserva aunque la mesa se desactive. La eliminación de una mesa con reservas está bloqueada.

---

## 2. Tablas

### `mesas`

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid | PK, `gen_random_uuid()` |
| `nombre` | text | 2–40 caracteres, único sin distinguir mayúsculas/espacios |
| `zona` | text | `salon` o `terraza` |
| `capacidad` | integer | 1–30 |
| `activa` | boolean | por defecto `true` |
| `foto_url` | text | opcional |
| `creado_en` | timestamptz | `now()` |

### `horarios`

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid | PK |
| `dia_semana` | text | lunes…domingo (con tildes) |
| `jornada` | text | `almuerzo` o `noche` |
| `hora_inicio` | time | — |
| `hora_fin` | time | debe ser mayor que `hora_inicio` |
| `duracion_slot` | integer | 30–180, por defecto 60 |
| `activo` | boolean | por defecto `true` |

Restricción única: `(dia_semana, jornada)`. La matriz esperada es de 14 filas.

### `reservas`

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid | PK |
| `mesa_id` | uuid | FK `mesas.id`, `ON DELETE RESTRICT` |
| `cliente_nombre` | text | 2–120 |
| `cliente_contacto` | text | opcional |
| `num_personas` | integer | 1–30 |
| `fecha` | date | — |
| `hora_inicio` | time | — |
| `hora_fin` | time | mayor que `hora_inicio` |
| `estado` | text | `confirmada`, `cancelada`, `completada` |
| `inicio_ts` | timestamptz generado | `(fecha + hora_inicio) AT TIME ZONE 'America/Bogota'` |
| `fin_ts` | timestamptz generado | `(fecha + hora_fin) AT TIME ZONE 'America/Bogota'` |
| `creado_en` | timestamptz | `now()` |

**Restricción anti-doble-reserva:**

```sql
constraint reservas_sin_solape exclude using gist (
  mesa_id with =,
  tstzrange(inicio_ts, fin_ts, '[)') with &&
) where (estado = 'confirmada')
```

Solo aplica a reservas confirmadas. Una reserva cancelada libera el horario. Al reconfirmar, PostgreSQL vuelve a validar el rango.

### `platos`

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid | PK |
| `nombre` | text | 2–60 |
| `categoria` | text | `pizzas`, `entradas`, `postres`, `bebidas` |
| `descripcion` | text | opcional |
| `precio` | integer | ≥ 0 |
| `disponible` | boolean | por defecto `true` |
| `foto_url` | text | opcional |
| `creado_en` | timestamptz | `now()` |

### Tablas administrativas

- `admin_config`: fila única (`id = true`), `password_hash` bcrypt, `actualizado_en`.
- `admin_sesiones`: `token` UUID PK, `creado_en`, `ultimo_uso`, `expira_en`.
- `admin_intentos`: `id` identity, `ip`, `exito`, `creado_en`. Se limpia al hacer login.

---

## 3. Row Level Security

| Tabla | SELECT anónimo | Escritura anónima | Notas |
|---|---|---|---|
| `mesas` | solo `activa = true` | denegada | RPC admin |
| `horarios` | solo `activo = true` | denegada | RPC admin |
| `platos` | solo `disponible = true` | denegada | RPC admin |
| `reservas` | **denegada** | denegada | RPC `reservas_ocupadas`, `crear_reserva` |
| `admin_config` | denegada | denegada | RPC login |
| `admin_sesiones` | denegada | denegada | RPC login/logout |
| `admin_intentos` | denegada | denegada | RPC login |

Los grants de tabla se revocan explícitamente y se vuelven a conceder solo para lecturas públicas. Las funciones `SECURITY DEFINER` son propietarias del esquema y omiten RLS de forma controlada.

---

## 4. RPCs públicas

| Función | Parámetros | Retorno | Uso |
|---|---|---|---|
| `reservas_ocupadas` | `p_fecha date` | `table(mesa_id uuid, hora_inicio time, hora_fin time)` | Disponibilidad. No expone PII. |
| `crear_reserva` | `p_mesa_id uuid, p_cliente_nombre text, p_cliente_contacto text, p_num_personas int, p_fecha date, p_hora_inicio time` | `jsonb { reserva: {...} }` | Alta segura de reserva. |

### Validaciones de `crear_reserva`

- Nombre obligatorio (≥ 2 caracteres, ≤ 120).
- Fecha no pasada y máximo +60 días.
- 1–30 personas.
- Mesa existente y activa.
- Capacidad de la mesa.
- Jornada activa del día.
- Inicio alineado a `duracion_slot`.
- Fin dentro de la jornada.
- Anticipación mínima de 15 minutos si es hoy.
- Sin solapamiento con otra reserva confirmada.
- Advisory lock por mesa+fecha.
- Restricción de exclusión como última defensa.

---

## 5. RPCs administrativas

Todas reciben `p_token uuid` como primer parámetro y llaman a `_admin_assert`.

| Función | Parámetros adicionales | Retorno |
|---|---|---|
| `admin_login` | `p_password text` | `jsonb { token, expira_en }` |
| `admin_sesion_valida` | — | `boolean` |
| `admin_logout` | — | `boolean` |
| `admin_listar_mesas` | — | `setof mesas` |
| `admin_crear_mesa` | `p_nombre, p_zona, p_capacidad, p_foto_url, p_activa` | `mesas` |
| `admin_actualizar_mesa` | `p_id, p_nombre, p_zona, p_capacidad, p_foto_url, p_activa` | `mesas` |
| `admin_eliminar_mesa` | `p_id` | `boolean` |
| `admin_listar_horarios` | — | `setof horarios` |
| `admin_guardar_horarios` | `p_horarios jsonb` | `setof horarios` |
| `admin_listar_reservas` | `p_fecha, p_mesa_id, p_estado` (opcionales) | tabla con datos de mesa |
| `admin_actualizar_estado_reserva` | `p_id, p_estado` | `jsonb` |
| `admin_listar_platos` | — | `setof platos` |
| `admin_crear_plato` | `p_nombre, p_categoria, p_descripcion, p_precio, p_disponible, p_foto_url` | `platos` |
| `admin_actualizar_plato` | `p_id, ...` | `platos` |
| `admin_eliminar_plato` | `p_id` | `boolean` |

### Semántica de actualización

En `admin_actualizar_mesa` y `admin_actualizar_plato`, **`null` significa “conservar el valor actual”**. Esto permite que los toggles envíen solo el campo que cambia.

- `p_foto_url = null` → conservar foto.
- `p_foto_url = ''` → borrar foto.
- `p_descripcion = null` → conservar descripción.
- `p_descripcion = ''` → borrar descripción.

`admin_guardar_horarios` reemplaza la matriz completa de 14 filas de forma atómica. Si una fila es inválida, no se borra nada.

---

## 6. Códigos de error

El frontend traduce los mensajes de PostgreSQL que contienen estos códigos:

| Código | Significado |
|---|---|
| `HORARIO_OCUPADO` | La mesa ya tiene una reserva confirmada en ese rango. |
| `MESA_INACTIVA` | La mesa no está disponible. |
| `MESA_NO_ENCONTRADA` | ID de mesa inexistente. |
| `CAPACIDAD_EXCEDIDA` | Personas > capacidad de la mesa. |
| `CAPACIDAD_INVALIDA` | Capacidad fuera de 1–30. |
| `FECHA_INVALIDA` | Fecha nula, fuera de rango o mal formada. |
| `FECHA_PASADA` | Fecha anterior a hoy en Bogotá. |
| `FUERA_DE_HORARIO` | Jornada no activa. |
| `HORARIO_INVALIDO` | Slot no alineado o fuera de jornada. |
| `SLOT_PASADO` | Menos de 15 minutos de anticipación. |
| `NOMBRE_REQUERIDO` | Nombre vacío o demasiado corto. |
| `NOMBRE_DUPLICADO` | Mesa con el mismo nombre. |
| `MESA_CON_RESERVAS` | No se puede eliminar una mesa con historial. |
| `MESA_CON_RESERVAS_FUTURAS` | Capacidad menor que una reserva futura. |
| `SESION_INVALIDA` | Token ausente, vencido o inválido. |
| `CLAVE_INCORRECTA` | Contraseña administrativa errónea. |
| `DEMASIADOS_INTENTOS` | Rate limit de login. |
| `ESTADO_INVALIDO` | Estado de reserva no permitido. |
| `RESERVA_NO_ENCONTRADA` | ID de reserva inexistente. |
| `PLATO_NO_ENCONTRADO` | ID de plato inexistente. |
| `CATEGORIA_INVALIDA` | Categoría fuera del catálogo. |
| `PRECIO_INVALIDO` | Precio negativo o fuera de rango. |
| `DATOS_INVALIDOS` | Validación genérica. |
| `FUNCION_NO_INSTALADA` | Falta ejecutar `schema.sql`. |
| `CONEXION` | Error de red, credenciales o PostgREST. |

---

## 7. Operaciones de mantenimiento

### Cambiar la contraseña

```sql
update public.admin_config
   set password_hash = crypt('NUEVA_CLAVE', gen_salt('bf', 12)),
       actualizado_en = now()
 where id = true;

delete from public.admin_sesiones;
```

### Cerrar todas las sesiones

```sql
delete from public.admin_sesiones;
```

### Ver reservas de hoy

```sql
select r.*, m.nombre as mesa
  from public.reservas r
  join public.mesas m on m.id = r.mesa_id
 where r.fecha = (now() at time zone 'America/Bogota')::date
 order by r.hora_inicio;
```

### Verificar la restricción anti-doble-reserva

```sql
select conname, pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid = 'public.reservas'::regclass
   and conname = 'reservas_sin_solape';
```

### Reinstalar desde cero (desarrollo)

Solo en un proyecto de prueba, nunca en producción con datos reales:

```sql
drop table if exists public.reservas cascade;
drop table if exists public.horarios cascade;
drop table if exists public.platos cascade;
drop table if exists public.mesas cascade;
drop table if exists public.admin_config cascade;
drop table if exists public.admin_sesiones cascade;
drop table if exists public.admin_intentos cascade;
```

Después vuelve a ejecutar `schema.sql` y `seed.sql`.
