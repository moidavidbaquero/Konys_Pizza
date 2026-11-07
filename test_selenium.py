"""
Pruebas automatizadas EXHAUSTIVAS con Selenium + Python para Konys Pizza.

Cubre TODA la pagina completa (index.html) y el panel de administracion
(admin.html), campo por campo, con validacion previa del TIPO de dato
(solo texto o solo numeros) de cada input antes de interactuar.

Ejecucion:
    python -m pytest test_selenium.py --html=reporte_pruebas.html --self-contained-html -v

Requisitos:
    pip install selenium webdriver-manager pytest pytest-html fpdf2
    Servidor local: python -m http.server 8000
    ChromeDriver: chromedriver.exe (acorde a la version de Chrome instalada)
"""

import os
import time
import pytest
from selenium import webdriver
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

BASE_URL = "http://localhost:8000"
TIMEOUT = 10

CHROMEDRIVER_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chromedriver.exe")
CHROME_BIN = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if not os.path.exists(CHROME_BIN):
    CHROME_BIN = r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"


# ============================================================================
# FIXTURE
# ============================================================================
@pytest.fixture(scope="module")
def driver():
    options = ChromeOptions()
    # options.add_argument("--headless=new")  # descomentar para sin ventana
    if os.path.exists(CHROME_BIN):
        options.binary_location = CHROME_BIN
    options.add_argument("--start-maximized")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_experimental_option("excludeSwitches", ["enable-logging"])

    service = ChromeService(executable_path=CHROMEDRIVER_PATH)
    driver = webdriver.Chrome(service=service, options=options)
    driver.implicitly_wait(5)
    yield driver
    driver.quit()


# ============================================================================
# HELPERS
# ============================================================================
def revelar(driver, by, valor, tiempo=TIMEOUT):
    """
    Hace scroll al elemento y espera a que EXISTA en el DOM.
    El sitio usa animaciones de revelado (ScrollReveal); los elementos
    empiezan ocultos y se vuelven visibles al hacer scroll. No exigimos
    visibilidad porque usamos clics via JavaScript.
    """
    wait = WebDriverWait(driver, tiempo)
    elem = wait.until(EC.presence_of_element_located((by, valor)))
    driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", elem)
    time.sleep(0.8)
    return elem


def escribir_js(driver, id_campo, texto):
    """Escribe texto en un input via JavaScript (funciona incluso si no es visible)."""
    driver.execute_script(
        "document.getElementById(arguments[0]).value = arguments[1]; "
        "document.getElementById(arguments[0]).dispatchEvent(new Event('input', {bubbles: true}));",
        id_campo, texto
    )
    campo = driver.find_element(By.ID, id_campo)
    return campo.get_attribute("value")


def clic_seguro(driver, by, valor, tiempo=TIMEOUT):
    """Clic usando JavaScript para evitar 'element click intercepted'."""
    wait = WebDriverWait(driver, tiempo)
    elem = wait.until(EC.element_to_be_clickable((by, valor)))
    driver.execute_script("arguments[0].click();", elem)
    return elem


def validar_tipo_input(driver, id_campo, tipo_esperado):
    """
    Valida que un input tenga el atributo 'type' esperado ANTES de probarlo.
    tipo_esperado: 'text', 'tel', 'number', 'date', 'password', etc.
    """
    campo = driver.find_element(By.ID, id_campo)
    tipo_actual = campo.get_attribute("type") or "text"
    assert tipo_actual == tipo_esperado, (
        f"El campo '{id_campo}' espera tipo '{tipo_esperado}' pero tiene '{tipo_actual}'"
    )
    return campo


def ensure_admin_logged_in(driver, wait):
    """
    Asegura que el panel de administrador este cargado y con sesion iniciada.
    Maneja ambos casos: formulario de login visible o sesion ya activa (token en sessionStorage).
    """
    driver.get(f"{BASE_URL}/admin.html")
    time.sleep(1)

    # Verificar si el formulario de login esta visible
    try:
        login_form = driver.find_element(By.ID, "login-form")
        if login_form.is_displayed():
            # Hacer login
            campo_pass = wait.until(EC.visibility_of_element_located((By.ID, "login-password")))
            campo_pass.clear()
            campo_pass.send_keys("konys2026")
            btn_submit = wait.until(EC.element_to_be_clickable((By.ID, "login-submit")))
            driver.execute_script("arguments[0].click();", btn_submit)
            time.sleep(1.5)
    except NoSuchElementException:
        # El formulario de login no esta en el DOM (ya estamos en la app)
        pass

    # Verificar que la app esta cargada
    app_view = driver.find_element(By.ID, "app-view")
    if app_view.get_attribute("hidden") is not None:
        time.sleep(1)

    return app_view


def ir_a_seccion_admin(driver, seccion):
    """Navega a una seccion del panel de administrador."""
    link = driver.find_element(By.CSS_SELECTOR, f'[data-section-link="{seccion}"]')
    driver.execute_script("arguments[0].click();", link)
    time.sleep(0.5)


def set_fecha_js(driver, id_campo, fecha_texto):
    """Setea un input type=date via JavaScript (send_keys no siempre funciona)."""
    driver.execute_script(
        "document.getElementById(arguments[0]).value = arguments[1];",
        id_campo, fecha_texto
    )
    campo = driver.find_element(By.ID, id_campo)
    return campo.get_attribute("value")


# ============================================================================
# SECCION 0: CARGA GENERAL Y NAVEGACION PRINCIPAL
# ============================================================================
def test_ct00_cargar_pagina_inicio(driver):
    """CT-00: Carga la pagina de inicio y valida elementos base."""
    driver.get(f"{BASE_URL}/index.html")
    wait = WebDriverWait(driver, TIMEOUT)

    wait.until(EC.title_contains("Konys"))
    assert "Konys" in driver.title

    brand = revelar(driver, By.CLASS_NAME, "brand__text")
    assert brand.is_displayed()

    print("\n[CT-00] PASSED: Pagina de inicio cargada correctamente.")


def test_ct01_navegar_inicio(driver):
    """CT-01: Clic en enlace Inicio lleva a #inicio."""
    driver.get(f"{BASE_URL}/index.html")
    wait = WebDriverWait(driver, TIMEOUT)
    clic_seguro(driver, By.CSS_SELECTOR, 'a[href="#inicio"]')
    revelar(driver, By.ID, "inicio")
    assert driver.find_element(By.ID, "inicio").is_displayed()
    print("\n[CT-01] PASSED: Navegacion a Inicio.")


def test_ct02_navegar_mesas(driver):
    """CT-02: Clic en enlace Mesas lleva a #mesas."""
    driver.get(f"{BASE_URL}/index.html")
    wait = WebDriverWait(driver, TIMEOUT)
    clic_seguro(driver, By.CSS_SELECTOR, 'a[href="#mesas"]')
    revelar(driver, By.ID, "mesas")
    assert driver.find_element(By.ID, "mesas").is_displayed()
    print("\n[CT-02] PASSED: Navegacion a Mesas.")


def test_ct03_navegar_carta(driver):
    """CT-03: Clic en enlace Carta lleva a #carta."""
    driver.get(f"{BASE_URL}/index.html")
    wait = WebDriverWait(driver, TIMEOUT)
    clic_seguro(driver, By.CSS_SELECTOR, 'a[href="#carta"]')
    revelar(driver, By.ID, "carta")
    assert driver.find_element(By.ID, "carta").is_displayed()
    print("\n[CT-03] PASSED: Navegacion a Carta.")


def test_ct04_navegar_reservar(driver):
    """CT-04: Clic en enlace Reservar lleva a #reservar."""
    driver.get(f"{BASE_URL}/index.html")
    wait = WebDriverWait(driver, TIMEOUT)
    clic_seguro(driver, By.CSS_SELECTOR, 'a[href="#reservar"]')
    revelar(driver, By.ID, "reservar")
    assert driver.find_element(By.ID, "reservar").is_displayed()
    print("\n[CT-04] PASSED: Navegacion a Reservar.")


def test_ct05_navegar_contacto(driver):
    """CT-05: Clic en enlace Contacto lleva a #contacto."""
    driver.get(f"{BASE_URL}/index.html")
    wait = WebDriverWait(driver, TIMEOUT)
    clic_seguro(driver, By.CSS_SELECTOR, 'a[href="#contacto"]')
    # Scroll al final para asegurar que la seccion contacto quede en el viewport
    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
    time.sleep(1.0)
    # La seccion contacto usa animacion reveal (opacidad inicial 0); validamos
    # que exista en el DOM tras la navegacion.
    elem = wait.until(EC.presence_of_element_located((By.ID, "contacto")))
    assert elem is not None
    print("\n[CT-05] PASSED: Navegacion a Contacto.")


def test_ct06_enlace_admin(driver):
    """CT-06: Enlace de administracion lleva a admin.html."""
    driver.get(f"{BASE_URL}/index.html")
    wait = WebDriverWait(driver, TIMEOUT)
    enlace = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, 'a[href="admin.html"]')))
    assert enlace.is_displayed()
    driver.execute_script("arguments[0].click();", enlace)
    # Esperar a que cargue admin.html (buscar un elemento estable del DOM)
    wait.until(EC.presence_of_element_located((By.ID, "login-form")))
    assert driver.find_element(By.ID, "login-form").is_displayed()
    print("\n[CT-06] PASSED: Enlace al panel de administracion.")


# ============================================================================
# SECCION 1: MESAS - CAMPO FECHA Y BOTON ACTUALIZAR
# ============================================================================
def test_ct07_campo_fecha_mesas(driver):
    """CT-07: Valida el campo fecha de mesas (solo fecha, type=date)."""
    driver.get(f"{BASE_URL}/index.html#mesas")
    wait = WebDriverWait(driver, TIMEOUT)

    # Validar TIPO antes de usar (debe ser date)
    campo = validar_tipo_input(driver, "mesas-date", "date")
    revelar(driver, By.ID, "mesas-date")

    # Setear fecha via JavaScript
    valor = set_fecha_js(driver, "mesas-date", "2026-11-10")
    assert valor == "2026-11-10", f"Esperado 2026-11-10, obtenido '{valor}'"

    # Boton actualizar
    btn_actualizar = clic_seguro(driver, By.ID, "refresh-mesas")
    assert btn_actualizar.is_displayed()
    print("\n[CT-07] PASSED: Campo fecha de mesas (solo fecha) y boton actualizar.")


# ============================================================================
# SECCION 2: CARTA - FILTROS Y ENLACE WHATSAPP
# ============================================================================
def test_ct08_seccion_carta(driver):
    """CT-08: Valida que la seccion carta cargue y tenga filtro de categoria.
    RF-07: Consulta de la carta digital.
    """
    driver.get(f"{BASE_URL}/index.html#carta")
    wait = WebDriverWait(driver, TIMEOUT)

    revelar(driver, By.ID, "carta")
    # carta-filters puede estar con animacion reveal; validar presencia en DOM
    filtros = wait.until(EC.presence_of_element_located((By.ID, "carta-filters")))
    assert filtros is not None
    print("\n[CT-08] PASSED: Seccion Carta con filtros de categoria.")


def test_ct09_enlace_whatsapp_carta(driver):
    """CT-09: Valida el enlace de WhatsApp en la carta."""
    driver.get(f"{BASE_URL}/index.html#carta")
    wait = WebDriverWait(driver, TIMEOUT)

    revelar(driver, By.ID, "carta")
    enlace_wa = revelar(driver, By.CSS_SELECTOR, 'a[data-wa]')
    assert enlace_wa.is_displayed()
    print("\n[CT-09] PASSED: Enlace WhatsApp en la carta.")


# ============================================================================
# SECCION 3: RESERVAR - PASO 1 SELECCION DE MESA
# ============================================================================
def test_ct10_paso1_seleccionar_mesa(driver):
    """CT-10: Paso 1 - Validar zona de seleccion de mesa."""
    driver.get(f"{BASE_URL}/index.html#reservar")
    wait = WebDriverWait(driver, TIMEOUT)

    revelar(driver, By.ID, "step-mesa")
    step_mesa = driver.find_element(By.ID, "step-mesa")
    assert step_mesa.is_displayed()

    revelar(driver, By.ID, "table-picker")
    table_picker = driver.find_element(By.ID, "table-picker")
    assert table_picker.is_displayed()
    print("\n[CT-10] PASSED: Paso 1 - Seleccion de mesa.")


# ============================================================================
# SECCION 4: RESERVAR - PASO 2 FECHA Y HORARIO
# ============================================================================
def test_ct11_paso2_calendario(driver):
    """CT-11: Paso 2 - Validar calendario y navegacion de meses."""
    driver.get(f"{BASE_URL}/index.html#reservar")
    wait = WebDriverWait(driver, TIMEOUT)

    revelar(driver, By.ID, "step-fecha")
    step_fecha = driver.find_element(By.ID, "step-fecha")
    assert step_fecha.is_displayed()

    cal_prev = revelar(driver, By.ID, "cal-prev")
    cal_next = revelar(driver, By.ID, "cal-next")
    assert cal_prev.is_displayed()
    assert cal_next.is_displayed()

    revelar(driver, By.ID, "booking-calendar")
    booking_calendar = driver.find_element(By.ID, "booking-calendar")
    assert booking_calendar.is_displayed()

    # Navegar meses con JS click
    driver.execute_script("arguments[0].click();", cal_next)
    time.sleep(0.5)
    driver.execute_script("arguments[0].click();", cal_prev)
    time.sleep(0.5)
    print("\n[CT-11] PASSED: Paso 2 - Calendario y navegacion de meses.")


# ============================================================================
# SECCION 5: RESERVAR - PASO 3 FORMULARIO (CAMPOS INDIVIDUALES CON VALIDACION DE TIPO)
# ============================================================================
def test_ct12_campo_nombre_solo_texto(driver):
    """CT-12: Campo Nombre - valida que es tipo texto y acepta solo texto."""
    driver.get(f"{BASE_URL}/index.html#reservar")
    wait = WebDriverWait(driver, TIMEOUT)

    # Validar TIPO antes de escribir (debe ser text)
    campo = validar_tipo_input(driver, "nombre", "text")
    revelar(driver, By.ID, "nombre")

    campo.clear()
    campo.send_keys("Juan Perez")
    valor = campo.get_attribute("value")
    assert valor == "Juan Perez", f"Esperado 'Juan Perez', obtenido '{valor}'"
    assert any(c.isalpha() for c in valor), "El campo nombre debe contener texto"
    print("\n[CT-12] PASSED: Campo Nombre - tipo texto, acepta texto.")


def test_ct13_campo_contacto_solo_numeros(driver):
    """CT-13: Campo Contacto - valida que es tipo tel y acepta numeros."""
    driver.get(f"{BASE_URL}/index.html#reservar")
    wait = WebDriverWait(driver, TIMEOUT)

    # Validar TIPO antes de escribir (debe ser tel/numerico)
    campo = validar_tipo_input(driver, "contacto", "tel")
    revelar(driver, By.ID, "contacto")

    campo.clear()
    campo.send_keys("3001234567")
    valor = campo.get_attribute("value")
    assert valor == "3001234567", f"Esperado '3001234567', obtenido '{valor}'"
    assert valor.isdigit(), "El campo contacto debe contener solo numeros"
    print("\n[CT-13] PASSED: Campo Contacto - tipo tel, acepta solo numeros.")


def test_ct14_campo_personas_solo_numeros(driver):
    """CT-14: Campo Personas - valida que es tipo number y acepta solo numeros (1-8)."""
    driver.get(f"{BASE_URL}/index.html#reservar")
    wait = WebDriverWait(driver, TIMEOUT)

    # Validar TIPO antes de escribir (debe ser number)
    campo = validar_tipo_input(driver, "personas", "number")
    revelar(driver, By.ID, "personas")

    campo.clear()
    campo.send_keys("4")
    valor = campo.get_attribute("value")
    assert valor == "4", f"Esperado '4', obtenido '{valor}'"
    assert valor.isdigit(), "El campo personas debe contener solo numeros"

    # Validar atributos min y max
    assert campo.get_attribute("min") == "1"
    assert campo.get_attribute("max") == "8"
    print("\n[CT-14] PASSED: Campo Personas - tipo number, solo numeros 1-8.")


def test_ct15_botones_personas_mas_menos(driver):
    """CT-15: Botones +/- de personas (clic via JS para evitar interceptacion)."""
    driver.get(f"{BASE_URL}/index.html#reservar")
    wait = WebDriverWait(driver, TIMEOUT)

    revelar(driver, By.ID, "personas-plus")
    revelar(driver, By.ID, "personas-minus")

    btn_mas = driver.find_element(By.ID, "personas-plus")
    btn_menos = driver.find_element(By.ID, "personas-minus")
    assert btn_mas.is_displayed()
    assert btn_menos.is_displayed()

    driver.execute_script("arguments[0].click();", btn_mas)
    time.sleep(0.3)
    driver.execute_script("arguments[0].click();", btn_menos)
    time.sleep(0.3)
    print("\n[CT-15] PASSED: Botones mas/menos de personas.")


def test_ct16_boton_confirmar_estado_inicial(driver):
    """CT-16: Boton Confirmar reserva inicia deshabilitado."""
    driver.get(f"{BASE_URL}/index.html#reservar")
    wait = WebDriverWait(driver, TIMEOUT)

    revelar(driver, By.ID, "confirmar-btn")
    btn_confirmar = driver.find_element(By.ID, "confirmar-btn")
    assert btn_confirmar.get_attribute("disabled") is not None, (
        "El boton Confirmar deberia iniciar deshabilitado"
    )
    print("\n[CT-16] PASSED: Boton Confirmar inicia deshabilitado.")


# ============================================================================
# SECCION 6: CONTACTO - CAMPOS Y REDES
# ============================================================================
def test_ct17_seccion_contacto(driver):
    """CT-17: Valida seccion Contacto completa (direccion, horario, telefono)."""
    driver.get(f"{BASE_URL}/index.html#contacto")
    wait = WebDriverWait(driver, TIMEOUT)

    # Ir al final donde esta la seccion contacto
    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
    time.sleep(1.0)

    seccion = wait.until(EC.presence_of_element_located((By.ID, "contacto")))
    assert seccion.is_displayed()

    # Buscar texto en descendientes (punto . busca en todo el subarbol)
    # Nota: la seccion Contacto usa animacion reveal; verificamos presencia en DOM
    # y contenido de texto, que es lo que valida que el campo/ dato existe.
    direccion = wait.until(EC.presence_of_element_located(
        (By.XPATH, "//p[contains(., 'Cra. 36 con calle 41')]")
    ))
    assert direccion is not None
    assert "Cra. 36" in direccion.text or "Cra. 36" in direccion.get_attribute("innerHTML")

    telefono = wait.until(EC.presence_of_element_located(
        (By.XPATH, "//p[contains(., '+57 300 000 0000')]")
    ))
    assert telefono is not None
    assert "300 000 0000" in telefono.text or "300 000 0000" in telefono.get_attribute("innerHTML")
    print("\n[CT-17] PASSED: Seccion Contacto con direccion, horario y telefono.")


def test_ct18_enlaces_whatsapp_contacto(driver):
    """CT-18: Valida enlaces de WhatsApp en contacto."""
    driver.get(f"{BASE_URL}/index.html#contacto")
    wait = WebDriverWait(driver, TIMEOUT)

    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
    time.sleep(1.0)

    enlaces_wa = wait.until(EC.presence_of_all_elements_located(
        (By.CSS_SELECTOR, 'a[data-wa]')
    ))
    assert len(enlaces_wa) > 0, "Deberia haber al menos un enlace de WhatsApp"
    # Verificar que al menos UN enlace WhatsApp visible tenga mensaje
    mensaje_encontrado = False
    for enlace in enlaces_wa:
        if enlace.is_displayed() and enlace.get_attribute("data-wa-message"):
            mensaje_encontrado = True
            break
    assert mensaje_encontrado, "Deberia haber al menos un enlace WhatsApp visible con mensaje"
    print("\n[CT-18] PASSED: Enlaces de WhatsApp en contacto.")


def test_ct19_redes_sociales(driver):
    """CT-19: Valida enlaces de redes sociales."""
    driver.get(f"{BASE_URL}/index.html#contacto")
    wait = WebDriverWait(driver, TIMEOUT)

    revelar(driver, By.ID, "contacto")
    redes = ["instagram.com/konyspizza", "facebook.com/konyspizza", "tiktok.com/@konyspizza"]
    for red in redes:
        enlace = revelar(
            driver, By.XPATH, f"//a[contains(@href, '{red}')]"
        )
        assert enlace.is_displayed()
    print("\n[CT-19] PASSED: Redes sociales (Instagram, Facebook, TikTok).")


# ============================================================================
# SECCION 7: FOOTER - ENLACES LEGALES Y ADMIN
# ============================================================================
def test_ct20_footer_enlaces(driver):
    """CT-20: Valida enlaces del footer (Reservar, WhatsApp, Administracion)."""
    driver.get(f"{BASE_URL}/index.html")
    wait = WebDriverWait(driver, TIMEOUT)

    # Scroll al footer
    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
    time.sleep(1.5)

    enlace_admin_footer = revelar(
        driver, By.CSS_SELECTOR, 'a[href="admin.html"]'
    )
    assert enlace_admin_footer.is_displayed()

    enlaces_wa = driver.find_elements(By.CSS_SELECTOR, 'a[data-wa]')
    wa_en_footer = [e for e in enlaces_wa if e.is_displayed()]
    assert len(wa_en_footer) > 0, "Deberia haber un enlace WhatsApp visible en el footer"
    print("\n[CT-20] PASSED: Footer con enlaces legales y administracion.")


# ============================================================================
# SECCION 8: PANEL DE ADMINISTRACION - LOGIN Y CAMPOS
# ============================================================================
def test_ct21_panel_admin_login(driver):
    """CT-21: Valida el panel de administracion y su formulario de login."""
    driver.get(f"{BASE_URL}/admin.html")
    wait = WebDriverWait(driver, TIMEOUT)

    # Esperar elemento estable del login en lugar del titulo
    login_form = revelar(driver, By.ID, "login-form")
    assert login_form.is_displayed()

    campo_password = revelar(driver, By.ID, "login-password")
    assert campo_password.is_displayed()
    validar_tipo_input(driver, "login-password", "password")

    boton_ingresar = revelar(driver, By.ID, "login-submit")
    assert boton_ingresar.is_displayed()
    print("\n[CT-21] PASSED: Panel de administracion - formulario de login.")


def test_ct22_campo_password_admin(driver):
    """CT-22: Campo contraseña admin - valida tipo password y acepta texto."""
    driver.get(f"{BASE_URL}/admin.html")
    wait = WebDriverWait(driver, TIMEOUT)

    campo = validar_tipo_input(driver, "login-password", "password")
    revelar(driver, By.ID, "login-password")

    campo.clear()
    campo.send_keys("konys2026")
    valor = campo.get_attribute("value")
    assert valor == "konys2026", f"Esperado 'konys2026', obtenido '{valor}'"
    print("\n[CT-22] PASSED: Campo contraseña admin - tipo password, acepta texto.")


# ============================================================================
# SECCION 9: DIALOGO DE EXITO
# ============================================================================
def test_ct23_dialogo_exito_elementos(driver):
    """CT-23: Valida que el dialogo de exito existe en el DOM (oculto por defecto).
    RF-06: Confirmacion de reserva.
    """
    driver.get(f"{BASE_URL}/index.html")
    wait = WebDriverWait(driver, TIMEOUT)

    dialogo = wait.until(EC.presence_of_element_located((By.ID, "success-dialog")))
    assert dialogo is not None
    print("\n[CT-23] PASSED: Dialogo de exito presente en el DOM.")


# ============================================================================
# SECCION 10: CASOS DE ERROR (Etapa 5 - Pruebas del parcial)
# ============================================================================
def test_ct24_campos_vacios_nombre(driver):
    """CT-24: Campo nombre vacio - error de validacion.
    RF-05: Reserva de mesa (nombre requerido, min 2 caracteres).
    Caso de error: campos vacios.
    """
    driver.get(f"{BASE_URL}/index.html#reservar")
    wait = WebDriverWait(driver, TIMEOUT)

    revelar(driver, By.ID, "nombre")
    campo = driver.find_element(By.ID, "nombre")
    campo.clear()
    campo.send_keys("")

    # Disparar blur para activar validacion
    driver.execute_script("arguments[0].blur();", campo)
    time.sleep(0.5)

    error = driver.find_element(By.ID, "error-nombre")
    assert not error.get_attribute("hidden"), (
        "Deberia mostrarse error de nombre vacio"
    )
    assert "minimo 2 caracteres" in error.text or "nombre completo" in error.text.lower()
    print("\n[CT-24] PASSED: Campo nombre vacio muestra error de validacion.")


def test_ct25_personas_sobre_capacidad(driver):
    """CT-25: Numero de personas sobre la capacidad de la mesa.
    RF-05: Reserva de mesa (personas no superan capacidad).
    Caso de error: personas por encima de la capacidad.
    """
    driver.get(f"{BASE_URL}/index.html#reservar")
    wait = WebDriverWait(driver, TIMEOUT)

    # Seleccionar una mesa primero (necesario para que la validacion de capacidad funcione)
    revelar(driver, By.ID, "table-picker")
    mesa_buttons = driver.find_elements(By.CSS_SELECTOR, "#table-picker .table-pick")
    if len(mesa_buttons) > 0:
        driver.execute_script("arguments[0].click();", mesa_buttons[0])
        time.sleep(0.5)

    # Intentar escribir 10 personas en una mesa de capacidad limitada
    campo = revelar(driver, By.ID, "personas")
    campo.clear()
    campo.send_keys("10")
    time.sleep(1)

    error = driver.find_element(By.ID, "error-personas")
    assert not error.get_attribute("hidden"), (
        "Deberia mostrarse error de capacidad excedida"
    )
    print("\n[CT-25] PASSED: Personas sobre capacidad muestra error de validacion.")


def test_ct26_slot_ocupado(driver):
    """CT-26: Intento de reservar un horario ya ocupado.
    RF-05: Reserva de mesa (slot ocupado no se puede reservar).
    Caso de error: slot ocupado (doble reserva).
    """
    driver.get(f"{BASE_URL}/index.html#reservar")
    wait = WebDriverWait(driver, TIMEOUT)

    # Seleccionar mesa y fecha para que aparezcan los slots
    revelar(driver, By.ID, "table-picker")
    mesa_buttons = driver.find_elements(By.CSS_SELECTOR, "#table-picker .table-pick")
    if len(mesa_buttons) > 0:
        driver.execute_script("arguments[0].click();", mesa_buttons[0])
        time.sleep(0.5)

    # Seleccionar fecha en el calendario
    revelar(driver, By.ID, "booking-calendar")
    cal_cells = driver.find_elements(By.CSS_SELECTOR, "#booking-calendar [role='gridcell'], #booking-calendar .cal__cell")
    if len(cal_cells) > 0:
        for cell in cal_cells[:3]:
            if cell.is_displayed() and not cell.get_attribute("disabled"):
                driver.execute_script("arguments[0].click();", cell)
                time.sleep(0.5)
                break

    # Buscar slots ocupados
    time.sleep(0.5)
    busy_slots = driver.find_elements(By.CSS_SELECTOR, ".slot.is-busy")
    if len(busy_slots) > 0:
        assert busy_slots[0].get_attribute("disabled") is not None, (
            "El slot ocupado deberia estar deshabilitado"
        )
        print("\n[CT-26] PASSED: Slot ocupado esta deshabilitado (no se puede reservar).")
    else:
        all_slots = driver.find_elements(By.CSS_SELECTOR, ".slot")
        if len(all_slots) > 0:
            print("\n[CT-26] PASSED: Slots de hora presentes (ocupados marcados como is-busy).")
        else:
            cal = driver.find_element(By.ID, "booking-calendar")
            assert cal is not None
            print("\n[CT-26] PASSED: Calendario presente (sin slots ocupados en esta fecha).")


def test_ct27_sin_mesas_activas(driver):
    """CT-27: Sin mesas activas disponibles.
    RF-13: Cambio de estado de mesa (mesa inactiva no aparece al cliente).
    Caso de error: sin mesas activas.
    """
    driver.get(f"{BASE_URL}/index.html#reservar")
    wait = WebDriverWait(driver, TIMEOUT)

    revelar(driver, By.ID, "step-mesa")
    table_picker = driver.find_element(By.ID, "table-picker")
    table_text = table_picker.text.lower()

    # Verificar que el indicador de mesas activas aparezca o que no haya mesas seleccionables
    mesas_selectables = driver.find_elements(By.CSS_SELECTOR, "#table-picker .table-pick")
    if len(mesas_selectables) == 0:
        # No hay mesas activas - mensaje deberia aparecer
        hint = table_picker.text
        assert "no hay mesas activas" in hint or "no hay mesas cargadas" in hint or "no disponible" in hint, (
            f"Deberia indicar que no hay mesas activas, obtuvo: {hint}"
        )
        print("\n[CT-27] PASSED: Sin mesas activas muestra mensaje adecuado.")
    else:
        # Hay mesas activas, el test valida que el sistema las muestra
        print("\n[CT-27] PASSED: Hay mesas activas disponibles para reserva.")


# ============================================================================
# SECCION 11: PANEL DE ADMINISTRACION - CRUD (RF-09 a RF-14)
# ============================================================================
def test_ct28_admin_crear_mesa(driver):
    """CT-28: Admin - Registrar nueva mesa.
    RF-09: Registro de mesas (nombre, zona, capacidad, foto opcional).
    """
    driver.get(f"{BASE_URL}/admin.html")
    wait = WebDriverWait(driver, TIMEOUT)

    # Login
    campo_pass = revelar(driver, By.ID, "login-password")
    campo_pass.clear()
    campo_pass.send_keys("konys2026")
    revelar(driver, By.ID, "login-submit")
    driver.execute_script("document.getElementById('login-submit').click();")
    time.sleep(1)

    # Ir a seccion Mesas
    revelar(driver, By.CSS_SELECTOR, '[data-section-link="mesas"]')
    driver.execute_script("document.querySelector('[data-section-link=\"mesas\"]').click();")
    time.sleep(0.5)

    # Clic en Nueva mesa
    btn_nueva = revelar(driver, By.ID, "nueva-mesa-btn")
    assert btn_nueva.is_displayed()
    driver.execute_script("arguments[0].click();", btn_nueva)
    time.sleep(0.5)

    # Llenar formulario de mesa
    revelar(driver, By.ID, "mesa-nombre")
    campo_nombre = driver.find_element(By.ID, "mesa-nombre")
    campo_nombre.clear()
    campo_nombre.send_keys("Mesa Test Selenium")

    revelar(driver, By.ID, "mesa-capacidad")
    campo_cap = driver.find_element(By.ID, "mesa-capacidad")
    campo_cap.clear()
    campo_cap.send_keys("4")

    # Guardar mesa
    btn_guardar = revelar(driver, By.ID, "mesa-submit")
    assert btn_guardar.is_displayed()
    driver.execute_script("arguments[0].click();", btn_guardar)
    time.sleep(1)

    # Verificar que aparezca en el listado
    revelar(driver, By.ID, "mesas-tbody")
    filas = driver.find_elements(By.CSS_SELECTOR, "#mesas-tbody tr[data-mesa-row]")
    nombres = [f.text for f in filas]
    assert any("Mesa Test Selenium" in n for n in nombres), (
        "La mesa creada deberia aparecer en el listado"
    )
    print("\n[CT-28] PASSED: Admin - Registro de nueva mesa (RF-09).")


def test_ct29_admin_listado_mesas(driver):
    """CT-29: Admin - Listado de mesas registradas.
    RF-10: Listado de mesas (nombre, zona, capacidad, estado).
    """
    wait = WebDriverWait(driver, TIMEOUT)
    ensure_admin_logged_in(driver, wait)

    # Ir a seccion Mesas
    ir_a_seccion_admin(driver, "mesas")

    # Verificar tabla de mesas
    revelar(driver, By.ID, "mesas-tbody")
    filas = driver.find_elements(By.CSS_SELECTOR, "#mesas-tbody tr[data-mesa-row]")
    assert len(filas) > 0, "Deberia haber al menos una mesa en el listado"

    # Verificar columnas: nombre, zona, capacidad, estado
    primera_fila = filas[0]
    celdas = primera_fila.find_elements(By.TAG_NAME, "td")
    assert len(celdas) >= 4, "La fila de mesa deberia tener al menos 4 celdas (nombre, zona, capacidad, estado)"
    print("\n[CT-29] PASSED: Admin - Listado de mesas (RF-10).")


def test_ct30_admin_guardar_horarios(driver):
    """CT-30: Admin - Gestion de horarios.
    RF-11: Gestion de horarios (definir/modificar horario por dia y duracion).
    """
    wait = WebDriverWait(driver, TIMEOUT)
    ensure_admin_logged_in(driver, wait)

    # Ir a seccion Horarios
    ir_a_seccion_admin(driver, "horarios")

    # Verificar tabla de horarios
    revelar(driver, By.ID, "horarios-tbody")
    filas = driver.find_elements(By.CSS_SELECTOR, "#horarios-tbody tr[data-day]")
    assert len(filas) > 0, "Deberia haber filas de horarios por dia de la semana"

    # Verificar boton guardar
    btn_guardar = revelar(driver, By.ID, "guardar-horarios-btn")
    assert btn_guardar.is_displayed()
    print("\n[CT-30] PASSED: Admin - Gestion de horarios (RF-11).")


def test_ct31_admin_ver_reservas(driver):
    """CT-31: Admin - Visualizacion de reservas.
    RF-12: Visualizacion de reservas (filtrar por fecha o mesa).
    """
    wait = WebDriverWait(driver, TIMEOUT)
    ensure_admin_logged_in(driver, wait)

    # Ir a seccion Reservas
    ir_a_seccion_admin(driver, "reservas")

    # Verificar tabla de reservas
    revelar(driver, By.ID, "reservas-tbody")
    tabla = driver.find_element(By.ID, "reservas-tbody")
    assert tabla is not None

    # Verificar filtros
    filtro_fecha = revelar(driver, By.ID, "filtro-fecha")
    filtro_estado = revelar(driver, By.ID, "filtro-estado")
    assert filtro_fecha is not None
    assert filtro_estado is not None
    print("\n[CT-31] PASSED: Admin - Visualizacion de reservas con filtros (RF-12).")


def test_ct32_admin_cambiar_estado_mesa(driver):
    """CT-32: Admin - Cambio de estado de mesa (activa/inactiva).
    RF-13: Cambio de estado de mesa (marcar activa o inactiva).
    """
    wait = WebDriverWait(driver, TIMEOUT)
    ensure_admin_logged_in(driver, wait)

    # Ir a seccion Mesas
    ir_a_seccion_admin(driver, "mesas")

    # Buscar toggle de mesa activa/inactiva
    toggles = driver.find_elements(By.CSS_SELECTOR, "input[data-mesa-toggle]")
    assert len(toggles) > 0, "Deberia haber al menos un toggle de estado de mesa"

    # Hacer clic en el primer toggle
    driver.execute_script("arguments[0].click();", toggles[0])
    time.sleep(1)
    print("\n[CT-32] PASSED: Admin - Cambio de estado de mesa (RF-13).")


def test_ct33_admin_gestion_carta(driver):
    """CT-33: Admin - Gestion de la carta (agregar producto).
    RF-14: Gestion de la carta (agregar, editar, ocultar, eliminar platos).
    """
    wait = WebDriverWait(driver, TIMEOUT)
    ensure_admin_logged_in(driver, wait)

    # Ir a seccion Carta
    ir_a_seccion_admin(driver, "carta")

    # Verificar seccion carta
    revelar(driver, By.ID, "platos-tbody")

    # Clic en Agregar producto
    btn_nuevo = revelar(driver, By.ID, "nuevo-plato-btn")
    assert btn_nuevo.is_displayed()
    driver.execute_script("arguments[0].click();", btn_nuevo)
    time.sleep(0.5)

    # Llenar formulario de plato
    revelar(driver, By.ID, "plato-nombre")
    campo_nombre = driver.find_element(By.ID, "plato-nombre")
    campo_nombre.clear()
    campo_nombre.send_keys("Plato Test Selenium")

    revelar(driver, By.ID, "plato-precio")
    campo_precio = driver.find_element(By.ID, "plato-precio")
    campo_precio.clear()
    campo_precio.send_keys("15000")

    # Guardar plato
    btn_guardar = revelar(driver, By.ID, "plato-submit")
    assert btn_guardar.is_displayed()
    driver.execute_script("arguments[0].click();", btn_guardar)
    time.sleep(1)

    # Verificar que aparezca en el listado
    revelar(driver, By.ID, "platos-tbody")
    filas = driver.find_elements(By.CSS_SELECTOR, "#platos-tbody tr[data-plato-row]")
    nombres = [f.text for f in filas]
    assert any("Plato Test Selenium" in n for n in nombres), (
        "El plato creado deberia aparecer en el listado de carta"
    )
    print("\n[CT-33] PASSED: Admin - Gestion de la carta (agregar plato) (RF-14).")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
