@echo off
setlocal enabledelayedexpansion

:: ============================================================
::  EJECUTOR DE PRUEBAS AUTOMATIZADAS - SELENIUM + PYTHON
::  Proyecto: Konys Pizza (Bucaramanga) - Pruebas a TODA la pagina
:: ============================================================
TITLE Ejecucion de Pruebas Automatizadas - Selenium Python
color 0A

echo.
echo ========================================================
echo        CONFIGURANDO ENTORNO E INICIANDO PRUEBAS
echo ========================================================
echo.

:: -----------------------------------------------------------
:: 1. Verificar si Python esta instalado
:: -----------------------------------------------------------
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python no esta instalado o no se encuentra en el PATH.
    echo       Instala Python desde https://www.python.org y vuelvelo a intentar.
    pause
    exit /b 1
)
echo [OK] Python detectado.

:: -----------------------------------------------------------
:: 2. Verificar si Google Chrome esta instalado
:: -----------------------------------------------------------
set "CHROME_PATH=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_PATH%" (
    set "CHROME_PATH=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
)
if not exist "%CHROME_PATH%" (
    echo [AVISO] Google Chrome no se encontro en la ruta predeterminada.
    echo       Selenium requiere Chrome para ejecutar las pruebas del navegador.
)
echo [OK] Entorno listo.

:: -----------------------------------------------------------
:: 3. Instalar dependencias de Python
:: -----------------------------------------------------------
echo.
echo [INFO] Instalando/actualizando dependencias (selenium, webdriver-manager,
echo        pytest, pytest-html, fpdf2)...
pip install --upgrade selenium webdriver-manager pytest pytest-html fpdf2 >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] No se pudieron instalar las dependencias. Revisa tu conexion a internet.
    pause
    exit /b 1
)
echo [OK] Dependencias instaladas.

:: -----------------------------------------------------------
:: 4. Levantar servidor local para servir el sitio (index.html / admin.html)
:: -----------------------------------------------------------
echo.
echo [INFO] Levantando servidor local en http://localhost:8000 ...
start "ServidorKonys" /B python -m http.server 8000 >nul 2>&1

:: Esperar a que el servidor responda (max 15 segundos)
set /a CONTADOR=0
:espera_servidor
powershell -Command "try { $client = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 8000); $client.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 (
    goto servidor_listo
)
set /a CONTADOR+=1
if %CONTADOR% geq 30 (
    echo [AVISO] El servidor no responde, pero se continuara con las pruebas.
    goto continuar_pruebas
)
timeout /t 1 >nul
goto espera_servidor

:servidor_listo
echo [OK] Servidor local activo en http://localhost:8000

:continuar_pruebas
echo.

:: -----------------------------------------------------------
:: 5. Ejecutar pruebas automatizadas con Selenium + Pytest
:: -----------------------------------------------------------
echo [INFO] Ejecutando pruebas automatizadas de Selenium (TODA la pagina)...
echo.
python -m pytest test_selenium.py --html=reporte_pruebas.html --self-contained-html -v
set "RESULTADO_PRUEBAS=%errorlevel%"

:: -----------------------------------------------------------
:: 5b. Inyectar diseno personalizado de Konys Pizza al reporte HTML
:: -----------------------------------------------------------
echo.
echo [INFO] Aplicando diseno de Konys Pizza al reporte HTML...
python estilo_reporte.py >nul 2>&1
if exist "reporte_pruebas.html" (
    echo [OK] Diseno aplicado: reporte_pruebas.html
)

echo.
echo ========================================================
echo        PRUEBAS FINALIZADAS
echo ========================================================

:: -----------------------------------------------------------
:: 6. Generar PDF con los casos de estudio (informe)
:: -----------------------------------------------------------
echo.
echo [INFO] Generando informe PDF con los casos de prueba...
python generar_pdf.py >nul 2>&1
if exist "informe_casos_prueba.pdf" (
    echo [OK] PDF generado: informe_casos_prueba.pdf
) else (
    echo [AVISO] No se pudo generar el PDF automaticamente.
)

:: -----------------------------------------------------------
:: 7. Mostrar resultados y abrir reportes
:: -----------------------------------------------------------
echo.
if %RESULTADO_PRUEBAS% equ 0 (
    echo [EXITO] Todas las pruebas pasaron correctamente.
) else (
    echo [INFO] Algunas pruebas fallaron o tuvieron errores. Revisa reporte_pruebas.html
)

if exist "reporte_pruebas.html" (
    echo [INFO] Abriendo reporte HTML de pruebas...
    start "" reporte_pruebas.html
)
if exist "informe_casos_prueba.pdf" (
    echo [INFO] Abriendo informe PDF de casos de estudio...
    start "" informe_casos_prueba.pdf
)

echo.
echo ========================================================
echo           FIN DE LA EJECUCION
echo ========================================================
pause
endlocal
exit /b %RESULTADO_PRUEBAS%
