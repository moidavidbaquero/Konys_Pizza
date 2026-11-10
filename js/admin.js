/* ============================================================
   KONYS PIZZA — Panel de administración
   ------------------------------------------------------------
   · Login con contraseña y sesión de 8 horas.
   · Secciones: Mesas, Horarios, Reservas y Carta.
   · Todas las escrituras pasan por RPCs seguras de Supabase.
   · En modo demo usa el backend local de js/supabase.js.
   ============================================================ */
(function () {
  "use strict";

  const UI = window.KonysUI;
  const API = window.KonysAPI;
  const CONFIG = window.KONYS_CONFIG;

  const $ = (selector, scope) => UI.qs(selector, scope);
  const $$ = (selector, scope) => UI.qsa(selector, scope);
  const esc = UI.escapeHtml;

  const DAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
  const DAY_LABEL = {
    lunes: "Lunes",
    martes: "Martes",
    "miércoles": "Miércoles",
    jueves: "Jueves",
    viernes: "Viernes",
    "sábado": "Sábado",
    domingo: "Domingo"
  };
  const ZONA_LABEL = { salon: "Salón", terraza: "Terraza" };
  const CATEGORIA_LABEL = {
    pizzas: "Pizzas",
    entradas: "Entradas",
    postres: "Postres",
    bebidas: "Bebidas"
  };
  const ESTADO_LABEL = {
    confirmada: "Confirmada",
    cancelada: "Cancelada",
    completada: "Completada"
  };
  const SECTIONS = {
    mesas: {
      title: "Mesas",
      sub: "Gestiona la disponibilidad del salón y la terraza.",
      documentTitle: "Mesas"
    },
    horarios: {
      title: "Horarios",
      sub: "Define las jornadas que alimentan el calendario de reservas.",
      documentTitle: "Horarios"
    },
    reservas: {
      title: "Reservas",
      sub: "Consulta y actualiza el estado de cada reserva.",
      documentTitle: "Reservas"
    },
    carta: {
      title: "Carta",
      sub: "Administra los productos visibles en la carta digital.",
      documentTitle: "Carta"
    }
  };

  const state = {
    ready: false,
    session: false,
    section: "mesas",
    mesas: [],
    horarios: [],
    allReservas: [],
    reservas: [],
    platos: [],
    filters: { fecha: "", mesaId: "", estado: "" },
    mesaSearch: "",
    cartaFilter: "all",
    detailReservaId: null,
    reservasRequest: 0
  };

  /* ---------- Referencias DOM ---------- */
  const loginView = $("#login-view");
  const appView = $("#app-view");
  const loginForm = $("#login-form");
  const loginPassword = $("#login-password");
  const loginSubmit = $("#login-submit");
  const loginError = $("#login-error");
  const loginErrorText = $("#login-error-text");
  const loginDemoHint = $("#login-demo-hint");
  const loginChip = $("#admin-login-chip");
  const adminChip = $("#admin-demo-chip");
  const passwordToggle = $("#toggle-password");

  const sidebar = $("#admin-sidebar");
  const shell = $(".admin-shell");
  const backdrop = $("#admin-backdrop");
  const sidebarToggle = $("#sidebar-toggle");
  const logoutBtn = $("#logout-btn");
  const refreshBtn = $("#refresh-section");
  const topbarTitle = $("#topbar-title");
  const topbarSub = $("#topbar-sub");
  const topbarDate = $("#topbar-date");

  const mesasTbody = $("#mesas-tbody");
  const mesasCount = $("#mesas-count");
  const mesasSearch = $("#mesas-search");
  const nuevaMesaBtn = $("#nueva-mesa-btn");
  const mesaDialog = $("#mesa-dialog");
  const mesaForm = $("#mesa-form");
  const mesaSubmit = $("#mesa-submit");
  const mesaError = $("#mesa-error");
  const mesaErrorText = $("#mesa-error-text");
  const mesaPreview = $("#mesa-preview");

  const horariosTbody = $("#horarios-tbody");
  const duracionGlobal = $("#duracion-global");
  const guardarHorariosBtn = $("#guardar-horarios-btn");
  const copiarHorarioBtn = $("#copiar-horario-btn");

  const reservasTbody = $("#reservas-tbody");
  const reservasCount = $("#reservas-count");
  const actualizarReservasBtn = $("#actualizar-reservas-btn");
  const limpiarFiltrosBtn = $("#limpiar-filtros-btn");
  const filtroFecha = $("#filtro-fecha");
  const filtroMesa = $("#filtro-mesa");
  const filtroEstado = $("#filtro-estado");
  const reservaDialog = $("#reserva-dialog");
  const reservaDialogSub = $("#reserva-dialog-sub");
  const reservaDetail = $("#reserva-detail");
  const reservaDialogFoot = $("#reserva-dialog-foot");

  const platosTbody = $("#platos-tbody");
  const platosCount = $("#platos-count");
  const nuevoPlatoBtn = $("#nuevo-plato-btn");
  const cartaFilters = $("#admin-carta-filters");
  const platoDialog = $("#plato-dialog");
  const platoForm = $("#plato-form");
  const platoSubmit = $("#plato-submit");
  const platoError = $("#plato-error");
  const platoErrorText = $("#plato-error-text");
  const platoPreview = $("#plato-preview");

  /* ---------- Utilidades ---------- */
  function initials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    const first = parts[0] ? parts[0][0] : "?";
    const second = parts.length > 1 ? parts[1][0] : "";
    return (first + second).toUpperCase();
  }

  function imageUrl(value) {
    return CONFIG.resolveImage(value, "");
  }

  function estadoBadge(estado) {
    const key = ESTADO_LABEL[estado] ? estado : "confirmada";
    return `<span class="status-badge status-badge--${key}">${ESTADO_LABEL[key]}</span>`;
  }

  function formatCreado(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function currentMinutes() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  function setLoading(tbody, cols, text) {
    if (!tbody) return;
    tbody.innerHTML = `<tr class="tr-loading"><td colspan="${cols}"><span class="spinner"></span> ${esc(text)}</td></tr>`;
  }

  function setEmpty(tbody, cols, title, message) {
    if (!tbody) return;
    tbody.innerHTML = `<tr class="empty-row"><td colspan="${cols}"><strong>${esc(title)}</strong>${esc(message || "")}</td></tr>`;
  }

  function setTableError(tbody, cols, message) {
    if (!tbody) return;
    tbody.innerHTML = `<tr class="empty-row"><td colspan="${cols}"><strong>No se pudo cargar</strong>${esc(message)}</td></tr>`;
  }

  function showFormError(box, textNode, message) {
    if (!box) return;
    if (!message) {
      box.hidden = true;
      if (textNode) textNode.textContent = "";
      return;
    }
    if (textNode) textNode.textContent = message;
    box.hidden = false;
  }

  function updatePreview(container, url) {
    if (!container) return;
    container.classList.remove("is-error");
    container.innerHTML = "";
    const source = String(url || "").trim();
    if (!source) {
      container.innerHTML = `<span>${UI.icon("image")} Sin foto seleccionada</span>`;
      return;
    }
    const img = document.createElement("img");
    img.alt = "Vista previa de la imagen";
    img.loading = "lazy";
    img.src = imageUrl(source);
    img.addEventListener("error", () => {
      container.classList.add("is-error");
      container.innerHTML = `<span>${UI.icon("alert")} No se pudo cargar la imagen</span>`;
    });
    container.append(img);
  }

  function toastSuccess(message, title) {
    UI.toast(message, "success", title || "Guardado");
  }

  function toastError(error, title) {
    UI.toast(API.helpers.errorMessage(error), "error", title || "Algo salió mal");
  }

  function isSessionError(error) {
    return Boolean(error && error.code === "SESION_INVALIDA");
  }

  function handleApiError(error) {
    if (isSessionError(error)) {
      if (state.session) {
        showLogin("Tu sesión expiró. Ingresa la contraseña nuevamente.");
        UI.toast("Tu sesión expiró. Vuelve a ingresar.", "error", "Sesión finalizada");
      }
      return true;
    }
    return false;
  }

  function updateModeChip() {
    const demo = API.isDemo;
    const text = demo ? "Modo demo local" : "Supabase conectado";
    [loginChip, adminChip].forEach((chip) => {
      if (!chip) return;
      chip.innerHTML = `<i></i> ${text}`;
      chip.classList.toggle("datasource-chip--live", !demo);
    });
    if (loginDemoHint) loginDemoHint.hidden = !demo;
  }

  function setTopbarDate() {
    if (!topbarDate) return;
    const label = UI.formatDateWithDay(UI.todayISO());
    topbarDate.textContent = label.charAt(0).toUpperCase() + label.slice(1);
  }

  /* ---------- Sesión / login ---------- */
  function showLogin(message) {
    state.session = false;
    state.detailReservaId = null;
    state.mesas = [];
    state.horarios = [];
    state.allReservas = [];
    state.reservas = [];
    state.platos = [];
    [mesaDialog, platoDialog, reservaDialog].forEach((dialog) => UI.closeDialog(dialog));
    appView.hidden = true;
    loginView.hidden = false;
    closeSidebar();
    if (message) {
      showFormError(loginError, loginErrorText, message);
    } else {
      showFormError(loginError, loginErrorText, "");
    }
    document.title = "Administración — Konys Pizza";
    setTimeout(() => loginPassword?.focus(), 60);
  }

  async function enterApp() {
    state.session = true;
    loginView.hidden = true;
    appView.hidden = false;
    updateModeChip();
    setTopbarDate();
    const section = SECTIONS[parseHash()] ? parseHash() : "mesas";
    showSection(section, true);
    await refreshAll();
  }

  async function handleLogin(event) {
    event.preventDefault();
    if (!state.ready) return;

    const password = loginPassword.value;
    showFormError(loginError, loginErrorText, "");
    if (!password) {
      showFormError(loginError, loginErrorText, "Escribe la contraseña del equipo Konys.");
      loginPassword.focus();
      return;
    }

    UI.setButtonLoading(loginSubmit, true, "Verificando…");
    try {
      await API.adminLogin(password);
      loginPassword.value = "";
      loginPassword.type = "password";
      passwordToggle?.setAttribute("aria-pressed", "false");
      await enterApp();
    } catch (error) {
      showFormError(loginError, loginErrorText, API.helpers.errorMessage(error));
      loginPassword.select();
    } finally {
      UI.setButtonLoading(loginSubmit, false);
    }
  }

  async function handleLogout() {
    if (logoutBtn) logoutBtn.disabled = true;
    try {
      await API.adminLogout();
    } catch (error) {
      // La sesión local ya se cerró; no bloqueamos la salida.
    } finally {
      if (logoutBtn) logoutBtn.disabled = false;
    }
    showLogin();
    UI.toast("La sesión se cerró correctamente.", "info", "Hasta pronto");
  }

  function togglePassword() {
    if (!loginPassword || !passwordToggle) return;
    const visible = loginPassword.type === "text";
    loginPassword.type = visible ? "password" : "text";
    passwordToggle.setAttribute("aria-pressed", String(!visible));
    passwordToggle.setAttribute("aria-label", visible ? "Mostrar contraseña" : "Ocultar contraseña");
    const use = passwordToggle.querySelector("use");
    if (use) use.setAttribute("href", visible ? "#i-eye" : "#i-eye-off");
  }

  /* ---------- Navegación ---------- */
  function parseHash() {
    return String(window.location.hash || "").replace(/^#/, "").split("?")[0];
  }

  function showSection(name, updateHash) {
    const key = SECTIONS[name] ? name : "mesas";
    state.section = key;

    $$(".admin-section").forEach((section) => {
      section.hidden = section.id !== `section-${key}`;
    });

    $$("[data-section-link]").forEach((link) => {
      const active = link.dataset.sectionLink === key;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    const meta = SECTIONS[key];
    if (topbarTitle) topbarTitle.textContent = meta.title;
    if (topbarSub) topbarSub.textContent = meta.sub;
    document.title = `${meta.documentTitle} · Administración — Konys Pizza`;

    if (updateHash && parseHash() !== key) {
      history.replaceState(null, "", `#${key}`);
    }
    closeSidebar();
  }

  function openSidebar() {
    if (!shell || !sidebarToggle) return;
    shell.classList.add("is-sidebar-open");
    sidebarToggle.setAttribute("aria-expanded", "true");
    sidebarToggle.setAttribute("aria-label", "Cerrar menú");
  }

  function closeSidebar() {
    if (!shell || !sidebarToggle) return;
    shell.classList.remove("is-sidebar-open");
    sidebarToggle.setAttribute("aria-expanded", "false");
    sidebarToggle.setAttribute("aria-label", "Abrir menú");
  }

  function bindNavigation() {
    $$("[data-section-link]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const name = link.dataset.sectionLink;
        if (!SECTIONS[name]) return;
        showSection(name, true);
      });
    });

    window.addEventListener("hashchange", () => {
      if (state.session) showSection(parseHash(), false);
    });

    window.addEventListener("popstate", () => {
      if (state.session) showSection(parseHash(), false);
    });

    sidebarToggle?.addEventListener("click", () => {
      if (shell.classList.contains("is-sidebar-open")) closeSidebar();
      else openSidebar();
    });

    backdrop?.addEventListener("click", closeSidebar);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeSidebar();
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) closeSidebar();
    });
  }

  /* ---------- Métricas ---------- */
  function renderMetrics() {
    const totalMesas = state.mesas.length;
    const activeMesas = state.mesas.filter((mesa) => mesa.activa).length;
    const today = UI.todayISO();
    const todayReservas = state.allReservas.filter((reserva) => reserva.fecha === today && reserva.estado !== "cancelada");
    const todayConfirmadas = todayReservas.filter((reserva) => reserva.estado === "confirmada").length;
    const todayCompletadas = todayReservas.filter((reserva) => reserva.estado === "completada").length;
    const nowMinutes = currentMinutes();
    const proximas = state.allReservas.filter((reserva) => {
      if (reserva.estado !== "confirmada") return false;
      if (reserva.fecha > today) return true;
      return reserva.fecha === today && UI.minutesOf(reserva.hora_inicio) >= nowMinutes;
    }).length;
    const activePlatos = state.platos.filter((plato) => plato.disponible).length;

    const metrics = [
      ["#metric-mesas", activeMesas, totalMesas ? `${activeMesas} de ${totalMesas} habilitadas` : "Sin mesas registradas"],
      ["#metric-hoy", todayReservas.length, `${todayConfirmadas} confirmadas · ${todayCompletadas} completadas`],
      ["#metric-proximas", proximas, proximas === 1 ? "Reserva confirmada por venir" : "Reservas confirmadas por venir"],
      ["#metric-platos", activePlatos, state.platos.length ? `${state.platos.length - activePlatos} ocultos o agotados` : "Carta sin productos"]
    ];

    metrics.forEach(([selector, value, sub]) => {
      const valueNode = $(selector);
      const subNode = $(`${selector}-sub`);
      if (valueNode) valueNode.textContent = String(value);
      if (subNode) subNode.textContent = sub;
    });

    const counts = {
      mesas: totalMesas,
      reservas: state.allReservas.length,
      platos: state.platos.length
    };
    Object.entries(counts).forEach(([key, value]) => {
      $$(`[data-count="${key}"]`).forEach((node) => { node.textContent = String(value); });
    });
  }

  /* ---------- Carga de datos ---------- */
  async function reloadMesas() {
    setLoading(mesasTbody, 5, "Cargando mesas…");
    try {
      state.mesas = await API.adminListMesas();
      renderMesas();
      populateMesaFilter();
      renderMetrics();
      return true;
    } catch (error) {
      if (handleApiError(error)) return false;
      setTableError(mesasTbody, 5, API.helpers.errorMessage(error));
      return false;
    }
  }

  async function reloadHorarios() {
    setLoading(horariosTbody, 6, "Cargando horarios…");
    try {
      state.horarios = await API.adminListHorarios();
      renderHorarios();
      return true;
    } catch (error) {
      if (handleApiError(error)) return false;
      setTableError(horariosTbody, 6, API.helpers.errorMessage(error));
      return false;
    }
  }

  async function reloadPlatos() {
    setLoading(platosTbody, 6, "Cargando carta…");
    try {
      state.platos = await API.adminListPlatos();
      renderPlatos();
      renderMetrics();
      return true;
    } catch (error) {
      if (handleApiError(error)) return false;
      setTableError(platosTbody, 6, API.helpers.errorMessage(error));
      return false;
    }
  }

  async function reloadAllReservas() {
    try {
      state.allReservas = await API.adminListReservas({});
      renderMetrics();
      return true;
    } catch (error) {
      if (handleApiError(error)) return false;
      return false;
    }
  }

  async function reloadReservasTable() {
    const requestId = ++state.reservasRequest;
    setLoading(reservasTbody, 7, "Cargando reservas…");
    try {
      const rows = await API.adminListReservas(state.filters);
      if (requestId !== state.reservasRequest) return false;
      state.reservas = rows;
      renderReservas();
      return true;
    } catch (error) {
      if (requestId !== state.reservasRequest) return false;
      if (handleApiError(error)) return false;
      setTableError(reservasTbody, 7, API.helpers.errorMessage(error));
      return false;
    }
  }

  async function refreshAll() {
    if (!state.session) return false;
    const results = await Promise.all([
      reloadMesas(),
      reloadHorarios(),
      reloadPlatos(),
      reloadAllReservas()
    ]);
    const reservasOk = await reloadReservasTable();
    return results.every(Boolean) && reservasOk;
  }

  /* ---------- Mesas ---------- */
  function renderMesas() {
    const term = UI.normalizeText(state.mesaSearch);
    const rows = state.mesas.filter((mesa) => {
      if (!term) return true;
      return UI.normalizeText(`${mesa.nombre} ${ZONA_LABEL[mesa.zona] || mesa.zona}`).includes(term);
    });

    if (mesasCount) mesasCount.textContent = `${rows.length} de ${state.mesas.length} mesas`;

    if (!rows.length) {
      setEmpty(
        mesasTbody,
        5,
        state.mesas.length ? "Sin coincidencias" : "Aún no hay mesas",
        state.mesas.length ? "Prueba con otro nombre o zona." : "Crea la primera mesa para abrir reservas."
      );
      return;
    }

    mesasTbody.innerHTML = rows.map((mesa) => `
      <tr data-mesa-row="${esc(mesa.id)}">
        <td>
          <div class="table-user">
            <span class="avatar-initials" aria-hidden="true">${esc(initials(mesa.nombre))}</span>
            <div>
              <span class="cell-strong">${esc(mesa.nombre)}</span>
              <span class="cell-sub">${esc(mesa.activa ? "Visible para reservas" : "Oculta al público")}</span>
            </div>
          </div>
        </td>
        <td><span class="category-pill">${esc(ZONA_LABEL[mesa.zona] || mesa.zona)}</span></td>
        <td><span class="cell-strong">${esc(mesa.capacidad)}</span><span class="cell-sub">personas</span></td>
        <td>
          <label class="switch-row" style="padding:0;border:0;background:transparent;gap:10px" title="${mesa.activa ? "Desactivar mesa" : "Activar mesa"}">
            <span class="switch switch--inline">
              <input type="checkbox" data-mesa-toggle="${esc(mesa.id)}" ${mesa.activa ? "checked" : ""} aria-label="${mesa.activa ? "Desactivar" : "Activar"} ${esc(mesa.nombre)}">
              <span></span>
            </span>
            <span class="cell-sub" style="margin:0">${mesa.activa ? "Activa" : "Inactiva"}</span>
          </label>
        </td>
        <td>
          <div class="row-actions">
            <button class="icon-btn icon-btn--sm" type="button" data-mesa-edit="${esc(mesa.id)}" aria-label="Editar ${esc(mesa.nombre)}" title="Editar">${UI.icon("edit")}</button>
            <button class="icon-btn icon-btn--sm icon-btn--danger" type="button" data-mesa-delete="${esc(mesa.id)}" aria-label="Eliminar ${esc(mesa.nombre)}" title="Eliminar">${UI.icon("trash")}</button>
          </div>
        </td>
      </tr>`).join("");
  }

  function openMesaDialog(mesa) {
    mesaForm.reset();
    showFormError(mesaError, mesaErrorText, "");
    $("#mesa-id").value = mesa ? mesa.id : "";
    $("#mesa-nombre").value = mesa ? mesa.nombre : "";
    $("#mesa-zona").value = mesa ? mesa.zona : "salon";
    $("#mesa-capacidad").value = mesa ? mesa.capacidad : 4;
    $("#mesa-foto").value = mesa ? mesa.foto_url || "" : "";
    $("#mesa-activa").checked = mesa ? mesa.activa : true;
    $("#mesa-dialog-title").textContent = mesa ? "Editar mesa" : "Nueva mesa";
    mesaSubmit.textContent = mesa ? "Guardar cambios" : "Crear mesa";
    updatePreview(mesaPreview, mesa ? mesa.foto_url : "");
    UI.openDialog(mesaDialog);
    setTimeout(() => $("#mesa-nombre")?.focus(), 50);
  }

  async function saveMesa(event) {
    event.preventDefault();
    showFormError(mesaError, mesaErrorText, "");

    const id = $("#mesa-id").value || null;
    const nombre = $("#mesa-nombre").value.trim();
    const zona = $("#mesa-zona").value;
    const capacidad = Number($("#mesa-capacidad").value);
    const foto = $("#mesa-foto").value.trim();
    const activa = $("#mesa-activa").checked;

    if (nombre.length < 2) {
      showFormError(mesaError, mesaErrorText, "El nombre debe tener al menos 2 caracteres.");
      $("#mesa-nombre").focus();
      return;
    }
    if (!Number.isInteger(capacidad) || capacidad < 1 || capacidad > 30) {
      showFormError(mesaError, mesaErrorText, "La capacidad debe ser un número entero entre 1 y 30.");
      $("#mesa-capacidad").focus();
      return;
    }

    UI.setButtonLoading(mesaSubmit, true, "Guardando…");
    try {
      await API.adminSaveMesa({ id, nombre, zona, capacidad, foto_url: foto, activa });
      UI.closeDialog(mesaDialog);
      toastSuccess(id ? "La mesa se actualizó correctamente." : "La mesa se creó correctamente.", id ? "Mesa actualizada" : "Mesa creada");
      await reloadMesas();
      await reloadAllReservas();
      if (state.section === "reservas") await reloadReservasTable();
    } catch (error) {
      if (handleApiError(error)) return;
      showFormError(mesaError, mesaErrorText, API.helpers.errorMessage(error));
    } finally {
      UI.setButtonLoading(mesaSubmit, false);
    }
  }

  async function toggleMesa(id, activa, checkbox) {
    if (checkbox) checkbox.disabled = true;
    try {
      const mesa = await API.adminToggleMesa(id, activa);
      state.mesas = state.mesas.map((item) => (item.id === mesa.id ? mesa : item));
      renderMesas();
      renderMetrics();
      toastSuccess(activa ? "La mesa vuelve a estar visible para reservas." : "La mesa quedó oculta para los clientes.", activa ? "Mesa activada" : "Mesa desactivada");
    } catch (error) {
      if (checkbox) checkbox.checked = !checkbox.checked;
      if (!handleApiError(error)) toastError(error);
    } finally {
      if (checkbox) checkbox.disabled = false;
    }
  }

  async function deleteMesa(id) {
    const mesa = state.mesas.find((item) => item.id === id);
    if (!mesa) return;
    const confirmed = await UI.confirm({
      title: `¿Eliminar ${mesa.nombre}?`,
      message: "La mesa se borrará definitivamente. Si tiene reservas asociadas, el sistema no permitirá eliminarla; en ese caso puedes desactivarla.",
      confirmLabel: "Eliminar mesa",
      danger: true
    });
    if (!confirmed) return;

    try {
      await API.adminDeleteMesa(id);
      state.mesas = state.mesas.filter((item) => item.id !== id);
      renderMesas();
      renderMetrics();
      populateMesaFilter();
      toastSuccess("La mesa se eliminó del restaurante.", "Mesa eliminada");
    } catch (error) {
      if (!handleApiError(error)) toastError(error, "No se pudo eliminar");
    }
  }

  function bindMesas() {
    nuevaMesaBtn?.addEventListener("click", () => openMesaDialog(null));
    mesaForm?.addEventListener("submit", saveMesa);
    mesaForm?.addEventListener("input", () => showFormError(mesaError, mesaErrorText, ""));
    $("#mesa-foto")?.addEventListener("input", (event) => updatePreview(mesaPreview, event.target.value));

    mesasSearch?.addEventListener("input", (event) => {
      state.mesaSearch = event.target.value;
      renderMesas();
    });

    mesasTbody?.addEventListener("click", (event) => {
      const edit = event.target.closest("[data-mesa-edit]");
      if (edit) {
        const mesa = state.mesas.find((item) => item.id === edit.dataset.mesaEdit);
        if (mesa) openMesaDialog(mesa);
        return;
      }
      const remove = event.target.closest("[data-mesa-delete]");
      if (remove) deleteMesa(remove.dataset.mesaDelete);
    });

    mesasTbody?.addEventListener("change", (event) => {
      const toggle = event.target.closest("[data-mesa-toggle]");
      if (toggle) toggleMesa(toggle.dataset.mesaToggle, toggle.checked, toggle);
    });

    UI.bindDialogClose(mesaDialog, () => showFormError(mesaError, mesaErrorText, ""));
  }

  /* ---------- Horarios ---------- */
  function findHorario(day, jornada) {
    return state.horarios.find((row) => row.dia_semana === day && row.jornada === jornada);
  }

  function horarioValue(day, jornada, field, fallback) {
    const row = findHorario(day, jornada);
    if (!row) return fallback;
    return row[field] == null ? fallback : row[field];
  }

  function renderHorarios() {
    const allowedDurations = ["30", "45", "60", "90", "120"];
    const durations = state.horarios.map((row) => Number(row.duracion_slot) || 60);
    const uniqueDurations = Array.from(new Set(durations));
    if (uniqueDurations.length === 1 && allowedDurations.includes(String(uniqueDurations[0]))) {
      duracionGlobal.value = String(uniqueDurations[0]);
    } else if (!state.horarios.length || uniqueDurations.length !== 1) {
      duracionGlobal.value = "60";
    }

    horariosTbody.innerHTML = DAYS.map((day) => {
      const lunch = findHorario(day, "almuerzo");
      const dinner = findHorario(day, "noche");
      const lunchActive = Boolean(lunch && lunch.activo);
      const dinnerActive = Boolean(dinner && dinner.activo);
      const lunchStart = horarioValue(day, "almuerzo", "hora_inicio", "12:30");
      const lunchEnd = horarioValue(day, "almuerzo", "hora_fin", "14:30");
      const dinnerStart = horarioValue(day, "noche", "hora_inicio", "17:00");
      const dinnerEnd = horarioValue(day, "noche", "hora_fin", "23:00");

      return `
        <tr data-day="${esc(day)}">
          <td class="day-cell">${esc(DAY_LABEL[day])}</td>
          <td><input class="time-input" type="time" value="${esc(lunchStart)}" data-jornada="almuerzo" data-field="inicio" aria-label="Almuerzo inicio ${esc(DAY_LABEL[day])}" ${lunchActive ? "" : "disabled"}></td>
          <td><input class="time-input" type="time" value="${esc(lunchEnd)}" data-jornada="almuerzo" data-field="fin" aria-label="Almuerzo fin ${esc(DAY_LABEL[day])}" ${lunchActive ? "" : "disabled"}></td>
          <td><input class="time-input" type="time" value="${esc(dinnerStart)}" data-jornada="noche" data-field="inicio" aria-label="Noche inicio ${esc(DAY_LABEL[day])}" ${dinnerActive ? "" : "disabled"}></td>
          <td><input class="time-input" type="time" value="${esc(dinnerEnd)}" data-jornada="noche" data-field="fin" aria-label="Noche fin ${esc(DAY_LABEL[day])}" ${dinnerActive ? "" : "disabled"}></td>
          <td>
            <div class="schedule-toggles">
              <label class="schedule-toggle" title="Activar o cerrar el almuerzo">
                <span class="switch switch--inline">
                  <input type="checkbox" data-jornada="almuerzo" data-field="activo" ${lunchActive ? "checked" : ""} aria-label="Almuerzo activo ${esc(DAY_LABEL[day])}">
                  <span></span>
                </span>
                Almuerzo
              </label>
              <label class="schedule-toggle" title="Activar o cerrar la noche">
                <span class="switch switch--inline">
                  <input type="checkbox" data-jornada="noche" data-field="activo" ${dinnerActive ? "checked" : ""} aria-label="Noche activa ${esc(DAY_LABEL[day])}">
                  <span></span>
                </span>
                Noche
              </label>
            </div>
          </td>
        </tr>`;
    }).join("");
  }

  function syncRowDisabled(row) {
    if (!row) return;
    ["almuerzo", "noche"].forEach((jornada) => {
      const toggle = row.querySelector(`input[data-jornada="${jornada}"][data-field="activo"]`);
      const active = Boolean(toggle && toggle.checked);
      row.querySelectorAll(`input.time-input[data-jornada="${jornada}"]`).forEach((input) => {
        input.disabled = !active;
      });
    });
  }

  function copyMonday() {
    const monday = horariosTbody.querySelector('tr[data-day="lunes"]');
    if (!monday) return;
    const source = {
      lunchStart: monday.querySelector('input[data-jornada="almuerzo"][data-field="inicio"]').value,
      lunchEnd: monday.querySelector('input[data-jornada="almuerzo"][data-field="fin"]').value,
      dinnerStart: monday.querySelector('input[data-jornada="noche"][data-field="inicio"]').value,
      dinnerEnd: monday.querySelector('input[data-jornada="noche"][data-field="fin"]').value,
      lunchActive: monday.querySelector('input[data-jornada="almuerzo"][data-field="activo"]').checked,
      dinnerActive: monday.querySelector('input[data-jornada="noche"][data-field="activo"]').checked
    };

    $$('tr[data-day]', horariosTbody).forEach((row) => {
      if (row === monday) return;
      row.querySelector('input[data-jornada="almuerzo"][data-field="inicio"]').value = source.lunchStart;
      row.querySelector('input[data-jornada="almuerzo"][data-field="fin"]').value = source.lunchEnd;
      row.querySelector('input[data-jornada="noche"][data-field="inicio"]').value = source.dinnerStart;
      row.querySelector('input[data-jornada="noche"][data-field="fin"]').value = source.dinnerEnd;
      row.querySelector('input[data-jornada="almuerzo"][data-field="activo"]').checked = source.lunchActive;
      row.querySelector('input[data-jornada="noche"][data-field="activo"]').checked = source.dinnerActive;
      row.querySelectorAll(".time-input").forEach((input) => input.classList.remove("is-invalid"));
      syncRowDisabled(row);
    });
    UI.toast("El horario del lunes se copió a todos los días. Guarda los cambios para aplicarlo.", "info", "Horario copiado");
  }

  async function saveHorarios() {
    const duration = Number(duracionGlobal.value);
    if (!Number.isFinite(duration) || duration < 30 || duration > 180) {
      UI.toast("La duración debe estar entre 30 y 180 minutos.", "error", "Revisa la duración");
      return;
    }

    const rows = [];
    let invalid = false;

    $$('tr[data-day]', horariosTbody).forEach((row) => {
      const day = row.dataset.day;
      ["almuerzo", "noche"].forEach((jornada) => {
        const startInput = row.querySelector(`input[data-jornada="${jornada}"][data-field="inicio"]`);
        const endInput = row.querySelector(`input[data-jornada="${jornada}"][data-field="fin"]`);
        const activeInput = row.querySelector(`input[data-jornada="${jornada}"][data-field="activo"]`);
        const start = UI.normalizeTime(startInput.value);
        const end = UI.normalizeTime(endInput.value);
        const startOk = UI.isValidTime(start);
        const endOk = UI.isValidTime(end);
        const rangeOk = startOk && endOk && UI.minutesOf(end) > UI.minutesOf(start);
        startInput.classList.toggle("is-invalid", !startOk);
        endInput.classList.toggle("is-invalid", !rangeOk);

        if (!startOk || !rangeOk) {
          invalid = true;
          return;
        }

        const existing = findHorario(day, jornada);
        rows.push({
          id: existing ? existing.id : null,
          dia_semana: day,
          jornada,
          hora_inicio: start,
          hora_fin: end,
          duracion_slot: duration,
          activo: Boolean(activeInput.checked)
        });
      });
    });

    if (invalid || rows.length !== DAYS.length * 2) {
      UI.toast("Revisa las horas marcadas: el fin de cada jornada debe ser posterior al inicio.", "error", "Horario inválido");
      return;
    }

    UI.setButtonLoading(guardarHorariosBtn, true, "Guardando…");
    try {
      state.horarios = await API.adminSaveHorarios(rows);
      renderHorarios();
      toastSuccess("El calendario del cliente ya usa estos horarios.", "Horarios guardados");
    } catch (error) {
      if (!handleApiError(error)) toastError(error, "No se pudieron guardar");
    } finally {
      UI.setButtonLoading(guardarHorariosBtn, false);
    }
  }

  function bindHorarios() {
    guardarHorariosBtn?.addEventListener("click", saveHorarios);
    copiarHorarioBtn?.addEventListener("click", copyMonday);

    horariosTbody?.addEventListener("change", (event) => {
      const toggle = event.target.closest('input[data-field="activo"]');
      if (toggle) {
        const row = toggle.closest("tr[data-day]");
        syncRowDisabled(row);
      }
    });

    horariosTbody?.addEventListener("input", (event) => {
      if (event.target.matches("input.time-input")) {
        event.target.classList.remove("is-invalid");
      }
    });
  }

  /* ---------- Reservas ---------- */
  function populateMesaFilter() {
    if (!filtroMesa) return;
    const current = state.filters.mesaId || filtroMesa.value || "";
    const options = [`<option value="">Todas</option>`]
      .concat(state.mesas.map((mesa) => `<option value="${esc(mesa.id)}">${esc(mesa.nombre)}</option>`));
    filtroMesa.innerHTML = options.join("");
    if (current && state.mesas.some((mesa) => mesa.id === current)) {
      filtroMesa.value = current;
      state.filters.mesaId = current;
    } else {
      filtroMesa.value = "";
      state.filters.mesaId = "";
    }
  }

  function renderReservas() {
    if (reservasCount) {
      const total = state.allReservas.length;
      reservasCount.textContent = `${state.reservas.length} de ${total} reservas`;
    }

    if (!state.reservas.length) {
      setEmpty(
        reservasTbody,
        7,
        "No hay reservas con estos filtros",
        "Cambia la fecha, la mesa o el estado para ampliar la búsqueda."
      );
      return;
    }

    reservasTbody.innerHTML = state.reservas.map((reserva) => `
      <tr data-reserva-row="${esc(reserva.id)}">
        <td>
          <div class="table-user">
            <span class="avatar-initials" aria-hidden="true">${esc(initials(reserva.cliente_nombre))}</span>
            <div>
              <span class="cell-strong">${esc(reserva.cliente_nombre)}</span>
              <span class="cell-sub">${esc(reserva.cliente_contacto || "Sin contacto")}</span>
            </div>
          </div>
        </td>
        <td>
          <span class="cell-strong">${esc(reserva.mesa_nombre || "Mesa eliminada")}</span>
          <span class="cell-sub">${esc(ZONA_LABEL[reserva.mesa_zona] || reserva.mesa_zona || "—")}</span>
        </td>
        <td>
          <span class="cell-strong">${esc(UI.formatDateMedium(reserva.fecha))}</span>
          <span class="cell-sub">${esc(UI.dayKey(reserva.fecha))}</span>
        </td>
        <td><span class="cell-strong mono">${esc(UI.formatTimeRange(reserva.hora_inicio, reserva.hora_fin))}</span></td>
        <td><span class="cell-strong">${esc(reserva.num_personas)}</span><span class="cell-sub">${reserva.num_personas === 1 ? "persona" : "personas"}</span></td>
        <td>${estadoBadge(reserva.estado)}</td>
        <td>
          <div class="row-actions">
            <select class="status-select" data-reserva-estado="${esc(reserva.id)}" aria-label="Estado de la reserva de ${esc(reserva.cliente_nombre)}">
              ${Object.entries(ESTADO_LABEL).map(([value, label]) => `<option value="${value}" ${reserva.estado === value ? "selected" : ""}>${label}</option>`).join("")}
            </select>
            <button class="icon-btn icon-btn--sm" type="button" data-reserva-detail="${esc(reserva.id)}" aria-label="Ver detalle de la reserva de ${esc(reserva.cliente_nombre)}" title="Ver detalle">${UI.icon("eye")}</button>
          </div>
        </td>
      </tr>`).join("");
  }

  function reservaById(id) {
    return state.allReservas.find((reserva) => reserva.id === id) ||
      state.reservas.find((reserva) => reserva.id === id) ||
      null;
  }

  function renderReservaDetail(reserva) {
    if (!reserva) return;
    if (reservaDialogSub) {
      reservaDialogSub.textContent = `${UI.formatDateWithDay(reserva.fecha)} · ${UI.formatTimeRange(reserva.hora_inicio, reserva.hora_fin)}`;
    }

    const contact = reserva.cliente_contacto
      ? `<a href="tel:${esc(String(reserva.cliente_contacto).replace(/[^\d+]/g, ""))}">${esc(reserva.cliente_contacto)}</a>`
      : "Sin contacto registrado";

    reservaDetail.innerHTML = `
      <div class="detail-hero">
        <div>
          <span class="detail-hero__code">${esc(UI.reservationCode(reserva.id))}</span>
          <span class="detail-hero__meta">Código de reserva</span>
        </div>
        ${estadoBadge(reserva.estado)}
      </div>
      <div class="detail-grid">
        <div class="detail-row detail-row--full">
          <span class="detail-label">Cliente</span>
          <span class="detail-value">${esc(reserva.cliente_nombre)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Contacto</span>
          <span class="detail-value">${contact}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Personas</span>
          <span class="detail-value">${esc(reserva.num_personas)} ${reserva.num_personas === 1 ? "persona" : "personas"}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Mesa</span>
          <span class="detail-value">${esc(reserva.mesa_nombre || "Mesa eliminada")} · ${esc(ZONA_LABEL[reserva.mesa_zona] || reserva.mesa_zona || "—")}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Fecha y hora</span>
          <span class="detail-value">${esc(UI.formatDateMedium(reserva.fecha))}<br>${esc(UI.formatTimeRange(reserva.hora_inicio, reserva.hora_fin))}</span>
        </div>
        <div class="detail-row detail-row--full">
          <span class="detail-label">Creada</span>
          <span class="detail-value">${esc(formatCreado(reserva.creado_en))}</span>
        </div>
      </div>`;

    const actions = [];
    if (reserva.estado !== "confirmada") {
      actions.push(`<button class="btn btn--primary btn--sm" type="button" data-detail-estado="confirmada">Reconfirmar</button>`);
    }
    if (reserva.estado !== "completada") {
      actions.push(`<button class="btn btn--blush btn--sm" type="button" data-detail-estado="completada">Marcar completada</button>`);
    }
    if (reserva.estado !== "cancelada") {
      actions.push(`<button class="btn btn--ghost btn--sm" type="button" data-detail-estado="cancelada">Cancelar reserva</button>`);
    }
    actions.push(`<button class="btn btn--ghost btn--sm" type="button" data-detail-close>Cerrar</button>`);

    reservaDialogFoot.innerHTML = actions.join("");
  }

  function openReservaDetail(id) {
    const reserva = reservaById(id);
    if (!reserva) {
      UI.toast("La reserva ya no está disponible.", "error", "No encontrada");
      return;
    }
    state.detailReservaId = id;
    renderReservaDetail(reserva);
    UI.openDialog(reservaDialog);
  }

  async function setReservaEstado(id, estado) {
    const reserva = reservaById(id);
    if (!reserva) return false;
    if (reserva.estado === estado) return true;

    if (estado === "cancelada") {
      const confirmed = await UI.confirm({
        title: "¿Cancelar esta reserva?",
        message: `Se cancelará la reserva de ${reserva.cliente_nombre} para el ${UI.formatDateMedium(reserva.fecha)} a las ${UI.formatTime12(reserva.hora_inicio)}. El horario quedará libre para otro cliente.`,
        confirmLabel: "Cancelar reserva",
        cancelLabel: "Conservar",
        danger: true
      });
      if (!confirmed) return false;
    }

    try {
      const updated = await API.adminUpdateReservaEstado(id, estado);
      state.allReservas = state.allReservas.map((item) => (item.id === updated.id ? { ...item, ...updated } : item));
      state.reservas = state.reservas.map((item) => (item.id === updated.id ? { ...item, ...updated } : item));
      renderMetrics();
      await reloadReservasTable();
      if (state.detailReservaId === id) {
        const current = reservaById(id);
        if (current) renderReservaDetail(current);
      }
      const messages = {
        confirmada: "La reserva vuelve a estar confirmada.",
        completada: "La reserva quedó marcada como completada.",
        cancelada: "La reserva se canceló y el horario quedó libre."
      };
      toastSuccess(messages[estado] || "El estado se actualizó.", "Reserva actualizada");
      return true;
    } catch (error) {
      if (!handleApiError(error)) toastError(error, "No se pudo actualizar");
      return false;
    }
  }

  function bindReservas() {
    filtroFecha?.addEventListener("change", () => {
      state.filters.fecha = filtroFecha.value;
      reloadReservasTable();
    });
    filtroMesa?.addEventListener("change", () => {
      state.filters.mesaId = filtroMesa.value;
      reloadReservasTable();
    });
    filtroEstado?.addEventListener("change", () => {
      state.filters.estado = filtroEstado.value;
      reloadReservasTable();
    });

    limpiarFiltrosBtn?.addEventListener("click", () => {
      state.filters = { fecha: "", mesaId: "", estado: "" };
      filtroFecha.value = "";
      filtroMesa.value = "";
      filtroEstado.value = "";
      reloadReservasTable();
    });

    actualizarReservasBtn?.addEventListener("click", async () => {
      actualizarReservasBtn.disabled = true;
      const ok = await Promise.all([reloadAllReservas(), reloadReservasTable()]);
      actualizarReservasBtn.disabled = false;
      if (ok.every(Boolean)) UI.toast("Las reservas se actualizaron.", "info", "Datos al día");
    });

    reservasTbody?.addEventListener("click", (event) => {
      const detail = event.target.closest("[data-reserva-detail]");
      if (detail) openReservaDetail(detail.dataset.reservaDetail);
    });

    reservasTbody?.addEventListener("change", async (event) => {
      const select = event.target.closest("[data-reserva-estado]");
      if (!select) return;
      const id = select.dataset.reservaEstado;
      const previous = reservaById(id);
      const previousState = previous ? previous.estado : "confirmada";
      const nextState = select.value;
      select.disabled = true;
      const ok = await setReservaEstado(id, nextState);
      if (!ok) select.value = previousState;
      select.disabled = false;
    });

    reservaDialog?.addEventListener("click", async (event) => {
      if (event.target.closest("[data-detail-close]")) {
        UI.closeDialog(reservaDialog);
        return;
      }
      const action = event.target.closest("[data-detail-estado]");
      if (!action) return;
      action.disabled = true;
      await setReservaEstado(state.detailReservaId, action.dataset.detailEstado);
      action.disabled = false;
    });

    reservaDialog?.addEventListener("close", () => {
      state.detailReservaId = null;
    });

    UI.bindDialogClose(reservaDialog);
  }

  /* ---------- Carta ---------- */
  function renderCartaFilters() {
    if (!cartaFilters) return;
    const counts = {
      all: state.platos.length,
      pizzas: 0,
      entradas: 0,
      postres: 0,
      bebidas: 0
    };
    state.platos.forEach((plato) => {
      if (counts[plato.categoria] != null) counts[plato.categoria] += 1;
    });

    const options = [
      ["all", "Todo"],
      ["pizzas", "Pizzas"],
      ["entradas", "Entradas"],
      ["postres", "Postres"],
      ["bebidas", "Bebidas"]
    ];
    cartaFilters.innerHTML = options.map(([key, label]) => `
      <button class="pill ${state.cartaFilter === key ? "is-active" : ""}" type="button" data-carta-filter="${key}" aria-pressed="${state.cartaFilter === key}">
        ${esc(label)} <span class="count">${counts[key]}</span>
      </button>`).join("");
  }

  function renderPlatos() {
    renderCartaFilters();
    const rows = state.platos.filter((plato) => state.cartaFilter === "all" || plato.categoria === state.cartaFilter);
    if (platosCount) platosCount.textContent = `${rows.length} de ${state.platos.length} productos`;

    if (!rows.length) {
      setEmpty(
        platosTbody,
        6,
        state.platos.length ? "Sin productos en esta categoría" : "La carta está vacía",
        state.platos.length ? "Cambia el filtro o agrega un producto." : "Agrega el primer producto de la carta."
      );
      return;
    }

    platosTbody.innerHTML = rows.map((plato) => {
      const photo = imageUrl(plato.foto_url);
      return `
        <tr data-plato-row="${esc(plato.id)}">
          <td>
            <div class="product-cell">
              ${photo
                ? `<img class="thumb" src="${esc(photo)}" alt="" width="46" height="46" loading="lazy">`
                : `<span class="thumb thumb--empty" aria-hidden="true">${UI.icon("image")}</span>`}
              <div class="product-cell__text">
                <span class="cell-strong">${esc(plato.nombre)}</span>
                <span class="cell-sub">${plato.disponible ? "Visible en la carta" : "Oculto al público"}</span>
              </div>
            </div>
          </td>
          <td><span class="category-pill">${esc(CATEGORIA_LABEL[plato.categoria] || plato.categoria)}</span></td>
          <td><span class="desc-cell">${esc(plato.descripcion || "Sin descripción")}</span></td>
          <td><span class="price-cell">${esc(UI.formatCurrency(plato.precio))}</span></td>
          <td>
            <label class="switch-row" style="padding:0;border:0;background:transparent;gap:10px" title="${plato.disponible ? "Marcar como no disponible" : "Marcar como disponible"}">
              <span class="switch switch--inline">
                <input type="checkbox" data-plato-toggle="${esc(plato.id)}" ${plato.disponible ? "checked" : ""} aria-label="${plato.disponible ? "Ocultar" : "Mostrar"} ${esc(plato.nombre)}">
                <span></span>
              </span>
              <span class="cell-sub" style="margin:0">${plato.disponible ? "Disponible" : "No disponible"}</span>
            </label>
          </td>
          <td>
            <div class="row-actions">
              <button class="icon-btn icon-btn--sm" type="button" data-plato-edit="${esc(plato.id)}" aria-label="Editar ${esc(plato.nombre)}" title="Editar">${UI.icon("edit")}</button>
              <button class="icon-btn icon-btn--sm icon-btn--danger" type="button" data-plato-delete="${esc(plato.id)}" aria-label="Eliminar ${esc(plato.nombre)}" title="Eliminar">${UI.icon("trash")}</button>
            </div>
          </td>
        </tr>`;
    }).join("");
  }

  function openPlatoDialog(plato) {
    platoForm.reset();
    showFormError(platoError, platoErrorText, "");
    $("#plato-id").value = plato ? plato.id : "";
    $("#plato-nombre").value = plato ? plato.nombre : "";
    $("#plato-categoria").value = plato ? plato.categoria : "pizzas";
    $("#plato-precio").value = plato ? plato.precio : "";
    $("#plato-descripcion").value = plato ? plato.descripcion || "" : "";
    $("#plato-foto").value = plato ? plato.foto_url || "" : "";
    $("#plato-disponible").checked = plato ? plato.disponible : true;
    $("#plato-dialog-title").textContent = plato ? "Editar producto" : "Nuevo producto";
    platoSubmit.textContent = plato ? "Guardar cambios" : "Crear producto";
    updatePreview(platoPreview, plato ? plato.foto_url : "");
    UI.openDialog(platoDialog);
    setTimeout(() => $("#plato-nombre")?.focus(), 50);
  }

  async function savePlato(event) {
    event.preventDefault();
    showFormError(platoError, platoErrorText, "");

    const id = $("#plato-id").value || null;
    const nombre = $("#plato-nombre").value.trim();
    const categoria = $("#plato-categoria").value;
    const precioRaw = $("#plato-precio").value.trim();
    const precio = Number(precioRaw);
    const descripcion = $("#plato-descripcion").value.trim();
    const foto = $("#plato-foto").value.trim();
    const disponible = $("#plato-disponible").checked;

    if (nombre.length < 2) {
      showFormError(platoError, platoErrorText, "El nombre debe tener al menos 2 caracteres.");
      $("#plato-nombre").focus();
      return;
    }
    if (!CATEGORIA_LABEL[categoria]) {
      showFormError(platoError, platoErrorText, "Selecciona una categoría válida.");
      return;
    }
    if (!precioRaw || !Number.isFinite(precio) || precio < 0) {
      showFormError(platoError, platoErrorText, "El precio debe ser un número mayor o igual a cero.");
      $("#plato-precio").focus();
      return;
    }

    UI.setButtonLoading(platoSubmit, true, "Guardando…");
    try {
      await API.adminSavePlato({ id, nombre, categoria, descripcion, precio, foto_url: foto, disponible });
      UI.closeDialog(platoDialog);
      toastSuccess(id ? "El producto se actualizó correctamente." : "El producto se agregó a la carta.", id ? "Producto actualizado" : "Producto creado");
      await reloadPlatos();
    } catch (error) {
      if (handleApiError(error)) return;
      showFormError(platoError, platoErrorText, API.helpers.errorMessage(error));
    } finally {
      UI.setButtonLoading(platoSubmit, false);
    }
  }

  async function togglePlato(id, disponible, checkbox) {
    if (checkbox) checkbox.disabled = true;
    try {
      const plato = await API.adminTogglePlato(id, disponible);
      state.platos = state.platos.map((item) => (item.id === plato.id ? plato : item));
      renderPlatos();
      renderMetrics();
      toastSuccess(disponible ? "El producto vuelve a aparecer en la carta pública." : "El producto quedó oculto en la carta pública.", disponible ? "Producto disponible" : "Producto oculto");
    } catch (error) {
      if (checkbox) checkbox.checked = !checkbox.checked;
      if (!handleApiError(error)) toastError(error);
    } finally {
      if (checkbox) checkbox.disabled = false;
    }
  }

  async function deletePlato(id) {
    const plato = state.platos.find((item) => item.id === id);
    if (!plato) return;
    const confirmed = await UI.confirm({
      title: `¿Eliminar ${plato.nombre}?`,
      message: "El producto se borrará definitivamente de la carta. Si solo quieres ocultarlo, usa el interruptor de disponibilidad.",
      confirmLabel: "Eliminar producto",
      danger: true
    });
    if (!confirmed) return;

    try {
      await API.adminDeletePlato(id);
      state.platos = state.platos.filter((item) => item.id !== id);
      renderPlatos();
      renderMetrics();
      toastSuccess("El producto se eliminó de la carta.", "Producto eliminado");
    } catch (error) {
      if (!handleApiError(error)) toastError(error, "No se pudo eliminar");
    }
  }

  function bindCarta() {
    nuevoPlatoBtn?.addEventListener("click", () => openPlatoDialog(null));
    platoForm?.addEventListener("submit", savePlato);
    platoForm?.addEventListener("input", () => showFormError(platoError, platoErrorText, ""));
    $("#plato-foto")?.addEventListener("input", (event) => updatePreview(platoPreview, event.target.value));

    cartaFilters?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-carta-filter]");
      if (!button) return;
      state.cartaFilter = button.dataset.cartaFilter;
      renderPlatos();
    });

    platosTbody?.addEventListener("click", (event) => {
      const edit = event.target.closest("[data-plato-edit]");
      if (edit) {
        const plato = state.platos.find((item) => item.id === edit.dataset.platoEdit);
        if (plato) openPlatoDialog(plato);
        return;
      }
      const remove = event.target.closest("[data-plato-delete]");
      if (remove) deletePlato(remove.dataset.platoDelete);
    });

    platosTbody?.addEventListener("change", (event) => {
      const toggle = event.target.closest("[data-plato-toggle]");
      if (toggle) togglePlato(toggle.dataset.platoToggle, toggle.checked, toggle);
    });

    UI.bindDialogClose(platoDialog, () => showFormError(platoError, platoErrorText, ""));
  }

  /* ---------- Bindings generales ---------- */
  function bindDialogs() {
    [mesaDialog, platoDialog, reservaDialog].forEach((dialog) => {
      dialog?.addEventListener("click", (event) => {
        if (event.target === dialog) UI.closeDialog(dialog);
      });
    });
  }

  function bindGlobal() {
    loginForm?.addEventListener("submit", handleLogin);
    loginPassword?.addEventListener("input", () => showFormError(loginError, loginErrorText, ""));
    passwordToggle?.addEventListener("click", togglePassword);
    logoutBtn?.addEventListener("click", handleLogout);

    refreshBtn?.addEventListener("click", async () => {
      if (!state.session) return;
      refreshBtn.disabled = true;
      const ok = await refreshAll();
      refreshBtn.disabled = false;
      if (ok) UI.toast("La sección se actualizó.", "info", "Datos al día");
    });

    bindNavigation();
    bindMesas();
    bindHorarios();
    bindReservas();
    bindCarta();
    bindDialogs();
  }

  /* ---------- Arranque ---------- */
  async function init() {
    bindGlobal();
    setTopbarDate();
    updateModeChip();

    try {
      await API.init();
      state.ready = true;
      updateModeChip();
    } catch (error) {
      updateModeChip();
      const message = API.helpers.errorMessage(error);
      showFormError(loginError, loginErrorText, message);
      if (loginSubmit) loginSubmit.disabled = true;
      if (loginChip) {
        loginChip.innerHTML = "<i></i> Sin conexión";
        loginChip.classList.remove("datasource-chip--live");
      }
      UI.toast(message, "error", "No se pudo conectar");
      return;
    }

    let valid = false;
    try {
      valid = await API.adminVerifySession();
    } catch (error) {
      valid = false;
    }

    if (valid) {
      await enterApp();
    } else {
      showLogin();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
