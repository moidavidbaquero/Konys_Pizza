#!/usr/bin/env node
/**
 * Servidor estático mínimo para revisar el proyecto en local.
 * Uso: npm run dev  (o: node scripts/serve.mjs)
 *
 * No tiene dependencias. Sirve /admin como admin.html y evita
 * salir de la carpeta del proyecto.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const port = Number(process.env.PORT) || 4173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

function safePath(urlPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return null;
  }
  if (pathname === "/" || pathname === "") pathname = "/index.html";
  if (pathname === "/admin" || pathname === "/admin/") pathname = "/admin.html";

  const absolute = path.resolve(root, `.${pathname}`);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) return null;
  return absolute;
}

function notFound(res) {
  res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>No encontrado — Konys Pizza</title>
<style>body{background:#260212;color:#ffc7c6;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center}a{color:#fff}</style>
</head><body><main><h1>404</h1><p>Esa página no existe.</p><p><a href="/">Volver al sitio</a> · <a href="/admin">Panel</a></p></main></body></html>`);
}

const server = http.createServer((req, res) => {
  const filePath = safePath(req.url || "/");
  if (!filePath) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Ruta no permitida");
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      notFound(res);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff"
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Konys Pizza disponible en http://127.0.0.1:${port}`);
  console.log(`Panel de administración: http://127.0.0.1:${port}/admin`);
  console.log("Modo demo: contraseña konys2026 (solo cuando Supabase no está configurado).");
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`El puerto ${port} está ocupado. Prueba: PORT=4174 npm run dev`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
