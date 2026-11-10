# Arquitectura

## 1. Vista general

Konys Pizza es una aplicación estática de dos páginas con una capa de datos intercambiable:

```text
┌─────────────────────────────┐      ┌─────────────────────────────┐
│ index.html                  │      │ admin.html                  │
│ js/cliente.js               │      │ js/admin.js                 │
└──────────────┬──────────────┘      └──────────────┬──────────────┘
               │                                    │
               └──────────────┬─────────────────────┘
                              ▼
                    js/supabase.js
             ┌────────────────┴────────────────┐
             ▼                                 ▼
     SupabaseBackend                    LocalBackend
     SDK + RPCs + RLS                   localStorage (demo)
             │
             ▼
     PostgreSQL / PostgREST
     tablas + funciones SECURITY DEFINER
```

### Decisión clave

`js/supabase.js` expone una fachada (`window.KonysAPI`) con dos implementaciones:

- **`SupabaseBackend`**: usa el SDK oficial y llama RPCs. Las tablas públicas se leen directamente con RLS.
- **`LocalBackend`**: simula la misma API con `localStorage` para revisar el proyecto sin credenciales.

La selección ocurre en `js/config.js`:

- Si `SUPABASE_URL` y `SUPABASE_ANON_KEY` existen y son válidas → Supabase.
- Si ambas están vacías → demo.
- Si Supabase está configurado pero falla → se muestra un error. **Nunca** se cae silenciosamente al modo demo.

Esto evita el peor escenario en una demo: mostrar una confirmación local cuando la base de datos real no respondió.

---

## 2. Capas

### 2.1 Presentación

- `index.html`: secciones `#inicio`, `#mesas`, `#sobre`, `#carta`, `#reservar`, `#contacto`.
- `admin.html`: login y shell con secciones `#mesas`, `#horarios`, `#reservas`, `#carta`.
- `css/styles.css`: tokens, tipografía, componentes compartidos (botones, campos, diálogos, toasts, badges).
- `css/admin.css`: layout del panel, login, tablas, filtros, switches, métricas y responsive.

### 2.2 Utilidades compartidas

`js/ui.js` contiene:

- Fechas en español, ISO local y claves de día.
- Formato de hora 12 h y moneda COP.
- Calendario accesible.
- Toasts, diálogos nativos y confirmaciones.
- `setButtonLoading`, `debounce`, normalización de texto/teléfono.
- Revelado por intersección y navegación del sitio.

### 2.3 Lógica de negocio

- `js/cliente.js`: carga de mesas/horarios/carta, disponibilidad, validaciones del formulario, creación de reserva, reintento/conflicto y pantalla de éxito.
- `js/admin.js`: sesión, enrutamiento por hash, métricas, CRUD de mesas y platos, edición de horarios, filtros y estados de reservas.

### 2.4 Datos

- `js/supabase.js`: normalización de filas, mapeo de errores, backend demo y backend Supabase.
- `supabase/schema.sql`: tablas, checks, índices, RLS, grants, restricción de exclusión y RPCs.
- `supabase/seed.sql`: datos iniciales idempotentes.

---

## 3. Flujo de una reserva

1. El cliente elige fecha en el calendario (hoy → +60 días).
2. `cliente.js` pide mesas activas, horarios activos y ocupación del día.
3. La UI calcula slots válidos:
   - dentro de una jornada activa;
   - alineados al inicio de la jornada según `duracion_slot`;
   - con anticipación mínima de 15 minutos si es hoy;
   - sin solaparse con reservas confirmadas de la mesa.
4. El cliente elige mesa, hora y completa sus datos.
5. Antes de enviar, el frontend revalida y luego llama `crear_reserva`.
6. PostgreSQL:
   - valida fecha, nombre, personas y mesa;
   - busca la jornada activa;
   - verifica granularidad y anticipación;
   - toma un advisory lock por mesa+día;
   - verifica solapamiento;
   - inserta; la restricción de exclusión es la última defensa.
7. La fila insertada se devuelve al navegador y se muestra un código `KP-XXXXXX` derivado del ID real. **No hay confirmación simulada.**

---

## 4. Flujo del panel

1. `admin.html` carga `env.js → config.js → supabase.js → ui.js → admin.js`.
2. `admin.js` inicializa el backend y verifica la sesión almacenada en `sessionStorage`.
3. Si no hay sesión válida, muestra el login.
4. `admin_login` valida el hash bcrypt, aplica rate limit y crea un token con expiración de 8 h.
5. Cada operación administrativa envía `p_token` a una RPC `admin_*`.
6. `_admin_assert` valida token y expiración; si falla, se lanza `SESION_INVALIDA`.
7. El frontend limpia el token, muestra el login y avisa que la sesión expiró.

### Enrutamiento

El panel usa `location.hash` (`#mesas`, `#horarios`, `#reservas`, `#carta`). No hay router externo. `hashchange` y `popstate` mantienen la sección activa; los enlaces del sidebar actualizan el hash.

---

## 5. Seguridad

### Modelo de confianza

| Actor | Puede |
|---|---|
| Anónimo (anon key) | Leer mesas activas, horarios activos y platos disponibles; llamar `reservas_ocupadas` y `crear_reserva`. |
| Anónimo con token de sesión | Llamar RPCs `admin_*`; cada una valida el token. |
| `service_role` | Solo servidor/administración. **Nunca** en el frontend. |

### Defensas

- RLS activo en las siete tablas.
- Sin políticas para `reservas`, `admin_config`, `admin_sesiones` ni `admin_intentos`.
- Grants de escritura revocados a `anon` y `authenticated` sobre todas las tablas.
- Escrituras a través de `SECURITY DEFINER` con `search_path = public, pg_temp`.
- Contraseña con bcrypt (`gen_salt('bf', 12)`).
- Rate limit por IP con `admin_intentos`.
- Token UUID aleatorio, expiración y cierre explícito.
- Restricción de exclusión para integridad de reservas.
- Validación de `service_role` en `scripts/build.mjs`.

### Lo que el frontend no hace

- No guarda la contraseña.
- No compara contraseñas.
- No usa la service role.
- No escribe tablas directamente.
- No confía en el precio ni en los cálculos del cliente para operaciones administrativas: el SQL valida de nuevo.

---

## 6. Modo demo

`LocalBackend` replica:

- IDs UUID, fechas relativas, mesas, horarios, platos y reservas.
- Validaciones de capacidad, jornada, anticipación y solapamiento.
- Login con `konys2026` y sesión en `sessionStorage`.
- CRUD completo y persistencia en `localStorage` (`konys_demo_v1`).

Está pensado para evaluación y para desarrolladores sin credenciales. No debe usarse como backend de producción.

---

## 7. Rendimiento y accesibilidad

- Sin frameworks ni dependencias de runtime más allá del SDK de Supabase autoalojado.
- Imágenes WebP locales, dimensiones declaradas y `loading="lazy"` fuera del hero.
- Fuentes autoalojadas con `font-display: swap` y precarga.
- CSS con tokens y componentes reutilizables.
- Estados de foco visibles, etiquetas asociadas, `aria-expanded`, `aria-pressed`, `aria-current`.
- Diálogos nativos `<dialog>` con cierre por teclado.
- `prefers-reduced-motion` desactiva animaciones.
- Tablas con scroll horizontal en móvil, sin romper el layout.
- `noindex, nofollow` en el panel.

---

## 8. Decisiones y trade-offs

| Decisión | Motivo |
|---|---|
| RPCs en lugar de tablas para el admin | Evita exponer escrituras y centraliza validaciones en PostgreSQL. |
| Token en `sessionStorage` | Se borra al cerrar la pestaña; no persiste como una cookie de larga duración. |
| Un solo rol administrativo | El brief pide “equipo Konys”, no multiusuario. |
| Demo con `localStorage` | Permite revisar todo sin cuentas; se desactiva al configurar Supabase. |
| Restricción de exclusión + advisory lock | Doble defensa contra carreras en reservas concurrentes. |
| Zona horaria `America/Bogota` en SQL | Evita errores si Supabase ejecuta en UTC. |
| Sin backend propio | Requisito explícito del parcial. |
