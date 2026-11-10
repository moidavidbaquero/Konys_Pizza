/* ============================================================
   KONYS PIZZA — Módulo cliente
   Mesas, disponibilidad, calendario, horarios, reserva real,
   confirmación y carta digital.
   ============================================================ */
(function () {
  "use strict";

  const UI = window.KonysUI;
  const API = window.KonysAPI;
  const CONFIG = window.KONYS_CONFIG;

  const CATEGORY_LABELS = {
    todas: "Todo",
    pizzas: "Pizzas",
    entradas: "Entradas",
    postres: "Postres",
    bebidas: "Bebidas"
  };
  const CATEGORY_ORDER = ["pizzas", "entradas", "postres", "bebidas"];
  const ZONE_LABELS = { salon: "Salón", terraza: "Terraza" };
  const FALLBACK_IMAGES = {
    pizzas: "assets/img/hero-slice.webp",
    entradas: "assets/img/entrada-ajo.webp",
    postres: "assets/img/postre-tiramisu.webp",
    bebidas: "assets/img/bebida-limonada.webp",
    mesa: "assets/img/mesa-salon.webp"
  };

  const state = {
    mesas: [],
    horarios: [],
    platos: [],
    selectedMesaId: "",
    selectedDate: "",
    selectedTime: "",
    mesasDate: UI.todayISO(),
    calendarMonth: UI.startOfMonth(UI.todayISO()),
    occupiedByDate: new Map(),
    category: "todas",
    loading: true,
    fatal: null
  };

  const dom = {};

  function cacheDom() {
    [
      "mesas-grid", "mesas-empty", "mesas-date", "quick-dates", "refresh-mesas",
      "carta-grid", "carta-empty", "carta-filters",
      "table-picker", "step-mesa-hint",
      "booking-calendar", "cal-month", "cal-prev", "cal-next", "slots-container", "slots-day-label",
      "nombre", "contacto", "personas", "personas-minus", "personas-plus", "capacidad-hint",
      "field-nombre", "field-personas", "error-nombre", "error-personas", "form-error", "form-error-text",
      "sum-mesa", "sum-zona", "sum-fecha", "sum-hora", "sum-personas", "sum-cliente", "sum-state",
      "summary-alert", "confirmar-btn", "confirmar-label",
      "success-dialog", "success-code", "success-cliente", "success-mesa", "success-zona",
      "success-fecha", "success-hora", "success-personas", "success-home", "success-again",
      "data-source-chip", "reserva-form"
    ].forEach((id) => {
      dom[id] = document.getElementById(id);
    });
    dom.navLinks = UI.qsa(".nav__link");
  }

  /* ---------------- Datos y fechas ---------------- */
  function maxDate() { return UI.addDaysISO(UI.todayISO(), CONFIG.ui.maxAdvanceDays); }

  function shiftsFor(dateISO) {
    const day = UI.dayKey(dateISO);
    return state.horarios.filter((row) => row.activo && row.dia_semana === day);
  }

  function hasService(dateISO) {
    return shiftsFor(dateISO).length > 0;
  }

  function buildSlots(dateISO, mesaId) {
    const shifts = shiftsFor(dateISO);
    if (!shifts.length) return [];
    const ranges = state.occupiedByDate.get(dateISO) || [];
    const today = UI.todayISO();
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const isToday = dateISO === today;

    const result = [];
    shifts.forEach((shift) => {
      const start = UI.minutesOf(shift.hora_inicio);
      const finish = UI.minutesOf(shift.hora_fin);
      for (let minute = start; minute + shift.duracion_slot <= finish; minute += shift.duracion_slot) {
        const startTime = UI.timeFromMinutes(minute);
        const endTime = UI.timeFromMinutes(minute + shift.duracion_slot);
        const busy = ranges.some((range) => (
          range.mesa_id === mesaId &&
          UI.minutesOf(startTime) < UI.minutesOf(range.hora_fin) &&
          UI.minutesOf(endTime) > UI.minutesOf(range.hora_inicio)
        ));
        const past = isToday && minute < currentMinutes + CONFIG.ui.minLeadMinutes;
        result.push({
          start: startTime,
          end: endTime,
          jornada: shift.jornada,
          busy,
          past,
          free: !busy && !past
        });
      }
    });
    return result;
  }

  function freeSlotsFor(dateISO, mesaId) {
    return buildSlots(dateISO, mesaId).filter((slot) => slot.free);
  }

  function findMesa(id) { return state.mesas.find((mesa) => mesa.id === id) || null; }

  function firstOpenDate() {
    const today = UI.todayISO();
    for (let offset = 0; offset <= CONFIG.ui.maxAdvanceDays; offset += 1) {
      const date = UI.addDaysISO(today, offset);
      if (!hasService(date)) continue;
      const now = new Date();
      const current = now.getHours() * 60 + now.getMinutes();
      const anyFuture = shiftsFor(date).some((shift) => (
        UI.minutesOf(shift.hora_inicio) + shift.duracion_slot >= current + CONFIG.ui.minLeadMinutes
      ));
      if (offset === 0 && !anyFuture) continue;
      return date;
    }
    return today;
  }

  async function ensureOccupied(dateISO, force) {
    if (!dateISO) return [];
    if (!force && state.occupiedByDate.has(dateISO)) return state.occupiedByDate.get(dateISO);
    const rows = await API.getOccupied(dateISO);
    state.occupiedByDate.set(dateISO, rows);
    return rows;
  }

  /* ---------------- Mesas ---------------- */
  function renderMesas() {
    if (!dom["mesas-grid"]) return;
    const grid = dom["mesas-grid"];
    grid.setAttribute("aria-busy", "false");
    grid.innerHTML = "";
    if (dom["mesas-empty"]) dom["mesas-empty"].hidden = true;

    if (state.fatal) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <strong>No pudimos cargar las mesas</strong>
        <p>${UI.escapeHtml(state.fatal)}</p>
        <button class="btn btn--ghost btn--sm" type="button" onclick="location.reload()">Reintentar</button>
      </div>`;
      return;
    }

    if (!state.mesas.length) {
      if (dom["mesas-empty"]) dom["mesas-empty"].hidden = false;
      return;
    }

    const date = state.mesasDate;
    const service = hasService(date);

    state.mesas.forEach((mesa) => {
      const slots = service ? buildSlots(date, mesa.id) : [];
      const free = slots.filter((slot) => slot.free).length;
      const total = slots.length;
      const selected = mesa.id === state.selectedMesaId;
      const available = free > 0;
      let statusClass = "badge--free";
      let statusText = "Disponible";
      let hint = `${free} ${UI.plural(free, "horario libre", "horarios libres")} para esta fecha`;

      if (!service) {
        statusClass = "badge--busy";
        statusText = "Sin servicio";
        hint = "No hay jornadas activas este día.";
      } else if (!available) {
        statusClass = "badge--busy";
        statusText = "Sin cupo";
        hint = total ? "Todos los horarios están ocupados." : "No hay bloques disponibles.";
      } else if (selected) {
        statusText = "Elegida";
        hint = "Continúa con la fecha y la hora.";
      }

      const card = document.createElement("article");
      card.className = `mesa-card${selected ? " is-selected" : ""}${available ? "" : " is-unavailable"}`;
      card.dataset.mesaId = mesa.id;
      card.innerHTML = `
        <div class="mesa-card__media">
          <img src="${UI.escapeHtml(CONFIG.resolveImage(mesa.foto_url, FALLBACK_IMAGES.mesa))}"
               alt="${UI.escapeHtml(mesa.nombre)} en zona ${ZONE_LABELS[mesa.zona] || mesa.zona}"
               width="900" height="600" loading="lazy" decoding="async">
          <span class="mesa-card__zone">${ZONE_LABELS[mesa.zona] || mesa.zona}</span>
          <span class="mesa-card__status"><span class="badge ${statusClass}"><i class="badge__dot"></i>${statusText}</span></span>
        </div>
        <div class="mesa-card__body">
          <div class="mesa-card__top">
            <div>
              <h3 class="mesa-card__name">${UI.escapeHtml(mesa.nombre)}</h3>
              <span class="mesa-card__cap">${UI.icon("users")} ${mesa.capacidad} ${UI.plural(mesa.capacidad, "persona")}</span>
            </div>
          </div>
          <p class="mesa-card__hint">${UI.escapeHtml(hint)}</p>
          <div class="mesa-card__meta">
            <span>Zona <strong>${ZONE_LABELS[mesa.zona] || mesa.zona}</strong></span>
            <button class="btn ${selected ? "btn--primary" : "btn--ghost"} btn--sm" type="button"
              data-select-mesa="${mesa.id}" ${available ? "" : "disabled"}>
              ${selected ? "Seleccionada" : (available ? "Elegir mesa" : "No disponible")}
            </button>
          </div>
        </div>`;
      grid.append(card);
    });

    UI.qsa("[data-select-mesa]", grid).forEach((button) => {
      button.addEventListener("click", () => chooseMesa(button.dataset.selectMesa, true));
    });
  }

  function renderQuickDates() {
    if (!dom["quick-dates"]) return;
    const today = UI.todayISO();
    const quick = [
      { label: "Hoy", date: today },
      { label: "Mañana", date: UI.addDaysISO(today, 1) },
      { label: "Pasado", date: UI.addDaysISO(today, 2) }
    ];
    dom["quick-dates"].innerHTML = "";
    quick.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `pill${state.mesasDate === item.date ? " is-active" : ""}`;
      button.textContent = item.label;
      button.setAttribute("aria-pressed", String(state.mesasDate === item.date));
      button.addEventListener("click", () => setMesasDate(item.date));
      dom["quick-dates"].append(button);
    });
  }

  async function setMesasDate(dateISO) {
    if (!dateISO) return;
    if (dateISO < UI.todayISO()) dateISO = UI.todayISO();
    if (dateISO > maxDate()) dateISO = maxDate();
    state.mesasDate = dateISO;
    if (dom["mesas-date"]) dom["mesas-date"].value = dateISO;
    renderQuickDates();
    try {
      await ensureOccupied(dateISO, true);
    } catch (error) {
      UI.toast(API.helpers.errorMessage(error), "error");
    }
    renderMesas();
  }

  async function refreshMesas() {
    if (dom["refresh-mesas"]) UI.setButtonLoading(dom["refresh-mesas"], true, "Actualizando");
    try {
      state.mesas = await API.listMesas();
      state.horarios = await API.listHorarios();
      state.occupiedByDate.clear();
      await ensureOccupied(state.mesasDate, true);
      renderMesas();
      renderTablePicker();
      renderSlots();
      UI.toast("Disponibilidad actualizada.", "success", "Al día");
    } catch (error) {
      UI.toast(API.helpers.errorMessage(error), "error");
    } finally {
      if (dom["refresh-mesas"]) UI.setButtonLoading(dom["refresh-mesas"], false);
    }
  }

  /* ---------------- Carta ---------------- */
  function renderMenuFilters() {
    if (!dom["carta-filters"]) return;
    const counts = { todas: state.platos.length };
    CATEGORY_ORDER.forEach((category) => {
      counts[category] = state.platos.filter((plato) => plato.categoria === category).length;
    });
    dom["carta-filters"].innerHTML = "";
    Object.keys(CATEGORY_LABELS).forEach((key) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `pill${state.category === key ? " is-active" : ""}`;
      button.setAttribute("aria-pressed", String(state.category === key));
      button.innerHTML = `${CATEGORY_LABELS[key]} <span class="count">${counts[key] || 0}</span>`;
      button.addEventListener("click", () => {
        state.category = key;
        renderMenuFilters();
        renderMenu();
      });
      dom["carta-filters"].append(button);
    });
  }

  function renderMenu() {
    if (!dom["carta-grid"]) return;
    const grid = dom["carta-grid"];
    grid.setAttribute("aria-busy", "false");
    grid.innerHTML = "";
    const list = state.category === "todas"
      ? state.platos
      : state.platos.filter((plato) => plato.categoria === state.category);

    if (dom["carta-empty"]) dom["carta-empty"].hidden = list.length > 0;

    list.forEach((plato) => {
      const card = document.createElement("article");
      card.className = "plato-card";
      card.innerHTML = `
        <div class="plato-card__media">
          <img src="${UI.escapeHtml(CONFIG.resolveImage(plato.foto_url, FALLBACK_IMAGES[plato.categoria]))}"
               alt="${UI.escapeHtml(plato.nombre)}" width="900" height="600" loading="lazy" decoding="async">
          <span class="plato-card__cat">${CATEGORY_LABELS[plato.categoria] || plato.categoria}</span>
        </div>
        <div class="plato-card__body">
          <h3 class="plato-card__name">${UI.escapeHtml(plato.nombre)}</h3>
          <p class="plato-card__desc">${UI.escapeHtml(plato.descripcion || "Preparado en casa, con ingredientes frescos.")}</p>
          <div class="plato-card__foot">
            <span class="plato-card__price">${UI.formatCurrency(plato.precio)}</span>
            <span class="plato-card__avail"><i></i> Disponible</span>
          </div>
        </div>`;
      grid.append(card);
    });
  }

  /* ---------------- Flujo de reserva ---------------- */
  function renderTablePicker() {
    if (!dom["table-picker"]) return;
    const picker = dom["table-picker"];
    picker.innerHTML = "";
    if (state.fatal) {
      picker.innerHTML = `<p class="field__hint">No hay mesas cargadas.</p>`;
      return;
    }
    const active = state.mesas.filter((mesa) => mesa.activa);
    if (!active.length) {
      picker.innerHTML = `<p class="field__hint">No hay mesas activas disponibles en este momento.</p>`;
      return;
    }
    active.forEach((mesa) => {
      const selected = mesa.id === state.selectedMesaId;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `table-pick${selected ? " is-selected" : ""}`;
      button.setAttribute("aria-pressed", String(selected));
      button.dataset.pickMesa = mesa.id;
      button.innerHTML = `
        <strong>${UI.escapeHtml(mesa.nombre)}</strong>
        <span>${ZONE_LABELS[mesa.zona] || mesa.zona} · ${mesa.capacidad} pax</span>`;
      button.addEventListener("click", () => chooseMesa(mesa.id, false));
      picker.append(button);
    });
  }

  function chooseMesa(id, fromGrid) {
    const mesa = findMesa(id);
    if (!mesa || !mesa.activa) {
      UI.toast("Esa mesa no está disponible para reservas.", "error");
      return;
    }
    state.selectedMesaId = id;
    state.selectedTime = "";
    if (fromGrid) {
      state.selectedDate = state.mesasDate;
      state.calendarMonth = UI.startOfMonth(state.selectedDate);
    }
    if (!state.selectedDate || state.selectedDate < UI.todayISO()) {
      state.selectedDate = firstOpenDate();
      state.calendarMonth = UI.startOfMonth(state.selectedDate);
    }
    const persons = dom.personas;
    if (persons) {
      if (!Number(persons.value) || Number(persons.value) > mesa.capacidad) {
        persons.value = String(Math.min(2, mesa.capacidad));
      }
      persons.max = String(mesa.capacidad);
    }
    // Asegura los datos de ocupación antes de pintar horarios.
    ensureOccupied(state.selectedDate).then(() => {
      renderTablePicker();
      renderMesas();
      renderCalendar();
      renderSlots();
      updateSummary();
      if (fromGrid) {
        const section = document.getElementById("reservar");
        if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }).catch((error) => {
      UI.toast(API.helpers.errorMessage(error), "error");
    });
  }

  function renderCalendar() {
    if (!dom["booking-calendar"]) return;
    const month = state.calendarMonth;
    const min = UI.todayISO();
    const max = maxDate();
    dom["cal-month"].textContent = UI.monthLabel(month);
    const minMonth = UI.startOfMonth(min);
    const maxMonth = UI.startOfMonth(max);
    dom["cal-prev"].disabled = month <= minMonth;
    dom["cal-next"].disabled = month >= maxMonth;

    UI.renderCalendar(dom["booking-calendar"], {
      month,
      selected: state.selectedDate,
      min,
      max,
      isDisabled: (iso) => !hasService(iso),
      onSelect: (iso) => selectBookingDate(iso)
    });
  }

  async function selectBookingDate(dateISO) {
    state.selectedDate = dateISO;
    state.selectedTime = "";
    state.calendarMonth = UI.startOfMonth(dateISO);
    try {
      await ensureOccupied(dateISO, true);
    } catch (error) {
      UI.toast(API.helpers.errorMessage(error), "error");
    }
    renderCalendar();
    renderSlots();
    updateSummary();
  }

  function renderSlots() {
    if (!dom["slots-container"]) return;
    const container = dom["slots-container"];
    const label = dom["slots-day-label"];
    const mesa = findMesa(state.selectedMesaId);

    if (!mesa) {
      if (label) label.textContent = "Elige una mesa";
      container.innerHTML = `<div class="slots-empty">Primero elige una mesa para ver los horarios libres.</div>`;
      return;
    }
    if (!state.selectedDate) {
      if (label) label.textContent = "Elige una fecha";
      container.innerHTML = `<div class="slots-empty">Selecciona una fecha en el calendario.</div>`;
      return;
    }

    const shifts = shiftsFor(state.selectedDate);
    if (label) label.textContent = `${UI.formatDateShort(state.selectedDate)} · ${mesa.nombre}`;
    if (!shifts.length) {
      container.innerHTML = `<div class="slots-empty"><strong>No hay servicio este día.</strong><br>Prueba con otra fecha; te esperamos en otra jornada.</div>`;
      return;
    }

    const slots = buildSlots(state.selectedDate, mesa.id);
    if (!slots.length) {
      container.innerHTML = `<div class="slots-empty">No hay bloques disponibles para esta mesa.</div>`;
      return;
    }

    const groups = {};
    slots.forEach((slot) => {
      if (!groups[slot.jornada]) groups[slot.jornada] = [];
      groups[slot.jornada].push(slot);
    });

    const freeCount = slots.filter((slot) => slot.free).length;
    if (!freeCount) {
      container.innerHTML = `<div class="slots-empty"><strong>No quedan horarios libres.</strong><br>La mesa ya tiene reservas o el día terminó. Prueba con otra mesa u otra fecha.</div>`;
      return;
    }

    container.innerHTML = "";
    ["almuerzo", "noche"].forEach((jornada) => {
      const group = groups[jornada];
      if (!group || !group.length) return;
      const shift = shifts.find((row) => row.jornada === jornada);
      const title = document.createElement("div");
      title.className = "slots-group";
      title.innerHTML = `<div class="slots-group__title">
          <span>${jornada === "almuerzo" ? "Almuerzo" : "Noche"}</span>
          <strong>${shift ? UI.formatTimeRange(shift.hora_inicio, shift.hora_fin) : ""}</strong>
        </div><div class="slots"></div>`;
      const list = title.querySelector(".slots");
      group.forEach((slot) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `slot${slot.busy ? " is-busy" : ""}${slot.past ? " is-past" : ""}${state.selectedTime === slot.start ? " is-selected" : ""}`;
        button.dataset.time = slot.start;
        button.textContent = UI.formatTime12(slot.start);
        button.disabled = !slot.free;
        button.setAttribute("aria-pressed", String(state.selectedTime === slot.start));
        if (slot.busy) button.title = "Horario ocupado";
        else if (slot.past) button.title = "Horario ya pasado";
        else button.title = `Reservar de ${UI.formatTime12(slot.start)} a ${UI.formatTime12(slot.end)}`;
        button.addEventListener("click", () => {
          state.selectedTime = slot.start;
          renderSlots();
          updateSummary();
          clearSummaryAlert();
        });
        list.append(button);
      });
      container.append(title);
    });
  }

  /* ---------------- Formulario / resumen ---------------- */
  function mesaName() {
    const mesa = findMesa(state.selectedMesaId);
    return mesa ? mesa.nombre : "—";
  }

  function mesaZone() {
    const mesa = findMesa(state.selectedMesaId);
    return mesa ? (ZONE_LABELS[mesa.zona] || mesa.zona) : "Selecciona una mesa";
  }

  function validatePersons(showError) {
    const mesa = findMesa(state.selectedMesaId);
    const input = dom.personas;
    const value = Number(input && input.value);
    const error = dom["error-personas"];
    const hint = dom["capacidad-hint"];
    if (!mesa) {
      if (hint) hint.textContent = "Elige una mesa para validar la capacidad.";
      if (error) error.hidden = true;
      return false;
    }
    if (!Number.isInteger(value) || value < 1) {
      if (showError && error) {
        error.textContent = "El número de personas debe ser mayor que cero.";
        error.hidden = false;
      }
      if (hint) hint.textContent = `Máximo ${mesa.capacidad} personas en ${mesa.nombre}.`;
      return false;
    }
    if (value > mesa.capacidad) {
      if (error) {
        error.textContent = `La ${mesa.nombre} admite máximo ${mesa.capacidad} personas.`;
        error.hidden = false;
      }
      if (hint) hint.textContent = `La cantidad supera la capacidad (máx. ${mesa.capacidad}).`;
      return false;
    }
    if (error) error.hidden = true;
    if (hint) {
      hint.innerHTML = `<span class="field__ok">${UI.icon("check")} La cantidad cabe en ${UI.escapeHtml(mesa.nombre)} (máx. ${mesa.capacidad} personas).</span>`;
    }
    return true;
  }

  function validateName(showError) {
    const value = String(dom.nombre && dom.nombre.value || "").trim();
    const error = dom["error-nombre"];
    if (value.length < 2) {
      if (showError && error) {
        error.textContent = "Escribe el nombre completo (mínimo 2 caracteres).";
        error.hidden = false;
      }
      return false;
    }
    if (error) error.hidden = true;
    return true;
  }

  function canConfirm() {
    const mesa = findMesa(state.selectedMesaId);
    if (!mesa) return false;
    if (!state.selectedDate || !state.selectedTime) return false;
    const persons = Number(dom.personas && dom.personas.value);
    if (!Number.isInteger(persons) || persons < 1 || persons > mesa.capacidad) return false;
    if (String(dom.nombre && dom.nombre.value || "").trim().length < 2) return false;
    return true;
  }

  function updateSummary() {
    const mesa = findMesa(state.selectedMesaId);
    const name = String(dom.nombre && dom.nombre.value || "").trim();
    const persons = Number(dom.personas && dom.personas.value);

    dom["sum-mesa"].textContent = mesa ? mesa.nombre : "—";
    dom["sum-zona"].textContent = mesa ? (ZONE_LABELS[mesa.zona] || mesa.zona) : "Selecciona una mesa";
    dom["sum-fecha"].textContent = state.selectedDate ? UI.formatDateLong(state.selectedDate) : "—";
    dom["sum-fecha"].classList.toggle("is-empty", !state.selectedDate);
    dom["sum-hora"].textContent = state.selectedTime ? UI.formatTime12(state.selectedTime) : "—";
    dom["sum-hora"].classList.toggle("is-empty", !state.selectedTime);
    dom["sum-personas"].textContent = Number.isInteger(persons) && persons > 0 ? `${persons} ${UI.plural(persons, "persona")}` : "—";
    dom["sum-personas"].classList.toggle("is-empty", !(Number.isInteger(persons) && persons > 0));
    dom["sum-cliente"].textContent = name || "—";
    dom["sum-cliente"].classList.toggle("is-empty", !name);

    const ready = canConfirm();
    dom["sum-state"].textContent = ready ? "Lista" : "Pendiente";
    dom["sum-state"].className = `badge ${ready ? "badge--free" : "badge--red"}`;
    dom["confirmar-btn"].disabled = !ready;
    if (dom["confirmar-label"]) dom["confirmar-label"].textContent = ready ? "Confirmar reserva" : "Completa tu reserva";
    validatePersons(false);
  }

  function showSummaryAlert(message) {
    if (!dom["summary-alert"]) return;
    dom["summary-alert"].textContent = message;
    dom["summary-alert"].classList.add("is-visible");
  }

  function clearSummaryAlert() {
    if (!dom["summary-alert"]) return;
    dom["summary-alert"].classList.remove("is-visible");
    dom["summary-alert"].textContent = "";
  }

  function showFormError(message) {
    if (!dom["form-error"]) return;
    if (dom["form-error-text"]) dom["form-error-text"].textContent = message;
    dom["form-error"].hidden = false;
  }

  function clearFormError() {
    if (dom["form-error"]) dom["form-error"].hidden = true;
  }

  function validateForm(showErrors) {
    clearFormError();
    const nameOk = validateName(showErrors);
    const personsOk = validatePersons(showErrors);
    if (!state.selectedMesaId) {
      if (showErrors) showFormError("Selecciona una mesa para continuar.");
      return false;
    }
    if (!state.selectedDate) {
      if (showErrors) showFormError("Selecciona una fecha para continuar.");
      return false;
    }
    if (!state.selectedTime) {
      if (showErrors) {
        showFormError("Selecciona un horario libre antes de confirmar.");
        dom["slots-container"]?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return false;
    }
    if (!nameOk || !personsOk) {
      if (showErrors) showFormError("Revisa los campos marcados. Hay datos incompletos o fuera de rango.");
      return false;
    }
    return true;
  }

  /* ---------------- Confirmación ---------------- */
  async function confirmReservation() {
    if (!validateForm(true)) return;
    const button = dom["confirmar-btn"];
    const mesa = findMesa(state.selectedMesaId);
    if (!mesa) return;

    UI.setButtonLoading(button, true, "Verificando…");
    clearSummaryAlert();
    try {
      // Revalidación explícita contra la base de datos justo antes de insertar.
      // El RPC de Supabase vuelve a validar y bloquea la fila para evitar
      // condiciones de carrera entre dos clientes simultáneos.
      const fresh = await ensureOccupied(state.selectedDate, true);
      const slot = buildSlots(state.selectedDate, mesa.id).find((item) => item.start === state.selectedTime);
      if (!slot || !slot.free) {
        state.selectedTime = "";
        renderSlots();
        updateSummary();
        showSummaryAlert("Ese horario acaba de ocuparse. Elige otro, por favor.");
        UI.toast("El horario ya no está disponible. Te mostramos las opciones actualizadas.", "error", "Horario ocupado");
        return;
      }

      const reserva = await API.createReservation({
        mesa_id: mesa.id,
        cliente_nombre: String(dom.nombre.value || "").trim(),
        cliente_contacto: String(dom.contacto.value || "").trim(),
        num_personas: Number(dom.personas.value),
        fecha: state.selectedDate,
        hora_inicio: state.selectedTime
      });

      // Refresca la disponibilidad local con la reserva recién creada.
      fresh.push({
        mesa_id: reserva.mesa_id,
        hora_inicio: reserva.hora_inicio,
        hora_fin: reserva.hora_fin
      });
      state.occupiedByDate.set(state.selectedDate, fresh);

      showSuccess(reserva);
      state.selectedTime = "";
      renderSlots();
      renderMesas();
      updateSummary();
      UI.toast("Tu mesa quedó reservada. Te esperamos.", "success", "Reserva confirmada");
    } catch (error) {
      const code = error && error.code;
      const message = API.helpers.errorMessage(error);
      showSummaryAlert(message);
      UI.toast(message, "error", code === "HORARIO_OCUPADO" ? "Horario ocupado" : "No se pudo reservar");
      if (code === "HORARIO_OCUPADO" || code === "SLOT_PASADO" || code === "FUERA_DE_HORARIO") {
        try {
          await ensureOccupied(state.selectedDate, true);
        } catch (refreshError) {
          // Si falla la recarga, conservamos el mensaje original.
        }
        state.selectedTime = "";
        renderSlots();
        updateSummary();
      }
    } finally {
      UI.setButtonLoading(button, false);
      updateSummary();
    }
  }

  function showSuccess(reserva) {
    if (!dom["success-dialog"]) return;
    dom["success-code"].textContent = UI.reservationCode(reserva.id);
    dom["success-cliente"].textContent = reserva.cliente_nombre;
    dom["success-mesa"].textContent = reserva.mesa_nombre || mesaName();
    dom["success-zona"].textContent = ZONE_LABELS[reserva.mesa_zona] || mesaZone();
    dom["success-fecha"].textContent = UI.formatDateLong(reserva.fecha);
    dom["success-hora"].textContent = UI.formatTime12(reserva.hora_inicio);
    dom["success-personas"].textContent = `${reserva.num_personas} ${UI.plural(reserva.num_personas, "persona")}`;
    UI.openDialog(dom["success-dialog"]);
  }

  function resetBooking(keepTable) {
    state.selectedTime = "";
    if (!keepTable) state.selectedMesaId = "";
    dom["nombre"].value = "";
    dom["contacto"].value = "";
    dom["personas"].value = "2";
    clearFormError();
    clearSummaryAlert();
    renderTablePicker();
    renderSlots();
    updateSummary();
    if (!keepTable) {
      document.getElementById("step-mesa")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /* ---------------- Enlaces, eventos y arranque ---------------- */
  function bindEvents() {
    if (dom["mesas-date"]) {
      dom["mesas-date"].min = UI.todayISO();
      dom["mesas-date"].max = maxDate();
      dom["mesas-date"].value = state.mesasDate;
      dom["mesas-date"].addEventListener("change", (event) => {
        if (event.target.value) setMesasDate(event.target.value);
      });
    }

    if (dom["refresh-mesas"]) {
      dom["refresh-mesas"].addEventListener("click", refreshMesas);
    }

    if (dom["cal-prev"]) {
      dom["cal-prev"].addEventListener("click", () => {
        state.calendarMonth = UI.addMonths(state.calendarMonth, -1);
        renderCalendar();
      });
    }
    if (dom["cal-next"]) {
      dom["cal-next"].addEventListener("click", () => {
        state.calendarMonth = UI.addMonths(state.calendarMonth, 1);
        renderCalendar();
      });
    }

    if (dom.nombre) {
      dom.nombre.addEventListener("input", () => {
        validateName(false);
        updateSummary();
        clearFormError();
      });
      dom.nombre.addEventListener("blur", () => validateName(true));
    }

    if (dom.personas) {
      dom.personas.addEventListener("input", () => {
        const mesa = findMesa(state.selectedMesaId);
        if (mesa) {
          const value = Number(dom.personas.value);
          if (value > mesa.capacidad) validatePersons(true);
          else validatePersons(false);
        }
        updateSummary();
      });
      dom.personas.addEventListener("blur", () => validatePersons(true));
    }

    if (dom["personas-minus"]) {
      dom["personas-minus"].addEventListener("click", () => {
        const current = Number(dom.personas.value) || 1;
        dom.personas.value = String(Math.max(1, current - 1));
        validatePersons(true);
        updateSummary();
      });
    }
    if (dom["personas-plus"]) {
      dom["personas-plus"].addEventListener("click", () => {
        const mesa = findMesa(state.selectedMesaId);
        const max = mesa ? mesa.capacidad : 8;
        const current = Number(dom.personas.value) || 1;
        dom.personas.value = String(Math.min(max, current + 1));
        validatePersons(true);
        updateSummary();
      });
    }

    if (dom["confirmar-btn"]) {
      dom["confirmar-btn"].addEventListener("click", confirmReservation);
    }

    if (dom["success-home"]) {
      dom["success-home"].addEventListener("click", () => {
        UI.closeDialog(dom["success-dialog"]);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
    if (dom["success-again"]) {
      dom["success-again"].addEventListener("click", () => {
        UI.closeDialog(dom["success-dialog"]);
        resetBooking(false);
      });
    }
    UI.bindDialogClose(dom["success-dialog"]);

    if (dom["reserva-form"]) {
      dom["reserva-form"].addEventListener("submit", (event) => {
        event.preventDefault();
        confirmReservation();
      });
    }

    // Si otra pestaña confirma una reserva, refrescamos disponibilidad.
    window.addEventListener("storage", (event) => {
      if (event.key === CONFIG.demo.storageKey && API.isDemo) {
        refreshMesas();
      }
    });
  }

  function setDataSourceChip() {
    const chip = dom["data-source-chip"];
    if (!chip) return;
    if (API.isDemo) {
      chip.classList.remove("datasource-chip--live");
      chip.innerHTML = `<i></i> Modo demo local`;
      chip.title = "Los datos se guardan en este navegador. Conecta Supabase para producción.";
    } else {
      chip.classList.add("datasource-chip--live");
      chip.innerHTML = `<i></i> Supabase conectado`;
      chip.title = "Datos en vivo desde Supabase.";
    }
  }

  function renderFatal(message) {
    state.fatal = message;
    if (dom["mesas-grid"]) {
      dom["mesas-grid"].setAttribute("aria-busy", "false");
      dom["mesas-grid"].innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <strong>No pudimos conectar</strong>
        <p>${UI.escapeHtml(message)}</p>
        <button class="btn btn--ghost btn--sm" type="button" onclick="location.reload()">Reintentar</button>
      </div>`;
    }
    if (dom["carta-grid"]) {
      dom["carta-grid"].setAttribute("aria-busy", "false");
      dom["carta-grid"].innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <strong>Carta no disponible</strong><p>${UI.escapeHtml(message)}</p></div>`;
    }
    if (dom["table-picker"]) {
      dom["table-picker"].innerHTML = `<p class="field__hint">${UI.escapeHtml(message)}</p>`;
    }
    if (dom["slots-container"]) {
      dom["slots-container"].innerHTML = `<div class="slots-empty">${UI.escapeHtml(message)}</div>`;
    }
    if (dom["confirmar-btn"]) dom["confirmar-btn"].disabled = true;
  }

  async function boot() {
    cacheDom();
    UI.init();
    setDataSourceChip();
    bindEvents();

    try {
      await API.init();
      const [mesas, horarios, platos] = await Promise.all([
        API.listMesas(),
        API.listHorarios(),
        API.listPlatos()
      ]);
      state.mesas = mesas;
      state.horarios = horarios;
      state.platos = platos;
      state.loading = false;

      state.mesasDate = firstOpenDate();
      state.selectedDate = state.mesasDate;
      state.calendarMonth = UI.startOfMonth(state.selectedDate);
      if (dom["mesas-date"]) dom["mesas-date"].value = state.mesasDate;

      await ensureOccupied(state.mesasDate, true);

      renderQuickDates();
      renderMesas();
      renderTablePicker();
      renderCalendar();
      renderSlots();
      renderMenuFilters();
      renderMenu();
      updateSummary();
      setDataSourceChip();
    } catch (error) {
      state.loading = false;
      setDataSourceChip();
      const message = API.helpers.errorMessage(error);
      renderFatal(message);
      UI.toast(message, "error", "Error de conexión", 8000);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
