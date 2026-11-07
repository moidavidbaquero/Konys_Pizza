import pytest
from selenium import webdriver
from selenium.webdriver.chrome.service import Service as ChromeService
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By

@pytest.fixture(scope="module")
def driver():
    # Inicializa el navegador automáticamente
    options = webdriver.ChromeOptions()
    # options.add_argument("--headless") # Descomenta si quieres que corra sin abrir ventana
    driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=options)
    driver.implicitly_wait(10)
    yield driver
    driver.quit()

def test_abrir_pagina(driver):
    """Prueba 1: Verificar que la página carga correctamente"""
    driver.get("https://www.google.com")
    assert "Google" in driver.title, "El título de la página no coincide"

def test_buscar_elemento(driver):
    """Prueba 2: Verificar la existencia de la barra de búsqueda"""
    driver.get("https://www.google.com")
    search_box = driver.find_element(By.NAME, "q")
    assert search_box.is_displayed(), "La barra de búsqueda no está visible"

def test_prueba_fallida_intencional(driver):
    """Prueba 3 (Opcional): Simula un fallo para ver cómo lo reporta Selenium"""
    driver.get("https://www.google.com")
    # Intentamos buscar un elemento que no existe para forzar un fallo controlado de ejemplo
    elemento_falso = driver.find_elements(By.ID, "elemento_que_no_existe")
    assert len(elemento_falso) > 0, "El elemento falso no fue encontrado (Fallo simulado para el reporte)"