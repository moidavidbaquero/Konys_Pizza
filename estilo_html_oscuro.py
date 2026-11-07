"""
Script para aplicar el DISEÑO OSCURO de Konys Pizza a archivos HTML de reportes.
Paleta del index.html: #260212 burgundy | #1a010c fondo oscuro | #ffc7c6 acento rosa,
#59d18c verde | #e8b24b ámbar | #ff2013 rojo | #ffffff texto claro.

Mejoras de distribución:
- Mejor espaciado entre secciones
- Jerarquía visual clara (títulos, subtítulos, contenido)
- Tarjetas de resumen bien distribuidas
- Tablas con mejor alineación y espaciado
- Casos de prueba con mejor jerarquía (título, objetivo, pasos, resultado, estado)
- Uso adecuado de whitespace para que no se vea apretado

Uso:
    python estilo_html_oscuro.py reporte_pruebas.html informe_pruebas.html
"""

import re
import sys
from pathlib import Path

CSS_OSCURO = """/* ============================================================
   KONYS PIZZA — Reporte de Pruebas (Diseño OSCURO mejorado)
   Distribución y organización de información optimizada
   Paleta: #260212 burgundy | #1a010c fondo oscuro | #ffc7c6 acento
            #59d18c verde | #e8b24b ámbar | #ff2013 rojo
   ============================================================ */
  :root {
    --burgundy: #260212;
    --burgundy-dark: #1a010c;
    --burgundy-mid: #3a031a;
    --burgundy-deep: #4f0423;
    --bg-body: #1a010c;
    --bg-card: #260212;
    --bg-alt: #3a031a;
    --border: #4f0423;
    --border-light: #5a3a46;
    --accent: #ffc7c6;
    --accent-hover: #ffe0e0;
    --green: #59d18c;
    --amber: #e8b24b;
    --red: #ff2013;
    --text-light: #ffffff;
    --text-muted: #c6b8bf;
    --text-dim: #9b8a92;
    --shadow: 0 4px 12px rgba(0,0,0,0.35);
  }

  * { box-sizing: border-box; }

  html { scroll-behavior: smooth; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-light);
    background: var(--bg-body);
    margin: 0;
    padding: 0;
    min-width: 320px;
  }

  /* Contenedor principal con márgenes generosos */
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 32px 24px 80px 24px;
  }

  /* ============================================================
     DECORACIÓN SUPERIOR
     ============================================================ */
  .decor-top {
    height: 5px;
    background: linear-gradient(90deg, var(--burgundy), var(--accent), var(--amber), var(--burgundy));
    border-radius: 3px 3px 0 0;
    margin-bottom: 24px;
  }

  /* ============================================================
     ENCABEZADO DEL REPORTE
     ============================================================ */
  .report-header {
    background: linear-gradient(135deg, var(--burgundy) 0%, var(--burgundy-dark) 100%);
    color: var(--text-light);
    padding: 40px 32px;
    border-radius: 18px;
    margin-bottom: 40px;
    box-shadow: var(--shadow);
    border: 1px solid var(--border);
    position: relative;
    overflow: hidden;
  }
  .report-header::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffc7c6' fill-opacity='0.05' d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E") repeat;
    opacity: 0.3;
    pointer-events: none;
  }
  .report-header h1 {
    margin: 0 0 10px 0;
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: var(--text-light);
    position: relative;
    z-index: 1;
  }
  .report-header .subtitle {
    color: var(--accent);
    font-size: 15px;
    margin: 0;
    font-weight: 500;
    position: relative;
    z-index: 1;
  }

  /* ============================================================
     TARJETAS DE RESUMEN
     ============================================================ */
  .summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 16px;
    margin-bottom: 44px;
  }
  .summary-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-left: 4px solid var(--burgundy);
    border-radius: 12px;
    padding: 22px 18px;
    box-shadow: var(--shadow);
    display: flex;
    align-items: center;
    gap: 14px;
    transition: transform 0.2s ease, border-color 0.2s ease;
  }
  .summary-card:hover {
    transform: translateY(-2px);
    border-color: var(--accent);
    box-shadow: 0 8px 20px rgba(0,0,0,0.4);
  }
  .summary-card .icon {
    font-size: 26px;
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  }
  .summary-card .icon.total { background: var(--burgundy-mid); color: var(--text-light); }
  .summary-card .icon.passed { background: var(--green); color: var(--burgundy-dark); }
  .summary-card .icon.failed { background: var(--red); color: var(--text-light); }
  .summary-card .icon.error { background: var(--amber); color: var(--burgundy-dark); }
  .summary-card .info { flex: 1; }
  .summary-card .label {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: var(--text-dim);
    margin-bottom: 4px;
    font-weight: 700;
  }
  .summary-card .value {
    font-size: 26px;
    font-weight: 800;
    color: var(--text-light);
    line-height: 1;
  }
  .summary-card .value.passed { color: var(--green); }
  .summary-card .value.failed { color: var(--red); }
  .summary-card .value.error { color: var(--amber); }
  .summary-card .value.total { color: var(--accent); }

  /* ============================================================
     SECCIONES DEL REPORTE
     ============================================================ */
  .report-section {
    margin-bottom: 44px;
  }
  .section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
  }
  .section-header h2 {
    margin: 0;
    font-size: 17px;
    color: var(--accent);
    font-weight: 700;
    letter-spacing: 0.3px;
  }
  .section-divider {
    width: 40px;
    height: 2px;
    background: var(--accent);
    border-radius: 2px;
  }

  /* ============================================================
     TABLA DE ENTORNO
     ============================================================ */
  #environment {
    width: 100%;
    border-collapse: collapse;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: var(--shadow);
  }
  #environment td {
    padding: 14px 18px;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
    font-size: 13px;
    color: var(--text-light);
  }
  #environment td:first-child {
    font-weight: 700;
    color: var(--accent);
    width: 34%;
    background: var(--bg-alt);
  }
  #environment tr:nth-child(even) td { background: var(--burgundy-mid); }

  /* ============================================================
     CONTROLES / FILTROS
     ============================================================ */
  .controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 32px 0 20px 0;
    flex-wrap: wrap;
    gap: 14px;
  }
  .filters, .collapse {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .filters button, .collapse button {
    color: var(--text-muted);
    border: 1px solid var(--border);
    background: var(--bg-card);
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 12.5px;
    font-weight: 600;
    transition: all 0.2s ease;
  }
  .filters button:hover, .collapse button:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--bg-alt);
  }
  .filter__label {
    font-size: 12.5px;
    color: var(--text-muted);
    margin-right: 6px;
    font-weight: 500;
  }

  /* ============================================================
     TABLA DE RESULTADOS
     ============================================================ */
  #results-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: var(--shadow);
    font-size: 13px;
    margin-bottom: 30px;
  }
  #results-table thead {
    background: linear-gradient(135deg, var(--burgundy) 0%, var(--burgundy-dark) 100%);
    color: var(--accent);
  }
  #results-table th {
    padding: 16px 18px;
    text-align: left;
    font-weight: 700;
    font-size: 11.5px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    border: none;
    white-space: nowrap;
    position: relative;
  }
  #results-table th.sortable {
    cursor: pointer;
    user-select: none;
  }
  #results-table th.sortable:hover {
    background: var(--burgundy-deep);
  }
  #results-table td {
    padding: 14px 18px;
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
    color: var(--text-light);
  }
  #results-table tr:nth-child(even) td { background: var(--bg-alt); }
  #results-table tr:hover td { background: var(--burgundy-deep); }

  .col-result {
    width: 130px;
    font-weight: 800;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.5px;
    padding: 6px 12px;
    border-radius: 6px;
    display: inline-block;
  }
  .col-result.passed { color: var(--green); background: rgba(89,209,140,0.15); border: 1px solid rgba(89,209,140,0.3); }
  .col-result.failed { color: var(--red); background: rgba(255,32,19,0.15); border: 1px solid rgba(255,32,19,0.3); }
  .col-result.error { color: var(--amber); background: rgba(232,178,75,0.15); border: 1px solid rgba(232,178,75,0.3); }
  .col-result.skipped { color: var(--amber); background: rgba(232,178,75,0.15); border: 1px solid rgba(232,178,75,0.3); }

  .collapsible td:not(.col-links) {
    cursor: pointer;
  }

  /* Badges */
  span.passed, .passed .col-result { color: var(--green); }
  span.skipped, span.xfailed, span.rerun,
  .skipped .col-result, .xfailed .col-result, .rerun .col-result { color: var(--amber); }
  span.error, span.failed, span.xpassed,
  .error .col-result, .failed .col-result, .xpassed .col-result { color: var(--red); }

  /* ============================================================
     LOGS / DETALLES
     ============================================================ */
  .logwrapper {
    max-height: 240px;
    overflow-y: auto;
    background: var(--burgundy-mid);
    border: 1px solid var(--border);
    border-radius: 10px;
    margin-top: 10px;
    font-family: 'SF Mono', 'Courier New', monospace;
    font-size: 10.5px;
    line-height: 1.45;
    color: var(--text-dim);
  }
  .logwrapper.expanded { max-height: none; }
  .logexpander {
    display: inline-block;
    margin-top: 8px;
    padding: 5px 12px;
    background: var(--burgundy);
    color: var(--accent);
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    float: right;
    transition: background 0.2s ease;
  }
  .logexpander:hover { background: var(--burgundy-deep); color: var(--accent-hover); }
  .log {
    padding: 14px 16px;
    white-space: pre-wrap;
    border: none;
    margin: 0;
    color: var(--text-dim);
  }
  .log span.error { color: var(--red); font-weight: 700; }

  /* ============================================================
     ORDENACIÓN
     ============================================================ */
  .sortable { cursor: pointer; position: relative; }
  .sortable.desc::after, .sortable.asc::after {
    content: '';
    position: absolute;
    right: 10px;
    top: 50%;
    width: 0; height: 0;
    border-style: solid;
    transform: translateY(-50%);
  }
  .sortable.desc::after {
    border-width: 6px 6px 0 6px;
    border-color: var(--accent) transparent transparent transparent;
  }
  .sortable.asc::after {
    border-width: 0 6px 6px 6px;
    border-color: transparent transparent var(--accent) transparent;
  }

  .hidden, .summary__reload__button.hidden { display: none !important; }

  .summary__reload__button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--text-light);
    background: var(--burgundy);
    padding: 10px 20px;
    border-radius: 8px;
    font-weight: 700;
    font-size: 13.5px;
    text-decoration: none;
    border: 1px solid var(--border);
    cursor: pointer;
    margin-left: 12px;
    transition: all 0.2s ease;
  }
  .summary__reload__button:hover { background: var(--burgundy-deep); border-color: var(--accent); color: var(--accent-hover); }

  /* ============================================================
     PIE DE PÁGINA
     ============================================================ */
  footer {
    margin-top: 56px;
    padding: 26px 0;
    border-top: 1px solid var(--border);
    color: var(--text-dim);
    font-size: 12px;
    text-align: center;
  }
  footer p { margin: 5px 0; }
  footer .divider {
    display: inline-block;
    width: 30px;
    height: 2px;
    background: var(--accent);
    margin: 10px auto;
    border-radius: 2px;
  }

  /* ============================================================
     RESPONSIVO
     ============================================================ */
  @media (max-width: 768px) {
    .container { padding: 16px; }
    .report-header { padding: 28px 20px; }
    .summary { grid-template-columns: 1fr 1fr; }
    #results-table { font-size: 11px; }
    #results-table th, #results-table td { padding: 10px 12px; }
    .summary-card { padding: 18px 16px; }
  }
"""


def inyectar_css_oscuro(ruta_html):
    path = Path(ruta_html)
    if not path.exists():
        print(f"[AVISO] No se encontro: {ruta_html}")
        return False

    html = path.read_text(encoding="utf-8")

    patron = r"<style[^>]*>.*?</style>"
    nuevo_style = f'<style type="text/css">{CSS_OSCURO}</style>'
    html_nuevo, n = re.subn(patron, nuevo_style, html, flags=re.DOTALL)

    if n == 0:
        print(f"[AVISO] No se encontro bloque <style> en {ruta_html}")
        return False
    else:
        path.write_text(html_nuevo, encoding="utf-8")
        print(f"[OK] Distribución mejorada aplicada a: {ruta_html}")
        return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python estilo_html_oscuro.py archivo1.html [archivo2.html ...]")
        sys.exit(1)

    archivos = sys.argv[1:]
    exitos = 0
    for archivo in archivos:
        if inyectar_css_oscuro(archivo):
            exitos += 1

    print(f"\nResumen: {exitos}/{len(archivos)} archivos actualizados con distribución mejorada.")
