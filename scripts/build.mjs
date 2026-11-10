#!/usr/bin/env node
/**
 * Genera js/env.js a partir de variables de entorno.
 *
 * Orden de prioridad:
 *   1. Variables del proceso (Vercel, shell, CI).
 *   2. Archivo .env local (nunca se sube al repositorio).
 *
 * Solo se permiten la URL del proyecto y la anon/public key.
 * Si detecta una service_role key, el build se detiene: esa clave
 * jamás debe llegar al navegador.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const envPath = path.join(root, ".env");

function parseDotEnv(raw) {
  const result = {};
  raw.split(/\r?\n/).forEach((line) => {
    const clean = line.trim();
    if (!clean || clean.startsWith("#")) return;
    const withoutExport = clean.replace(/^export\s+/i, "");
    const index = withoutExport.indexOf("=");
    if (index === -1) return;
    const key = withoutExport.slice(0, index).trim();
    let value = withoutExport.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) result[key] = value;
  });
  return result;
}

function loadEnv() {
  let fileEnv = {};
  if (fs.existsSync(envPath)) {
    fileEnv = parseDotEnv(fs.readFileSync(envPath, "utf8"));
  }
  return { ...fileEnv, ...process.env };
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token).split(".");
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function assertPublicKey(key) {
  if (/^sb_secret_/i.test(key)) {
    throw new Error(
      "La clave configurada parece ser una secret key de Supabase. Usa únicamente la anon/public key."
    );
  }
  const payload = decodeJwtPayload(key);
  if (payload && payload.role === "service_role") {
    throw new Error(
      "La clave configurada es la service_role key. Jamás debe exponerse en el frontend; usa la anon key."
    );
  }
}

function clean(value) {
  return String(value == null ? "" : value).trim();
}

const env = loadEnv();
const url = clean(env.SUPABASE_URL).replace(/\/+$/, "");
const anonKey = clean(env.SUPABASE_ANON_KEY);

if (!url !== !anonKey) {
  throw new Error(
    "Configura SUPABASE_URL y SUPABASE_ANON_KEY juntas, o deja ambas vacías para usar el modo demo."
  );
}

if (url) {
  if (!/^https:\/\//i.test(url)) {
    throw new Error("SUPABASE_URL debe ser una URL HTTPS válida.");
  }
  if (!/\.supabase\.co$/i.test(url) && !/^https:\/\/[^/]+$/i.test(url)) {
    throw new Error("SUPABASE_URL no parece una URL de proyecto Supabase.");
  }
  if (anonKey.length < 20) {
    throw new Error("SUPABASE_ANON_KEY parece incompleta.");
  }
  assertPublicKey(anonKey);
}

const payload = {
  SUPABASE_URL: url,
  SUPABASE_ANON_KEY: anonKey,
  WHATSAPP_NUMBER: clean(env.WHATSAPP_NUMBER) || "573000000000",
  PHONE_DISPLAY: clean(env.PHONE_DISPLAY) || "+57 300 000 0000",
  INSTAGRAM_URL: clean(env.INSTAGRAM_URL) || "https://instagram.com/konyspizza",
  FACEBOOK_URL: clean(env.FACEBOOK_URL) || "https://facebook.com/konyspizza",
  TIKTOK_URL: clean(env.TIKTOK_URL) || "https://tiktok.com/@konyspizza",
  MAPS_URL:
    clean(env.MAPS_URL) ||
    "https://maps.google.com/?q=Cra.+36+con+calle+41,+Bucaramanga,+Santander"
};

const banner = `/* ============================================================
   KONYS PIZZA — Variables de entorno del frontend
   ------------------------------------------------------------
   ARCHIVO GENERADO AUTOMÁTICAMENTE por scripts/build.mjs.
   No lo edites a mano en Vercel: cambia las variables de entorno.

   La clave incluida aquí es SIEMPRE la anon/public key.
   Nunca escribas la service_role key en el frontend.
   ============================================================ */

window.KONYS_ENV = ${JSON.stringify(payload, null, 2)};
`;

const outPath = path.join(root, "js", "env.js");
fs.writeFileSync(outPath, banner, "utf8");

if (url) {
  console.log(`✓ js/env.js generado. Supabase configurado: ${url}`);
} else {
  console.log("✓ js/env.js generado en modo demostración (sin credenciales de Supabase).");
}
