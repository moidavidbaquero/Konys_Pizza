# Konys Pizza - Sistema de Reservas de Mesas

Sitio web de reservas de mesas para **Konys Pizza**, pizzería artesanal ubicada en la Cra. 36 con calle 41, Bucaramanga, Santander, Colombia.

## 📋 Descripción del Proyecto

Konys Pizza es una aplicación web full stack que permite a los clientes reservar mesas de forma autónoma, visualizando la disponibilidad en tiempo real, y brinda al administrador herramientas para gestionar mesas, horarios, reservas y la carta digital.

El proyecto fue desarrollado como parte de un parcial de Full Stack y cubre todas las fases de la ingeniería de software: análisis, diseño, desarrollo, requisitos, modelado de datos, prototipado con mockups, control de versiones con Git, consumo de APIs externas y despliegue en la nube.

## 👥 Desarrollado por

| Nombre | Rol |
|--------|-----|
| Moises David Baquero Daza | Desarrollo |
| David Santiago Vargas Parra | Desarrollo |

---

## 🚀 Tecnologías Utilizadas

| Tecnología | Uso |
|------------|-----|
| **HTML5** | Estructura y marcado semántico de las páginas web |
| **CSS3** | Estilizado, diseño visual y responsividad (Flexbox/Grid) |
| **JavaScript (ES6+)** | Lógica del cliente, manejo del DOM, llamadas a la API |
| **Python** | Pruebas automatizadas con Selenium |
| **Selenium WebDriver** | Automatización de pruebas del navegador |
| **Pytest** | Framework de pruebas unitarias y de integración |
| **Pytest-HTML** | Generación de reportes HTML de pruebas |
| **Supabase** | Base de datos como servicio (Backend-as-a-Service) |
| **GitHub** | Control de versiones y repositorio del código fuente |
| **Vercel** | Plataforma de despliegue continuo |

---

## 📁 Estructura del Proyecto

```
konys-reservas-app/
├── index.html                # Página principal (cliente)
├── admin.html                # Panel de administración
├── ejecutar_pruebas.bat      # Ejecutor de pruebas automatizadas (.bat)
├── test_selenium.py          # Script de pruebas Selenium (34 casos CT-00 a CT-33)
├── generar_pdf.py            # Generador del informe PDF de casos de estudio
├── estilo_html_oscuro.py     # Script de estilos para reportes HTML
├── reporte_pruebas.html      # Reporte detallado de ejecución de pruebas
├── informe_casos_prueba.pdf  # Informe PDF con los 34 casos de estudio
├── package.json              # Configuración del proyecto Node
├── vercel.json               # Configuración de despliegue en Vercel
├── .gitignore                # Archivos y carpetas ignorados por Git
├── README.md                 # Este archivo
├── css/
│   ├── styles.css            # Estilos principales del sitio
│   └── admin.css             # Estilos del panel de administración
├── js/
│   ├── env.js                # Variables de entorno
│   ├── config.js             # Configuración general
│   ├── ui.js                 # Interfaz de usuario
│   ├── supabase.js           # Conexión y capa de datos (Supabase)
│   ├── cliente.js            # Lógica del módulo cliente
│   └── admin.js              # Lógica del módulo administrador
├── js/vendor/
│   └── supabase.js           # SDK de Supabase
├── assets/
│   ├── img/                  # Imágenes del proyecto
│   └── fonts/                # Tipografías
├── docs/                     # Documento del proyecto y mockups
└── scripts/
    └── serve.mjs             # Servidor local de desarrollo
```

---

## ⚡ Instalación y Ejecución

### Requisitos previos
- Python 3.11 o superior
- Google Chrome instalado
- Conexión a internet (para instalar dependencias)

### Pasos

1. Clona el repositorio:
   ```bash
   git clone https://github.com/<tu-usuario>/konys-reservas-app.git
   cd konys-reservas-app
   ```

2. Ejecuta las pruebas automatizadas (incluye levantamiento de servidor local):
   ```powershell
   ejecutar_pruebas.bat
   ```

   O manualmente:
   ```powershell
   python -m http.server 8000
   python -m pytest test_selenium.py --html=reporte_pruebas.html --self-contained-html -v
   python generar_pdf.py
   ```

3. Accede a la aplicación:
   - Cliente: `http://localhost:8000/index.html`
   - Administración: `http://localhost:8000/admin.html`

---

## ☁️ Despliegue en Vercel (producción)

Para que tu sitio se vea en internet con los datos de Supabase (mesas, platos, horarios, reservas), sigue estos pasos:

### 1. Prepara la base de datos en Supabase

Entra a tu proyecto en [Supabase](https://supabase.com/dashboard) y ejecuta en el **SQL Editor**:

1. Ve a **SQL Editor > New query**.
2. Copia y pega el contenido del archivo `supabase/schema.sql` y dale a **Run**.
3. Abre una nueva query, pega el contenido de `supabase/seed.sql` y dale a **Run**.

Esto crea las tablas, la seguridad (RLS), las funciones y los datos iniciales (8 mesas, 14 horarios, 12 platos, 6 reservas de ejemplo). La contraseña del panel de administración es `konys2026`.

### 2. Obtén las credenciales de Supabase

En tu dashboard de Supabase, ve a **Settings > API** y copia:

| Variable | Valor |
|----------|-------|
| `SUPABASE_URL` | Project URL (`https://tu-proyecto.supabase.co`) |
| `SUPABASE_ANON_KEY` | Clave pública `anon` (la que empieza con `eyJ...`) |

> ⚠️ Usa únicamente la **anon/public key**. Nunca subas la `service_role key` al frontend.

### 3. Configura las variables de entorno en Vercel

Desde la terminal de VS Code (o tu terminal favorita):

```powershell
npm install -g vercel
vercel login
```

Luego agrega cada variable una por una:

```powershell
vercel env add SUPABASE_URL
```

- **Environment Variable type:** elige `Secret` y presiona Enter.
- **Value:** pega tu `SUPABASE_URL` y presiona Enter.
- **Environments:** elige `Production` y presiona Enter.

Repite para la segunda variable:

```powershell
vercel env add SUPABASE_ANON_KEY
```

- **Environment Variable type:** `Secret`.
- **Value:** tu `SUPABASE_ANON_KEY`.
- **Environments:** `Production`.

### 4. Despliega a producción

```powershell
vercel --prod
```

Vercel regenerará automáticamente el archivo `js/env.js` con tus credenciales y subirá el sitio a producción.

### 5. Verifica el despliegue

Entra a tu URL de Vercel (por ejemplo: `https://konyspizza-six.vercel.app/`):

- ✅ La sección **Mesas** debe mostrar las mesas disponibles.
- ✅ La sección **Carta** debe mostrar los platos.
- ✅ El chip del footer debe decir **"Supabase conectado"**.
- ✅ En `/admin.html` puedes entrar con la contraseña `konys2026`.

---

### Notas importantes

- El archivo `.env` local solo sirve para probar en tu computadora (`npm run dev`). Para el sitio publicado en internet, lo que importa son las variables configuradas en el dashboard de Vercel.
- Si ya tenías un despliegue previo sin Supabase, después de agregar las variables debes hacer `vercel --prod` nuevamente para que surtan efecto.
- Los datos viven en Supabase y se mantienen aunque cierres tu computadora.

---

## 🧪 Pruebas Automatizadas (Selenium)

El proyecto incluye **34 casos de prueba (CT-00 a CT-33)** que cubren toda la aplicación:

### Módulo Cliente
- CT-00 a CT-05: Carga y navegación de todas las secciones (Inicio, Mesas, Carta, Reservar, Contacto)
- CT-06: Enlace al panel de administración
- CT-07: Campo fecha de mesas (solo fecha)
- CT-08 a CT-09: Sección Carta y enlace WhatsApp
- CT-10 a CT-16: Flujo de reserva completo (selección de mesa, calendario, formulario, botón Confirmar)

### Validación de Campos (Tipo de Dato)
Cada input se valida antes de interactuar:
- **CT-12**: Campo Nombre → solo texto (`type="text"`)
- **CT-13**: Campo Contacto → solo números (`type="tel"`)
- CT-14**: Campo Personas → solo números 1-8 (`type="number"`, min=1, max=8)

### Casos de Error (Etapa 5 del Parcial)
- **CT-24**: Campo nombre vacío
- **CT-25**: Personas sobre capacidad
- **CT-26**: Slot ocupado (doble reserva)
- **CT-27**: Sin mesas activas

### Panel de Administración
- CT-21 a CT-22: Formulario de login y campo contraseña
- CT-23: Diálogo de éxito
- CT-28 a CT-33: CRUD completo (mesas, horarios, reservas, carta)

---

## 📊 Casos de Estudio y Reportes

| Archivo | Descripción |
|---------|-------------|
| `reporte_pruebas.html` | Reporte detallado de ejecución con pytest-html |
| `informe_casos_prueba.pdf` | Informe PDF con los 34 casos de estudio, objetivos, pasos y resultados |

---

## 🎯 Requisitos Funcionales Cubiertos (RF-01 a RF-14)

| Requisito | Descripción | Casos de Prueba |
|-----------|-------------|-----------------|
| RF-01 | Visualización de mesas disponibles | CT-00, CT-02 |
| RF-02 | Selección de mesa | CT-10 |
| RF-03 | Elección de fecha | CT-07, CT-11 |
| RF-04 | Visualización de horarios disponibles | CT-11 |
| RF-05 | Reserva de mesa | CT-12 a CT-16, CT-24 a CT-26 |
| RF-06 | Confirmación de reserva | CT-16, CT-23 |
| RF-07 | Consulta de la carta digital | CT-03, CT-08, CT-09 |
| RF-08 | Acceso al panel de administración | CT-06, CT-21, CT-22 |
| RF-09 | Registro de mesas | CT-28 |
| RF-10 | Listado de mesas | CT-29 |
| RF-11 | Gestión de horarios | CT-30 |
| RF-12 | Visualización de reservas | CT-31 |
| RF-13 | Cambio de estado de mesa | CT-27, CT-32 |
| RF-14 | Gestión de la carta | CT-33 |

---

## 🎨 Diseño de Interfaz

- **Página principal**: Hero sección, tarjetas de mesas, flujo de reserva (modal), pie de página con dirección y redes sociales
- **Panel de administración**: Login con contraseña, menú lateral (Mesas, Horarios, Reservas, Carta), métricas, tablas con filtros
- **Paleta de colores**: Burgundy (#260212), acento rosa (#ffc7c6), texto claro sobre fondos oscuros
- **Responsividad**: Adaptable a dispositivos móviles, tablets y computadoras de escritorio

---

## 📦 Entregables del Parcial

- ✅ Documento de proyecto completo con mockups de baja fidelidad
- ✅ Mockups de baja fidelidad (página principal, flujo de reserva, confirmación, acceso de administrador, panel de administración)
- ✅ Repositorio de GitHub con mínimo 5 commits, README, .gitignore y estructura ordenada
- ✅ Aplicación desplegada en Vercel conectada a Supabase
- ✅ Video explicativo (5 a 8 minutos)
- ✅ Pruebas automatizadas con Selenium (34 casos)

---

## 📞 Contacto

**Konys Pizza**  
Cra. 36 con calle 41, Bucaramanga, Santander, Colombia  
Teléfono / WhatsApp: +57 300 000 0000  
Instagram: @konyspizza

---

*Desarrollado como proyecto académico de Full Stack con Selenium + Python para pruebas automatizadas.*

