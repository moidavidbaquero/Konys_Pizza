import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service as ChromeService
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By

resultados = []

print("Iniciando pruebas automatizadas...")
options = webdriver.ChromeOptions()
driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=options)
driver.implicitly_wait(10)

try:
    # Prueba 1
    driver.get("https://www.google.com")
    if "Google" in driver.title:
        resultados.append("Prueba 1 (Abrir página): PASSED")
    else:
        resultados.append("Prueba 1 (Abrir página): FAILED")

    # Prueba 2
    search_box = driver.find_element(By.NAME, "q")
    if search_box.is_displayed():
        resultados.append("Prueba 2 (Barra de búsqueda): PASSED")
    else:
        resultados.append("Prueba 2 (Barra de búsqueda): FAILED")

    # Prueba 3 (Fallo intencional para ver el reporte)
    try:
        elemento = driver.find_element(By.ID, "elemento_falso")
        resultados.append("Prueba 3 (Elemento inexistente): PASSED")
    except:
        resultados.append("Prueba 3 (Elemento inexistente): FAILED (Esperado para demostrar reporte de errores)")

finally:
    driver.quit()

# Generar reporte en archivo de texto plano
with open("informe_pruebas.txt", "w", encoding="utf-8") as f:
    f.write("=== INFORME DE PRUEBAS AUTOMATIZADAS ===\n")
    for r in resultados:
        f.write(r + "\n")
        print(r)

print("\n¡Informe generado con éxito en 'informe_pruebas.txt'!")