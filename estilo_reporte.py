"""
Script para inyectar el CSS personalizado de Konys Pizza al reporte HTML
generado por pytest-html. Diseño OSCURO y elegante con la paleta del index.html.
Se ejecuta después de pytest para mantener el diseño.
"""

import re
from pathlib import Path

CSS_KONYS = """/* ============================================================
   KONYS PIZZA — Reporte de Pruebas Automatizadas
   Diseño OSCURO y elegante con paleta del index.html
   Colores: #260212 burgundy | #1a010c fondo oscuro | #ffc7c6 acento
            #59d18c verde | #e8b24b ámbar | #ffffff texto claro
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
    --accent: #ffc7c6;
    --accent-hover: #ffe0e0;
    --green: #59d18c;
    --amber: #e8b24b;
    --red: #ff2013;
    --text-light: #ffffff;
    --text-muted: #c6b8bf;
    --text-dim: #9b8a92;
  }

  * { box-sizing: border-box; }

  html { scroll-behavior: smooth; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-light);
    background: var(--bg-body);
    margin: 0;
    padding: 0;
    min-width: 320px;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 28px 24px 70px 24px;
  }

  /* Decorative top border */
  .decor-top {
    height: 5px;
    background: linear-gradient(90deg, var(--burgundy), var(--accent), var(--amber), var(--burgundy));
    border-radius: 3px 3px 0 0;
    margin-bottom: 2px;
  }

  /* Header */
  .report-header {
    background: linear-gradient(135deg, var(--burgundy) 0%, var(--burgundy-dark) 100%);
    color: var(--text-light);
    padding: 40px 28px;
    border-radius: 16px;
    margin-bottom: 32px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    position: relative;
    border: 1px solid var(--border);
  }
  .report-header h1 {
    margin: 0 0 10px 0;
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: var(--text-light);
  }
  .report-header .subtitle {
    color: var(--accent);
    font-size: 15px;
    margin: 0;
    font-weight: 500;
  }

  /* Summary cards */
  .summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 18px;
    margin-bottom: 36px;
  }
  .summary-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-left: 4px solid var(--burgundy);
    border-radius: 14px;
    padding: 24px 20px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    gap: 14px;
    transition: transform 0.2s ease, border-color 0.2s ease;
  }
  .summary-card:hover {
    transform: translateY(-3px);
    border-color: var(--accent);
    box-shadow: 0 8px 20px rgba(0,0,0,0.4);
  }
  .summary-card .icon {
    font-size: 28px;
    width: 48px;
    height: 48px;
    border-radius: 12px;
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
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1.4px;
    color: var(--text-dim);
    margin-bottom: 5px;
    font-weight: 700;
  }
  .summary-card .value {
    font-size: 30px;
    font-weight: 800;
    color: var(--text-light);
    line-height: 1;
  }
  .summary-card .value.passed { color: var(--green); }
  .summary-card .value.failed { color: var(--red); }
  .summary-card .value.error { color: var(--amber); }
  .summary-card .value.total { color: var(--accent); }

  /* Environment */
  #environment-header {
    margin: 36px 0 14px 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  #environment-header h2 {
    margin: 0;
    font-size: 17px;
    color: var(--accent);
    font-weight: 700;
  }
  #environment {
    width: 100%;
    border-collapse: collapse;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
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

  /* Controls / filters */
  .controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 30px 0 18px 0;
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

  /* Results table */
  #results-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 14px rgba(0,0,0,0.3);
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

  /* Logs */
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

  /* Sorting arrows */
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

  /* Footer */
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

  @media (max-width: 768px) {
    .container { padding: 16px; }
    .report-header { padding: 28px 20px; }
    .summary { grid-template-columns: 1fr 1fr; }
    #results-table { font-size: 11px; }
    #results-table th, #results-table td { padding: 10px 12px; }
  }
"""


def inyectar_css(ruta_html="reporte_pruebas.html"):
    path = Path(ruta_html)
    if not path.exists():
        print(f"[AVISO] No se encontro {ruta_html}")
        return

    html = path.read_text(encoding="utf-8")

    # Reemplazar todo el bloque <style>...</style>
    patron = r"<style[^>]*>.*?</style>"
    nuevo_style = f'<style type="text/css">{CSS_KONYS}</style>'
    html_nuevo, n = re.subn(patron, nuevo_style, html, flags=re.DOTALL)

    if n == 0:
        print("[AVISO] No se encontro bloque <style> para reemplazar")
    else:
        path.write_text(html_nuevo, encoding="utf-8")
        print(f"[OK] CSS de Konys Pizza inyectado en {ruta_html}")


if __name__ == "__main__":
    inyectar_css()
