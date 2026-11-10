# Plan de pruebas

Objetivo: verificar que la aplicación cumple el flujo completo sin confirmaciones falsas, sin errores de consola y sin accesos indebidos.

## 0. Preparación

```bash
npm run check
npm run dev
```

Abre <http://127.0.0.1:4173> y <http://127.0.0.1:4173/admin>.

Si estás en modo demo, el aviso del login debe indicar la contraseña `konys2026`. Si configuraste Supabase, el aviso no debe aparecer y el chip debe decir “Supabase conectado”.

Antes de cada corrida de demo, puedes limpiar los datos locales desde DevTools:

```js
localStorage.removeItem("konys_demo_v1");
sessionStorage.clear();
location.reload();
```

---

## 1. Sitio público

| # | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| 1.1 | Carga inicial | Abrir `/` | Hero, mesas, carta y formulario visibles; sin errores en consola. |
| 1.2 | Navegación | Usar el menú y el menú móvil | Scroll a la sección correcta, foco y `aria-expanded` coherentes. |
| 1.3 | Filtro de mesas | Elegir “Salón” o “Terraza” | Solo se muestran mesas de la zona, con capacidad correcta. |
| 1.4 | Carta | Cambiar categorías | Se filtran platos; “Brownie” no aparece porque está agotado. |
| 1.5 | Fecha pasada | Intentar seleccionar ayer | El calendario no permite seleccionarla. |
| 1.6 | Fecha lejana | Intentar seleccionar +61 días | Deshabilitada. |
| 1.7 | Día sin horario | Desactivar ambas jornadas de un día desde el admin y volver al cliente | Ese día aparece cerrado / sin slots. |
| 1.8 | Slot pasado | Hoy, elegir un horario con menos de 15 min | No disponible o error `SLOT_PASADO` al confirmar. |
| 1.9 | Reserva exitosa | Elegir fecha futura, mesa disponible, hora válida, nombre y contacto | Aparece diálogo con código `KP-XXXXXX` y la reserva existe en el admin. |
| 1.10 | Capacidad | Intentar reservar 8 personas en Mesa 1 (2) | Bloqueado con mensaje de capacidad. |
| 1.11 | Mesa inactiva | Desactivar una mesa y recargar el cliente | La mesa no se ofrece. |
| 1.12 | Doble reserva | Confirmar una reserva y repetir misma mesa/hora | Error “Ese horario acaba de ser reservado…” y no se crea una segunda fila. |
| 1.13 | Carrera | Abrir dos pestañas, misma mesa/hora, confirmar casi al mismo tiempo | Solo una reserva se crea; la otra recibe `HORARIO_OCUPADO`. |
| 1.14 | Recarga tras reservar | Recargar y consultar disponibilidad | El horario reservado aparece ocupado. |
| 1.15 | Sin conexión | Configurar Supabase y bloquear la red / usar URL inválida | Se muestra error; no se simula una reserva local. |

---

## 2. Login administrativo

| # | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| 2.1 | Acceso demo | `/admin`, contraseña `konys2026` | Entra al panel y muestra el chip de modo demo. |
| 2.2 | Contraseña incorrecta | Introducir una clave errónea | Mensaje “La contraseña no es correcta”; no entra. |
| 2.3 | Campo vacío | Enviar sin contraseña | Validación local, sin llamada. |
| 2.4 | Mostrar/ocultar | Pulsar el ojo | El tipo del input cambia y `aria-pressed` se actualiza. |
| 2.5 | Sesión persistente | Recargar dentro de la misma pestaña | Mantiene la sesión (`sessionStorage`). |
| 2.6 | Cerrar sesión | Pulsar “Cerrar sesión” | Vuelve al login y el token se elimina. |
| 2.7 | Sesión expirada | Borrar la sesión desde DevTools y ejecutar una acción | Mensaje de sesión expirada y retorno al login. |
| 2.8 | Rate limit (Supabase) | Fallar 8 veces en 15 minutos | `DEMASIADOS_INTENTOS`; espera antes de reintentar. |
| 2.9 | Ruta directa | Abrir `/#reservas` con sesión | Entra directamente a Reservas. |

---

## 3. Mesas

| # | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| 3.1 | Listar | Abrir Mesas | Filas con nombre, zona, capacidad, switch y acciones. |
| 3.2 | Buscar | Escribir “terraza” o “mesa 4” | Filtra en vivo; el contador cambia. |
| 3.3 | Crear | Nueva mesa, datos válidos, guardar | Se crea, aparece en la tabla y en el filtro de reservas. |
| 3.4 | Crear duplicada | Mismo nombre con mayúsculas/espacios | `NOMBRE_DUPLICADO`. |
| 3.5 | Capacidad inválida | 0, 31 o vacío | Validación; no se guarda. |
| 3.6 | Editar | Cambiar nombre, zona, capacidad y foto | Se actualiza y se refleja en el cliente. |
| 3.7 | Borrar foto | Dejar el campo de foto vacío y guardar | La foto se elimina (no se conserva). |
| 3.8 | Desactivar | Apagar el switch | La mesa desaparece del cliente, pero sigue en el admin. |
| 3.9 | Activar | Encender el switch | Vuelve al cliente. |
| 3.10 | Eliminar | Confirmar eliminación de una mesa sin reservas | Se borra tras la confirmación. |
| 3.11 | Eliminar con reservas | Intentar borrar una mesa con historial | Error `MESA_CON_RESERVAS`; sugiere desactivar. |
| 3.12 | Bajar capacidad | Mesa con reserva futura de 6; bajar a 4 | `MESA_CON_RESERVAS_FUTURAS`. |

---

## 4. Horarios

| # | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| 4.1 | Matriz | Abrir Horarios | 7 filas, 4 horas y dos switches por fila. |
| 4.2 | Editar horas | Cambiar almuerzo a 12:00–15:00 y guardar | Se guarda; el cliente genera slots desde 12:00. |
| 4.3 | Fin anterior al inicio | Poner fin 11:00 con inicio 12:00 | Validación, campos marcados, no se guarda. |
| 4.4 | Cerrar jornada | Apagar “Noche” del lunes y guardar | El lunes no ofrece horarios nocturnos. |
| 4.5 | Copiar lunes | Configurar lunes y pulsar “Copiar lunes a todos” | Se copian horas y switches a los demás días; aún no se guarda. |
| 4.6 | Duración | Elegir 90 minutos y guardar | Los slots del cliente cambian a bloques de 90. |
| 4.7 | Matriz incompleta | Manipular el DOM para quitar una fila | El frontend no envía 14 filas; el SQL también rechaza. |
| 4.8 | Día cerrado | Apagar ambas jornadas del domingo | El domingo no permite reservar. |

---

## 5. Reservas

| # | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| 5.1 | Listar | Abrir Reservas | Cliente, mesa, fecha, hora, personas, estado y acciones. |
| 5.2 | Filtro fecha | Elegir una fecha | Solo reservas de esa fecha. |
| 5.3 | Filtro mesa | Elegir Mesa 2 | Solo reservas de esa mesa. |
| 5.4 | Filtro estado | Elegir Canceladas | Solo canceladas. |
| 5.5 | Combinar filtros | Fecha + mesa + estado | Intersección correcta. |
| 5.6 | Limpiar | Pulsar Limpiar | Vuelve a todas las reservas. |
| 5.7 | Detalle | Pulsar el ojo | Muestra código, cliente, contacto, mesa, fecha, hora, personas y creación. |
| 5.8 | Completar | Cambiar a Completada | Estado actualizado y métricas recalculadas. |
| 5.9 | Cancelar | Cambiar a Cancelada y confirmar | Estado cancelado; el horario vuelve a estar disponible en el cliente. |
| 5.10 | Reconfirmar | Pasar una cancelada a Confirmada | Se revalida solapamiento; si hay conflicto, `HORARIO_OCUPADO`. |
| 5.11 | Cancelar desde detalle | Abrir detalle y pulsar “Cancelar reserva” | Confirmación y actualización. |
| 5.12 | Actualizar | Pulsar “Actualizar” | Vuelve a consultar y avisa que los datos están al día. |
| 5.13 | PII pública | Llamar `reservas_ocupadas` con curl | Solo devuelve mesa y horas, sin nombre/contacto. |

Ejemplo de verificación de PII:

```bash
curl -s "https://TU-PROYECTO.supabase.co/rest/v1/rpc/reservas_ocupadas" \
  -H "apikey: TU_ANON_KEY" \
  -H "Authorization: Bearer TU_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_fecha":"2026-11-06"}'
```

---

## 6. Carta

| # | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| 6.1 | Listar | Abrir Carta | Productos con foto, categoría, descripción, precio, switch y acciones. |
| 6.2 | Filtros | Cambiar categoría | Filtra y actualiza contadores. |
| 6.3 | Crear | Agregar producto válido | Aparece en la carta pública. |
| 6.4 | Precio vacío | Enviar sin precio | Validación local; no se guarda. |
| 6.5 | Precio negativo | `-1000` | `PRECIO_INVALIDO` o validación. |
| 6.6 | Categoría inválida | Manipular el select | `CATEGORIA_INVALIDA`. |
| 6.7 | Ocultar | Apagar switch | Desaparece de la carta pública. |
| 6.8 | Mostrar | Encender switch | Reaparece. |
| 6.9 | Editar | Cambiar nombre, precio, descripción y foto | Se actualiza. |
| 6.10 | Borrar | Confirmar eliminación | Se elimina de la carta. |
| 6.11 | Sin foto | Crear producto sin foto | Se muestra el placeholder, sin errores. |

---

## 7. Responsive y accesibilidad

| # | Caso | Resultado esperado |
|---|---|---|
| 7.1 | 360 × 800 | Login apilado, sidebar off-canvas, tablas con scroll, botones táctiles ≥ 38 px. |
| 7.2 | 768 × 1024 | Métricas en 2 columnas, filtros legibles. |
| 7.3 | 1024 × 768 | Sidebar fijo, contenido sin desbordes. |
| 7.4 | 1440 × 900 | Hero y panel usan el espacio sin estirar en exceso. |
| 7.5 | Teclado | Tab recorre controles, foco visible, Enter abre botones, Escape cierra sidebar/diálogos. |
| 7.6 | Lector de pantalla | Labels asociados, `aria-label` en iconos, tablas con encabezados. |
| 7.7 | Reduced motion | Sin animaciones de reveal ni transiciones largas. |
| 7.8 | Zoom 200 % | No hay pérdida de contenido ni scroll horizontal en el sitio público. |

---

## 8. Consola y red

- Sin errores `Uncaught` ni 404 de assets.
- Sin warnings de Supabase por claves inválidas.
- Sin peticiones a `service_role`.
- En modo demo, las acciones deben persistir tras recargar.
- En modo Supabase, cada mutación debe verse reflejada en la tabla correspondiente.

---

## 9. Criterios de aceptación

- [ ] Una reserva solo se confirma cuando PostgreSQL devuelve la fila.
- [ ] No es posible duplicar mesa+fecha+horario confirmado.
- [ ] El panel no permite escribir directamente en tablas.
- [ ] La anon key no permite leer reservas ni tablas administrativas.
- [ ] La service role no aparece en el repositorio ni en el bundle.
- [ ] Todos los CRUD funcionan y muestran errores reales.
- [ ] El sitio es usable en móvil y con teclado.
- [ ] README y documentación permiten reproducir el entorno desde cero.
