/* ============================================================
   KONYS PIZZA — Configuración de la aplicación
   Une las variables de entorno con los datos públicos del
   restaurante y decide si se usa Supabase o el modo demo local.
   ============================================================ */
(function () {
  "use strict";

  const env = window.KONYS_ENV || {};
  const url = String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = String(env.SUPABASE_ANON_KEY || "").trim();

  // Una URL válida de Supabase termina en .supabase.co (o es un dominio propio
  // configurado por el usuario). Si falta cualquiera de los dos valores,
  // la aplicación funciona en modo demostración con datos locales.
  const configured = Boolean(url && key && /^https:\/\//i.test(url));

  window.KONYS_CONFIG = {
    mode: configured ? "supabase" : "demo",
    isDemo: !configured,
    supabase: {
      url: configured ? url : "",
      anonKey: configured ? key : ""
    },
    restaurant: {
      name: "Konys Pizza",
      slogan: "La pizza más icónica de la ciudad",
      address: "Cra. 36 con calle 41, Bucaramanga, Santander",
      city: "Bucaramanga, Santander, Colombia",
      phoneDisplay: String(env.PHONE_DISPLAY || "+57 300 000 0000"),
      whatsapp: String(env.WHATSAPP_NUMBER || "573000000000").replace(/\D/g, ""),
      instagram: String(env.INSTAGRAM_URL || "https://instagram.com/konyspizza"),
      facebook: String(env.FACEBOOK_URL || "https://facebook.com/konyspizza"),
      tiktok: String(env.TIKTOK_URL || "https://tiktok.com/@konyspizza"),
      maps: String(env.MAPS_URL || "https://maps.google.com/?q=Cra.+36+con+calle+41,+Bucaramanga,+Santander"),
      hours: {
        lunch: "12:30 p. m. – 2:30 p. m.",
        dinner: "5:00 p. m. – 11:00 p. m."
      }
    },
    demo: {
      // Clave SOLO para el modo demostración local.
      // En producción la contraseña se valida contra un hash bcrypt en Supabase.
      adminPassword: "konys2026",
      storageKey: "konys_demo_v1",
      adminSessionKey: "konys_demo_session_v1"
    },
    ui: {
      maxAdvanceDays: 60,
      minLeadMinutes: 15
    }
  };

  // Resuelve rutas relativas de imágenes guardadas en Supabase.
  window.KONYS_CONFIG.resolveImage = function resolveImage(value, fallback) {
    const source = String(value || "").trim();
    if (!source) return fallback || "assets/img/hero-slice.webp";
    if (/^(https?:|data:|blob:)/i.test(source)) return source;
    return source.replace(/^\/+/, "");
  };
})();
