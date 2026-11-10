/* ============================================================
   KONYS PIZZA — Utilidades de interfaz compartidas
   Fechas, formatos, toasts, modales, navegación y calendario.
   Sin dependencias externas.
   ============================================================ */
(function () {
  "use strict";

  const MONTHS = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];
  const MONTHS_SHORT = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic"
  ];
  const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const WEEKDAYS_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const DAY_KEYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

  /* ---------- DOM ---------- */
  const qs = (selector, scope) => (scope || document).querySelector(selector);
  const qsa = (selector, scope) => Array.from((scope || document).querySelectorAll(selector));

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([key, value]) => {
        if (value === null || value === undefined || value === false) return;
        if (key === "className") node.className = value;
        else if (key === "dataset") Object.assign(node.dataset, value);
        else if (key === "text") node.textContent = value;
        else if (key === "html") node.innerHTML = value;
        else if (key === "style") node.setAttribute("style", value);
        else node.setAttribute(key, value === true ? "" : value);
      });
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach((child) => {
        if (child === null || child === undefined) return;
        node.append(child.nodeType ? child : document.createTextNode(String(child)));
      });
    }
    return node;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function icon(name, className) {
    return `<svg class="${className || ""}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  }

  /* ---------- Fechas y horas ---------- */
  function pad2(value) { return String(value).padStart(2, "0"); }

  function parseDate(iso) {
    if (!iso) return null;
    const parts = String(iso).slice(0, 10).split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  }

  function toISO(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function todayISO() { return toISO(new Date()); }

  function addDaysISO(iso, days) {
    const date = parseDate(iso);
    date.setDate(date.getDate() + Number(days || 0));
    return toISO(date);
  }

  function startOfMonth(iso) {
    const d = parseDate(iso);
    return new Date(d.getFullYear(), d.getMonth(), 1, 12);
  }

  function addMonths(date, months) {
    return new Date(date.getFullYear(), date.getMonth() + Number(months), 1, 12);
  }

  function dayKey(iso) {
    const d = parseDate(iso);
    return d ? DAY_KEYS[d.getDay()] : "";
  }

  function monthLabel(date, short) {
    return `${short ? MONTHS_SHORT[date.getMonth()] : MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  }

  function formatDateLong(iso) {
    const d = parseDate(iso);
    if (!d) return "—";
    return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
  }

  function formatDateMedium(iso) {
    const d = parseDate(iso);
    if (!d) return "—";
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  }

  function formatDateWithDay(iso) {
    const d = parseDate(iso);
    if (!d) return "—";
    return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  }

  function formatDateShort(iso) {
    const d = parseDate(iso);
    if (!d) return "—";
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  }

  function formatTime12(value) {
    if (!value) return "—";
    const raw = String(value).slice(0, 5);
    const [h, m] = raw.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return raw;
    const suffix = h >= 12 ? "p. m." : "a. m.";
    const hour = h % 12 || 12;
    return `${hour}:${pad2(m)} ${suffix}`;
  }

  function formatTimeRange(start, end) {
    return `${formatTime12(start)} – ${formatTime12(end)}`;
  }

  function normalizeTime(value) {
    if (!value) return "";
    return String(value).slice(0, 5);
  }

  function minutesOf(value) {
    const [h, m] = normalizeTime(value).split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  function timeFromMinutes(total) {
    const safe = Math.max(0, Math.round(total));
    return `${pad2(Math.floor(safe / 60) % 24)}:${pad2(safe % 60)}`;
  }

  function addMinutes(value, minutes) {
    return timeFromMinutes(minutesOf(value) + Number(minutes || 0));
  }

  function isValidTime(value) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(normalizeTime(value));
  }

  function formatCurrency(value) {
    const number = Number(value) || 0;
    return "$" + number.toLocaleString("es-CO", { maximumFractionDigits: 0 });
  }

  function reservationCode(id) {
    const clean = String(id || "").replace(/-/g, "").toUpperCase();
    return "KP-" + (clean.slice(-6) || "000000");
  }

  function plural(value, singular, pluralWord) {
    return Number(value) === 1 ? singular : (pluralWord || singular + "s");
  }

  /* ---------- Calendario ---------- */
  function renderCalendar(container, options) {
    const opts = Object.assign({
      month: startOfMonth(todayISO()),
      selected: "",
      min: todayISO(),
      max: addDaysISO(todayISO(), 60),
      isDisabled: () => false,
      onSelect: () => {}
    }, options || {});

    if (!container) return;
    const month = opts.month;
    container.innerHTML = "";

    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1, 12);
    const totalDays = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12).getDate();
    const offset = (firstDay.getDay() + 6) % 7; // lunes primero
    const today = todayISO();

    for (let i = 0; i < offset; i += 1) {
      const empty = el("span", { className: "cal__day is-empty", "aria-hidden": "true" });
      container.append(empty);
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(month.getFullYear(), month.getMonth(), day, 12);
      const iso = toISO(date);
      const disabled = iso < opts.min || iso > opts.max || opts.isDisabled(iso);
      const button = el("button", {
        type: "button",
        className: "cal__day" +
          (iso === today ? " is-today" : "") +
          (iso === opts.selected ? " is-selected" : "") +
          (disabled ? " is-closed" : ""),
        role: "gridcell",
        "aria-label": `${WEEKDAYS[date.getDay()]} ${day} de ${MONTHS[date.getMonth()]}`,
        "aria-selected": iso === opts.selected ? "true" : "false",
        "data-date": iso,
        text: String(day)
      });
      if (disabled) button.disabled = true;
      else button.addEventListener("click", () => opts.onSelect(iso));
      container.append(button);
    }

    return container;
  }

  /* ---------- Toasts ---------- */
  let toastRoot = null;
  function getToastRoot() {
    if (!toastRoot) {
      toastRoot = qs("#toast-root");
      if (!toastRoot) {
        toastRoot = el("div", { className: "toast-root", id: "toast-root", "aria-live": "polite", "aria-atomic": "false" });
        document.body.append(toastRoot);
      }
    }
    return toastRoot;
  }

  function toast(message, type, title, timeout) {
    const kind = type || "info";
    const icons = { success: "check", error: "alert", info: "info" };
    const titles = { success: "Listo", error: "Algo salió mal", info: "Información" };
    const node = el("div", { className: `toast toast--${kind}`, role: kind === "error" ? "alert" : "status" });
    node.innerHTML = `${icon(icons[kind] || "info")}
      <div class="toast__content">
        <strong>${escapeHtml(title || titles[kind] || "Aviso")}</strong>
        <p>${escapeHtml(message || "")}</p>
      </div>`;
    getToastRoot().append(node);
    const life = timeout || 4200;
    const timer = setTimeout(() => {
      node.classList.add("is-leaving");
      setTimeout(() => node.remove(), 200);
    }, life);
    node.addEventListener("click", () => {
      clearTimeout(timer);
      node.remove();
    });
  }

  /* ---------- Modales ---------- */
  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    document.body.classList.add("no-scroll");
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    if (!qs("dialog[open]")) document.body.classList.remove("no-scroll");
  }

  function bindDialogClose(dialog, onClose) {
    if (!dialog) return;
    qsa("[data-close-dialog]", dialog).forEach((button) => {
      button.addEventListener("click", () => {
        closeDialog(dialog);
        if (onClose) onClose();
      });
    });
    dialog.addEventListener("close", () => {
      if (!qs("dialog[open]")) document.body.classList.remove("no-scroll");
    });
  }

  function confirm(options) {
    const opts = Object.assign({
      title: "¿Confirmar acción?",
      message: "Esta acción no se puede deshacer.",
      confirmLabel: "Confirmar",
      cancelLabel: "Cancelar",
      danger: false
    }, options || {});

    return new Promise((resolve) => {
      const dialog = el("dialog", { className: "confirm-dialog", "aria-labelledby": "confirm-title" });
      dialog.innerHTML = `
        <div class="dialog__head">
          <div>
            <h2 class="dialog__title" id="confirm-title">${escapeHtml(opts.title)}</h2>
            <p class="dialog__sub">${escapeHtml(opts.message)}</p>
          </div>
          <button class="dialog__close" type="button" data-confirm-cancel aria-label="Cerrar">${icon("x")}</button>
        </div>
        <div class="dialog__foot">
          <button class="btn btn--ghost btn--sm" type="button" data-confirm-cancel>${escapeHtml(opts.cancelLabel)}</button>
          <button class="btn ${opts.danger ? "btn--primary" : "btn--blush"} btn--sm" type="button" data-confirm-ok>${escapeHtml(opts.confirmLabel)}</button>
        </div>`;
      document.body.append(dialog);

      let settled = false;
      const done = (value) => {
        if (settled) return;
        settled = true;
        closeDialog(dialog);
        setTimeout(() => dialog.remove(), 10);
        resolve(value);
      };

      qsa("[data-confirm-cancel]", dialog).forEach((b) => b.addEventListener("click", () => done(false)));
      qs("[data-confirm-ok]", dialog).addEventListener("click", () => done(true));
      dialog.addEventListener("cancel", (event) => { event.preventDefault(); done(false); });
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) done(false);
      });
      openDialog(dialog);
      setTimeout(() => qs("[data-confirm-ok]", dialog)?.focus(), 30);
    });
  }

  /* ---------- Botones / carga ---------- */
  function setButtonLoading(button, loading, loadingText) {
    if (!button) return;
    if (loading) {
      if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `<span class="spinner"></span><span>${escapeHtml(loadingText || "Procesando…")}</span>`;
    } else {
      if (button.dataset.originalHtml) {
        button.innerHTML = button.dataset.originalHtml;
        delete button.dataset.originalHtml;
      }
      button.disabled = false;
    }
  }

  function debounce(fn, wait) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait || 200);
    };
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function normalizePhone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (digits.length === 10) return `57${digits}`;
    return digits;
  }

  /* ---------- Navegación y animaciones ---------- */
  function initNavigation() {
    const header = qs("#site-header");
    const toggle = qs("#nav-toggle");
    const menu = qs("#mobile-menu");
    const links = qsa(".nav__link");
    const sections = links
      .map((link) => qs(link.getAttribute("href")))
      .filter(Boolean);

    const closeMenu = () => {
      if (!menu || !toggle) return;
      menu.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("no-scroll");
    };

    if (toggle && menu) {
      toggle.addEventListener("click", () => {
        const open = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", String(!open));
        menu.classList.toggle("is-open", !open);
        document.body.classList.toggle("no-scroll", !open);
        if (!open) {
          const first = qs(".mobile-menu__link", menu);
          setTimeout(() => first?.focus(), 80);
        }
      });
      qsa("a", menu).forEach((link) => link.addEventListener("click", closeMenu));
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeMenu();
      });
      window.addEventListener("resize", () => {
        if (window.innerWidth > 980) closeMenu();
      });
    }

    if (header) {
      const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 20);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    if (sections.length) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((link) => {
            link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`);
          });
        });
      }, { rootMargin: "-40% 0px -52% 0px", threshold: 0 });
      sections.forEach((section) => observer.observe(section));
    }
  }

  function initReveal() {
    const elements = qsa(".reveal");
    if (!elements.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      elements.forEach((node) => node.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -30px 0px" });
    elements.forEach((node) => observer.observe(node));
  }

  function initMisc() {
    const year = qs("#year");
    if (year) year.textContent = String(new Date().getFullYear());

    const config = window.KONYS_CONFIG;
    if (config) {
      qsa("[data-wa]").forEach((link) => {
        const message = link.getAttribute("data-wa-message") || "Hola Konys, quiero reservar una mesa.";
        link.href = `https://wa.me/${config.restaurant.whatsapp}?text=${encodeURIComponent(message)}`;
        link.target = "_blank";
        link.rel = "noopener";
      });
      qsa("[data-instagram]").forEach((link) => { link.href = config.restaurant.instagram; });
      qsa("[data-facebook]").forEach((link) => { link.href = config.restaurant.facebook; });
      qsa("[data-tiktok]").forEach((link) => { link.href = config.restaurant.tiktok; });
      qsa("[data-maps]").forEach((link) => { link.href = config.restaurant.maps; });
    }

    qsa("a[href^='#']").forEach((link) => {
      link.addEventListener("click", (event) => {
        const href = link.getAttribute("href");
        if (!href || href === "#") return;
        const target = qs(href);
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
        history.replaceState(null, "", href);
      });
    });
  }

  function init() {
    initNavigation();
    initReveal();
    initMisc();
  }

  window.KonysUI = {
    MONTHS,
    MONTHS_SHORT,
    WEEKDAYS,
    WEEKDAYS_SHORT,
    DAY_KEYS,
    qs,
    qsa,
    el,
    escapeHtml,
    icon,
    parseDate,
    toISO,
    todayISO,
    addDaysISO,
    startOfMonth,
    addMonths,
    dayKey,
    monthLabel,
    formatDateLong,
    formatDateMedium,
    formatDateWithDay,
    formatDateShort,
    formatTime12,
    formatTimeRange,
    normalizeTime,
    minutesOf,
    timeFromMinutes,
    addMinutes,
    isValidTime,
    formatCurrency,
    reservationCode,
    plural,
    renderCalendar,
    toast,
    openDialog,
    closeDialog,
    bindDialogClose,
    confirm,
    setButtonLoading,
    debounce,
    clamp,
    normalizeText,
    normalizePhone,
    init,
    initReveal
  };
})();
