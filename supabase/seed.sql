-- ============================================================
-- KONYS PIZZA — Datos iniciales de demostración
-- ------------------------------------------------------------
-- Ejecuta este archivo DESPUÉS de supabase/schema.sql.
-- Es idempotente: no duplica mesas, horarios ni platos.
-- Las reservas de ejemplo solo se insertan si la tabla está vacía.
-- ============================================================

-- ------------------------------------------------------------
-- Mesas
-- ------------------------------------------------------------
insert into public.mesas (nombre, zona, capacidad, foto_url, activa)
values
  ('Mesa 1', 'salon',   2, 'assets/img/mesa-salon.webp',   true),
  ('Mesa 2', 'terraza', 4, 'assets/img/mesa-terraza.webp', true),
  ('Mesa 3', 'salon',   4, 'assets/img/mesa-madera.webp',  true),
  ('Mesa 4', 'terraza', 6, 'assets/img/mesa-noche.webp',   true),
  ('Mesa 5', 'terraza', 2, 'assets/img/mesa-terraza.webp', true),
  ('Mesa 6', 'salon',   8, 'assets/img/mesa-salon.webp',   true),
  ('Mesa 7', 'terraza', 4, 'assets/img/mesa-noche.webp',   false),
  ('Mesa 8', 'salon',   2, 'assets/img/mesa-madera.webp',  false)
on conflict do nothing;

-- ------------------------------------------------------------
-- Horarios: 7 días × 2 jornadas, bloques de 60 minutos
-- ------------------------------------------------------------
insert into public.horarios (dia_semana, jornada, hora_inicio, hora_fin, duracion_slot, activo)
values
  ('lunes',     'almuerzo', '12:30', '14:30', 60, true),
  ('lunes',     'noche',    '17:00', '23:00', 60, true),
  ('martes',    'almuerzo', '12:30', '14:30', 60, true),
  ('martes',    'noche',    '17:00', '23:00', 60, true),
  ('miércoles', 'almuerzo', '12:30', '14:30', 60, true),
  ('miércoles', 'noche',    '17:00', '23:00', 60, true),
  ('jueves',    'almuerzo', '12:30', '14:30', 60, true),
  ('jueves',    'noche',    '17:00', '23:00', 60, true),
  ('viernes',   'almuerzo', '12:30', '14:30', 60, true),
  ('viernes',   'noche',    '17:00', '23:00', 60, true),
  ('sábado',    'almuerzo', '12:30', '14:30', 60, true),
  ('sábado',    'noche',    '17:00', '23:00', 60, true),
  ('domingo',   'almuerzo', '12:30', '14:30', 60, true),
  ('domingo',   'noche',    '17:00', '23:00', 60, true)
on conflict (dia_semana, jornada) do nothing;

-- ------------------------------------------------------------
-- Carta
-- ------------------------------------------------------------
insert into public.platos (nombre, categoria, descripcion, precio, disponible, foto_url)
select v.nombre, v.categoria, v.descripcion, v.precio, v.disponible, v.foto_url
from (values
  ('Margarita',        'pizzas',   'Tomate, mozzarella y albahaca fresca.', 32000, true,  'assets/img/pizza-margarita.webp'),
  ('Pepperoni',        'pizzas',   'Pepperoni y mozzarella sobre masa madre.', 38000, true, 'assets/img/pizza-pepperoni.webp'),
  ('Hawaiana',         'pizzas',   'Jamón y piña, la polémica favorita.', 36000, true, 'assets/img/pizza-hawaiana.webp'),
  ('Cuatro quesos',    'pizzas',   'Mozzarella, parmesano, azul y gouda.', 42000, true, 'assets/img/pizza-cuatro.webp'),
  ('Konys Especial',   'pizzas',   'Pepperoni, champiñones, cebolla y toque de la casa.', 46000, true, 'assets/img/pizza-especial.webp'),
  ('Palitos de ajo',   'entradas', 'Pan de la casa con mantequilla de ajo y salsa.', 14000, true, 'assets/img/entrada-ajo.webp'),
  ('Bruschetta',       'entradas', 'Tomate, albahaca y aceite de oliva sobre pan tostado.', 19000, true, 'assets/img/hero-slice.webp'),
  ('Tiramisú',         'postres',  'Receta italiana con café y mascarpone.', 16000, true, 'assets/img/postre-tiramisu.webp'),
  ('Brownie',          'postres',  'Chocolate oscuro y helado de vainilla.', 15000, false, 'assets/img/postre-tiramisu.webp'),
  ('Limonada de coco', 'bebidas',  'Vaso 400 ml, fresca y cremosa.', 9000, true, 'assets/img/bebida-limonada.webp'),
  ('Gaseosa',          'bebidas',  'Botella personal 400 ml.', 6000, true, 'assets/img/bebida-gaseosa.webp'),
  ('Agua sin gas',     'bebidas',  'Botella 600 ml.', 4000, true, 'assets/img/bebida-gaseosa.webp')
) as v(nombre, categoria, descripcion, precio, disponible, foto_url)
where not exists (select 1 from public.platos);

-- ------------------------------------------------------------
-- Reservas de ejemplo (relativas a la fecha de instalación)
-- ------------------------------------------------------------
insert into public.reservas (
  mesa_id, cliente_nombre, cliente_contacto, num_personas,
  fecha, hora_inicio, hora_fin, estado
)
select
  m.id,
  v.cliente,
  v.contacto,
  v.personas,
  current_date + v.dias,
  v.hora::time,
  (v.hora::time + interval '60 minutes')::time,
  v.estado
from (values
  ('Mesa 2', 'Camila Rojas',  '300 123 4567', 4, 1,  '19:00', 'confirmada'),
  ('Mesa 6', 'Jorge Silva',   '315 555 2098', 8, 1,  '13:30', 'confirmada'),
  ('Mesa 4', 'Laura Díaz',    '301 448 7721', 6, 1,  '20:00', 'confirmada'),
  ('Mesa 1', 'Andrés Pérez',  '320 777 1144', 2, 2,  '13:30', 'cancelada'),
  ('Mesa 3', 'Sofía Ruiz',    '318 220 9031', 4, 2,  '18:00', 'confirmada'),
  ('Mesa 2', 'Martín Gómez',  null,           3, -1, '20:00', 'completada')
) as v(mesa, cliente, contacto, personas, dias, hora, estado)
join public.mesas m on m.nombre = v.mesa
where not exists (select 1 from public.reservas);
