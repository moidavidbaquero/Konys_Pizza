/* ============================================================
   KONYS PIZZA — Capa de datos
   ------------------------------------------------------------
   · Modo Supabase: SDK oficial + RPCs seguras (RLS activo).
   · Modo demo: datos locales en localStorage para poder revisar
     la aplicación sin credenciales. El modo demo NO se activa
     cuando Supabase está configurado pero falla: en ese caso se
     informa el error para no simular reservas.
   ============================================================ */
(function () {
  "use strict";

  const UI = window.KonysUI;
  const CONFIG = window.KONYS_CONFIG;
  const TABLE_ORDER = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

  const ERROR_MESSAGES = {
    HORARIO_OCUPADO: "Ese horario acaba de ser reservado por otra persona. Elige otro, por favor.",
    MESA_INACTIVA: "Esta mesa no está disponible para reservas en este momento.",
    MESA_NO_ENCONTRADA: "La mesa seleccionada no existe o fue eliminada.",
    CAPACIDAD_EXCEDIDA: "El número de personas supera la capacidad de la mesa.",
    CAPACIDAD_INVALIDA: "La capacidad de la mesa no es válida.",
    FECHA_INVALIDA: "La fecha seleccionada no es válida.",
    FECHA_PASADA: "No puedes reservar en una fecha pasada.",
    FUERA_DE_HORARIO: "Ese horario no pertenece a una jornada activa del restaurante.",
    HORARIO_INVALIDO: "El horario seleccionado no coincide con un bloque de reserva válido.",
    SLOT_PASADO: "Ese horario ya pasó. Elige uno más tarde.",
    NOMBRE_REQUERIDO: "Escribe el nombre completo del cliente.",
    NOMBRE_DUPLICADO: "Ya existe una mesa con ese nombre.",
    MESA_CON_RESERVAS: "No se puede eliminar la mesa porque tiene reservas asociadas. Puedes desactivarla.",
    MESA_CON_RESERVAS_FUTURAS: "No puedes reducir la capacidad por debajo de las reservas futuras confirmadas.",
    SESION_INVALIDA: "Tu sesión expiró. Vuelve a ingresar.",
    CLAVE_INCORRECTA: "La contraseña no es correcta.",
    DEMASIADOS_INTENTOS: "Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.",
    ESTADO_INVALIDO: "El estado de la reserva no es válido.",
    RESERVA_NO_ENCONTRADA: "La reserva no existe o fue eliminada.",
    PLATO_NO_ENCONTRADO: "El producto no existe o fue eliminado.",
    CATEGORIA_INVALIDA: "La categoría del producto no es válida.",
    PRECIO_INVALIDO: "El precio del producto no es válido.",
    DATOS_INVALIDOS: "Revisa los datos del formulario e inténtalo de nuevo.",
    FUNCION_NO_INSTALADA: "La base de datos no tiene instaladas las funciones de Konys. Ejecuta supabase/schema.sql en tu proyecto.",
    CONEXION: "No pudimos conectar con la base de datos. Revisa tu conexión e inténtalo otra vez."
  };

  class KonysError extends Error {
    constructor(code, detail) {
      const normalized = String(code || "DATOS_INVALIDOS").toUpperCase();
      super(ERROR_MESSAGES[normalized] || detail || "Ocurrió un error inesperado.");
      this.name = "KonysError";
      this.code = normalized;
      this.detail = detail || "";
    }
  }

  function friendlyError(code, detail) { return new KonysError(code, detail); }

  function mapDatabaseError(error) {
    const raw = String((error && (error.message || error.details || error.hint)) || "CONEXION");
    const code = Object.keys(ERROR_MESSAGES).find((key) => raw.includes(key));
    if (code) return new KonysError(code, raw);
    if (/PGRST202|function .* does not exist|Could not find the function/i.test(raw)) {
      return new KonysError("FUNCION_NO_INSTALADA", raw);
    }
    if (/Invalid API key|JWT|apikey/i.test(raw)) {
      return new KonysError("CONEXION", "La URL o la anon key de Supabase no son válidas.");
    }
    if (/duplicate key|unique constraint/i.test(raw)) {
      return new KonysError("NOMBRE_DUPLICADO", raw);
    }
    return new KonysError("CONEXION", raw);
  }

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
      const random = (Math.random() * 16) | 0;
      const value = char === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  }

  function nowIso() { return new Date().toISOString(); }

  function normalizeMesa(row) {
    return {
      id: row.id,
      nombre: String(row.nombre || "").trim(),
      zona: row.zona === "terraza" ? "terraza" : "salon",
      capacidad: Number(row.capacidad) || 0,
      activa: row.activa !== false,
      foto_url: row.foto_url || "",
      creado_en: row.creado_en || nowIso()
    };
  }

  function normalizeHorario(row) {
    return {
      id: row.id,
      dia_semana: String(row.dia_semana || "").toLowerCase(),
      jornada: row.jornada === "noche" ? "noche" : "almuerzo",
      hora_inicio: UI.normalizeTime(row.hora_inicio),
      hora_fin: UI.normalizeTime(row.hora_fin),
      duracion_slot: Number(row.duracion_slot) || 60,
      activo: row.activo !== false
    };
  }

  function normalizeReserva(row) {
    return {
      id: row.id,
      mesa_id: row.mesa_id,
      cliente_nombre: String(row.cliente_nombre || "").trim(),
      cliente_contacto: row.cliente_contacto || "",
      num_personas: Number(row.num_personas) || 0,
      fecha: String(row.fecha || "").slice(0, 10),
      hora_inicio: UI.normalizeTime(row.hora_inicio),
      hora_fin: UI.normalizeTime(row.hora_fin),
      estado: ["confirmada", "cancelada", "completada"].includes(row.estado) ? row.estado : "confirmada",
      creado_en: row.creado_en || nowIso(),
      mesa_nombre: row.mesa_nombre || "",
      mesa_zona: row.mesa_zona || ""
    };
  }

  function normalizePlato(row) {
    return {
      id: row.id,
      nombre: String(row.nombre || "").trim(),
      categoria: ["pizzas", "entradas", "postres", "bebidas"].includes(row.categoria) ? row.categoria : "pizzas",
      descripcion: row.descripcion || "",
      precio: Number(row.precio) || 0,
      disponible: row.disponible !== false,
      foto_url: row.foto_url || "",
      creado_en: row.creado_en || nowIso()
    };
  }

  function sortMesas(list) {
    return list.slice().sort((a, b) => {
      const dateA = new Date(a.creado_en || 0).getTime();
      const dateB = new Date(b.creado_en || 0).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.nombre.localeCompare(b.nombre, "es", { numeric: true });
    });
  }

  function sortHorarios(list) {
    return list.slice().sort((a, b) => {
      const dayA = TABLE_ORDER.indexOf(a.dia_semana);
      const dayB = TABLE_ORDER.indexOf(b.dia_semana);
      if (dayA !== dayB) return dayA - dayB;
      return a.hora_inicio.localeCompare(b.hora_inicio);
    });
  }

  function sortReservas(list) {
    return list.slice().sort((a, b) => {
      if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha);
      return b.hora_inicio.localeCompare(a.hora_inicio);
    });
  }

  function scheduleFor(horarios, dateISO, startTime) {
    const key = UI.dayKey(dateISO);
    const minutes = UI.minutesOf(startTime);
    return horarios.find((row) => {
      if (!row.activo || row.dia_semana !== key) return false;
      const start = UI.minutesOf(row.hora_inicio);
      const end = UI.minutesOf(row.hora_fin);
      if (minutes < start) return false;
      if (minutes + row.duracion_slot > end) return false;
      return (minutes - start) % row.duracion_slot === 0;
    }) || null;
  }

  function rangesOverlap(startA, endA, startB, endB) {
    return UI.minutesOf(startA) < UI.minutesOf(endB) && UI.minutesOf(endA) > UI.minutesOf(startB);
  }

  /* ============================================================
     BACKEND DEMO (localStorage)
     ============================================================ */
  class LocalBackend {
    constructor() {
      this.mode = "demo";
      this.key = CONFIG.demo.storageKey;
      this.sessionKey = CONFIG.demo.adminSessionKey;
      this.data = null;
    }

    async init() {
      this._load();
      return this;
    }

    _delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms == null ? 90 : ms));
    }

    _load() {
      try {
        const raw = localStorage.getItem(this.key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.version === 1 && Array.isArray(parsed.mesas)) {
            this.data = parsed;
            return;
          }
        }
      } catch (error) {
        console.warn("Konys demo: datos locales corruptos, se regeneran.", error);
      }
      this.data = this._seed();
      this._save();
    }

    _save() {
      try {
        localStorage.setItem(this.key, JSON.stringify(this.data));
      } catch (error) {
        console.warn("Konys demo: no se pudo guardar en localStorage.", error);
      }
    }

    _seed() {
      const today = UI.todayISO();
      const tomorrow = UI.addDaysISO(today, 1);
      const inTwoDays = UI.addDaysISO(today, 2);
      const yesterday = UI.addDaysISO(today, -1);
      const createdAt = nowIso();

      const mesas = [
        { nombre: "Mesa 1", zona: "salon", capacidad: 2, foto_url: "assets/img/mesa-salon.webp" },
        { nombre: "Mesa 2", zona: "terraza", capacidad: 4, foto_url: "assets/img/mesa-terraza.webp" },
        { nombre: "Mesa 3", zona: "salon", capacidad: 4, foto_url: "assets/img/mesa-madera.webp" },
        { nombre: "Mesa 4", zona: "terraza", capacidad: 6, foto_url: "assets/img/mesa-noche.webp" },
        { nombre: "Mesa 5", zona: "terraza", capacidad: 2, foto_url: "assets/img/mesa-terraza.webp" },
        { nombre: "Mesa 6", zona: "salon", capacidad: 8, foto_url: "assets/img/mesa-salon.webp" },
        { nombre: "Mesa 7", zona: "terraza", capacidad: 4, foto_url: "assets/img/mesa-noche.webp", activa: false },
        { nombre: "Mesa 8", zona: "salon", capacidad: 2, foto_url: "assets/img/mesa-madera.webp", activa: false }
      ].map((mesa, index) => normalizeMesa({
        ...mesa,
        id: uuid(),
        activa: mesa.activa !== false,
        creado_en: new Date(Date.parse(createdAt) + index * 1000).toISOString()
      }));

      const horarios = [];
      TABLE_ORDER.forEach((day) => {
        ["almuerzo", "noche"].forEach((jornada) => {
          horarios.push(normalizeHorario({
            id: uuid(),
            dia_semana: day,
            jornada,
            hora_inicio: jornada === "almuerzo" ? "12:30" : "17:00",
            hora_fin: jornada === "almuerzo" ? "14:30" : "23:00",
            duracion_slot: 60,
            activo: true
          }));
        });
      });

      const platos = [
        { nombre: "Margarita", categoria: "pizzas", descripcion: "Tomate, mozzarella y albahaca fresca.", precio: 32000, foto_url: "assets/img/pizza-margarita.webp" },
        { nombre: "Pepperoni", categoria: "pizzas", descripcion: "Pepperoni y mozzarella sobre masa madre.", precio: 38000, foto_url: "assets/img/pizza-pepperoni.webp" },
        { nombre: "Hawaiana", categoria: "pizzas", descripcion: "Jamón y piña, la polémica favorita.", precio: 36000, foto_url: "assets/img/pizza-hawaiana.webp" },
        { nombre: "Cuatro quesos", categoria: "pizzas", descripcion: "Mozzarella, parmesano, azul y gouda.", precio: 42000, foto_url: "assets/img/pizza-cuatro.webp" },
        { nombre: "Konys Especial", categoria: "pizzas", descripcion: "Pepperoni, champiñones, cebolla y toque de la casa.", precio: 46000, foto_url: "assets/img/pizza-especial.webp" },
        { nombre: "Palitos de ajo", categoria: "entradas", descripcion: "Pan de la casa con mantequilla de ajo y salsa.", precio: 14000, foto_url: "assets/img/entrada-ajo.webp" },
        { nombre: "Bruschetta", categoria: "entradas", descripcion: "Tomate, albahaca y aceite de oliva sobre pan tostado.", precio: 19000, foto_url: "assets/img/hero-slice.webp" },
        { nombre: "Tiramisú", categoria: "postres", descripcion: "Receta italiana con café y mascarpone.", precio: 16000, foto_url: "assets/img/postre-tiramisu.webp" },
        { nombre: "Brownie", categoria: "postres", descripcion: "Chocolate oscuro y helado de vainilla.", precio: 15000, disponible: false, foto_url: "assets/img/postre-tiramisu.webp" },
        { nombre: "Limonada de coco", categoria: "bebidas", descripcion: "Vaso 400 ml, fresca y cremosa.", precio: 9000, foto_url: "assets/img/bebida-limonada.webp" },
        { nombre: "Gaseosa", categoria: "bebidas", descripcion: "Botella personal 400 ml.", precio: 6000, foto_url: "assets/img/bebida-gaseosa.webp" },
        { nombre: "Agua sin gas", categoria: "bebidas", descripcion: "Botella 600 ml.", precio: 4000, foto_url: "assets/img/bebida-gaseosa.webp" }
      ].map((plato, index) => normalizePlato({
        ...plato,
        id: uuid(),
        disponible: plato.disponible !== false,
        creado_en: new Date(Date.parse(createdAt) + index * 1000).toISOString()
      }));

      const mesa = (n) => mesas.find((item) => item.nombre === `Mesa ${n}`).id;
      const reservas = [
        { mesa_id: mesa(2), cliente_nombre: "Camila Rojas", cliente_contacto: "300 123 4567", num_personas: 4, fecha: tomorrow, hora_inicio: "19:00", hora_fin: "20:00", estado: "confirmada" },
        { mesa_id: mesa(6), cliente_nombre: "Jorge Silva", cliente_contacto: "315 555 2098", num_personas: 8, fecha: tomorrow, hora_inicio: "13:30", hora_fin: "14:30", estado: "confirmada" },
        { mesa_id: mesa(4), cliente_nombre: "Laura Díaz", cliente_contacto: "301 448 7721", num_personas: 6, fecha: tomorrow, hora_inicio: "20:00", hora_fin: "21:00", estado: "confirmada" },
        { mesa_id: mesa(1), cliente_nombre: "Andrés Pérez", cliente_contacto: "320 777 1144", num_personas: 2, fecha: inTwoDays, hora_inicio: "13:30", hora_fin: "14:30", estado: "cancelada" },
        { mesa_id: mesa(3), cliente_nombre: "Sofía Ruiz", cliente_contacto: "318 220 9031", num_personas: 4, fecha: inTwoDays, hora_inicio: "18:00", hora_fin: "19:00", estado: "confirmada" },
        { mesa_id: mesa(2), cliente_nombre: "Martín Gómez", cliente_contacto: "", num_personas: 3, fecha: yesterday, hora_inicio: "20:00", hora_fin: "21:00", estado: "completada" }
      ].map((reserva, index) => normalizeReserva({
        ...reserva,
        id: uuid(),
        creado_en: new Date(Date.parse(createdAt) + index * 1000).toISOString()
      }));

      return { version: 1, mesas, horarios, reservas, platos };
    }

    _assertSession() {
      const session = this._readSession();
      if (!session || !session.token) throw friendlyError("SESION_INVALIDA");
      return session;
    }

    _readSession() {
      try {
        const raw = sessionStorage.getItem(this.sessionKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.token) return null;
        if (Number(parsed.expira_en) < Date.now()) {
          sessionStorage.removeItem(this.sessionKey);
          return null;
        }
        return parsed;
      } catch (error) {
        return null;
      }
    }

    /* ----- Público ----- */
    async listMesas() {
      await this._delay(60);
      return sortMesas(this.data.mesas.filter((mesa) => mesa.activa)).map((mesa) => ({ ...mesa }));
    }

    async listHorarios() {
      await this._delay(60);
      return sortHorarios(this.data.horarios.filter((row) => row.activo)).map((row) => ({ ...row }));
    }

    async listPlatos() {
      await this._delay(60);
      return this.data.platos.filter((plato) => plato.disponible).map((plato) => ({ ...plato }));
    }

    async getOccupied(dateISO) {
      await this._delay(50);
      return this.data.reservas
        .filter((reserva) => reserva.fecha === dateISO && reserva.estado === "confirmada")
        .map((reserva) => ({
          mesa_id: reserva.mesa_id,
          hora_inicio: reserva.hora_inicio,
          hora_fin: reserva.hora_fin
        }));
    }

    async createReservation(payload) {
      await this._delay(180);
      const name = String(payload.cliente_nombre || "").trim();
      const contact = String(payload.cliente_contacto || "").trim();
      const people = Number(payload.num_personas);
      const dateISO = String(payload.fecha || "").slice(0, 10);
      const start = UI.normalizeTime(payload.hora_inicio);

      if (name.length < 2) throw friendlyError("NOMBRE_REQUERIDO");
      if (!dateISO || !UI.parseDate(dateISO)) throw friendlyError("FECHA_INVALIDA");
      if (dateISO < UI.todayISO()) throw friendlyError("FECHA_PASADA");
      if (!Number.isFinite(people) || people < 1) throw friendlyError("CAPACIDAD_INVALIDA");

      const mesa = this.data.mesas.find((item) => item.id === payload.mesa_id);
      if (!mesa) throw friendlyError("MESA_NO_ENCONTRADA");
      if (!mesa.activa) throw friendlyError("MESA_INACTIVA");
      if (people > mesa.capacidad) throw friendlyError("CAPACIDAD_EXCEDIDA");

      const schedule = scheduleFor(this.data.horarios.filter((row) => row.activo), dateISO, start);
      if (!schedule) throw friendlyError("HORARIO_INVALIDO");

      if (dateISO === UI.todayISO()) {
        const now = new Date();
        const current = now.getHours() * 60 + now.getMinutes();
        if (UI.minutesOf(start) < current + CONFIG.ui.minLeadMinutes) throw friendlyError("SLOT_PASADO");
      }

      const end = UI.addMinutes(start, schedule.duracion_slot);
      const conflict = this.data.reservas.some((reserva) => (
        reserva.mesa_id === mesa.id &&
        reserva.fecha === dateISO &&
        reserva.estado === "confirmada" &&
        rangesOverlap(start, end, reserva.hora_inicio, reserva.hora_fin)
      ));
      if (conflict) throw friendlyError("HORARIO_OCUPADO");

      const reserva = normalizeReserva({
        id: uuid(),
        mesa_id: mesa.id,
        cliente_nombre: name,
        cliente_contacto: contact,
        num_personas: people,
        fecha: dateISO,
        hora_inicio: start,
        hora_fin: end,
        estado: "confirmada",
        creado_en: nowIso()
      });
      this.data.reservas.push(reserva);
      this._save();
      return { ...reserva, mesa_nombre: mesa.nombre, mesa_zona: mesa.zona };
    }

    /* ----- Administración ----- */
    async adminLogin(password) {
      await this._delay(260);
      if (String(password || "") !== CONFIG.demo.adminPassword) {
        throw friendlyError("CLAVE_INCORRECTA");
      }
      const session = { token: uuid(), expira_en: Date.now() + 8 * 60 * 60 * 1000 };
      sessionStorage.setItem(this.sessionKey, JSON.stringify(session));
      return session;
    }

    async adminVerifySession() {
      await this._delay(40);
      return Boolean(this._readSession());
    }

    async adminLogout() {
      sessionStorage.removeItem(this.sessionKey);
      await this._delay(40);
      return true;
    }

    async adminListMesas() {
      this._assertSession();
      await this._delay(70);
      return sortMesas(this.data.mesas).map((mesa) => ({ ...mesa }));
    }

    async adminSaveMesa(input) {
      this._assertSession();
      await this._delay(160);
      const data = {
        nombre: String(input.nombre || "").trim(),
        zona: input.zona === "terraza" ? "terraza" : "salon",
        capacidad: Number(input.capacidad),
        foto_url: String(input.foto_url || "").trim(),
        activa: input.activa !== false
      };
      if (data.nombre.length < 2) throw friendlyError("DATOS_INVALIDOS");
      if (!Number.isFinite(data.capacidad) || data.capacidad < 1 || data.capacidad > 30) throw friendlyError("CAPACIDAD_INVALIDA");

      const duplicate = this.data.mesas.some((mesa) => mesa.id !== input.id && UI.normalizeText(mesa.nombre) === UI.normalizeText(data.nombre));
      if (duplicate) throw friendlyError("NOMBRE_DUPLICADO");

      if (input.id) {
        const mesa = this.data.mesas.find((item) => item.id === input.id);
        if (!mesa) throw friendlyError("MESA_NO_ENCONTRADA");
        const future = this.data.reservas.filter((reserva) => (
          reserva.mesa_id === mesa.id &&
          reserva.estado === "confirmada" &&
          reserva.fecha >= UI.todayISO()
        ));
        const maxPeople = future.reduce((max, reserva) => Math.max(max, reserva.num_personas), 0);
        if (data.capacidad < maxPeople) throw friendlyError("MESA_CON_RESERVAS_FUTURAS");
        Object.assign(mesa, data);
        this._save();
        return { ...mesa };
      }

      const mesa = normalizeMesa({ ...data, id: uuid(), creado_en: nowIso() });
      this.data.mesas.push(mesa);
      this._save();
      return { ...mesa };
    }

    async adminDeleteMesa(id) {
      this._assertSession();
      await this._delay(150);
      const exists = this.data.reservas.some((reserva) => reserva.mesa_id === id);
      if (exists) throw friendlyError("MESA_CON_RESERVAS");
      const before = this.data.mesas.length;
      this.data.mesas = this.data.mesas.filter((mesa) => mesa.id !== id);
      if (this.data.mesas.length === before) throw friendlyError("MESA_NO_ENCONTRADA");
      this._save();
      return true;
    }

    async adminToggleMesa(id, activa) {
      this._assertSession();
      await this._delay(100);
      const mesa = this.data.mesas.find((item) => item.id === id);
      if (!mesa) throw friendlyError("MESA_NO_ENCONTRADA");
      mesa.activa = Boolean(activa);
      this._save();
      return { ...mesa };
    }

    async adminListHorarios() {
      this._assertSession();
      await this._delay(70);
      return sortHorarios(this.data.horarios).map((row) => ({ ...row }));
    }

    async adminSaveHorarios(rows) {
      this._assertSession();
      await this._delay(200);
      if (!Array.isArray(rows)) throw friendlyError("DATOS_INVALIDOS");
      const seen = new Set();
      const normalized = rows.map((row) => {
        const item = normalizeHorario({
          id: row.id || uuid(),
          dia_semana: row.dia_semana,
          jornada: row.jornada,
          hora_inicio: row.hora_inicio,
          hora_fin: row.hora_fin,
          duracion_slot: row.duracion_slot,
          activo: row.activo
        });
        if (!TABLE_ORDER.includes(item.dia_semana)) throw friendlyError("DATOS_INVALIDOS");
        if (!UI.isValidTime(item.hora_inicio) || !UI.isValidTime(item.hora_fin)) throw friendlyError("DATOS_INVALIDOS");
        if (UI.minutesOf(item.hora_fin) <= UI.minutesOf(item.hora_inicio)) throw friendlyError("DATOS_INVALIDOS");
        if (item.duracion_slot < 30 || item.duracion_slot > 180) throw friendlyError("DATOS_INVALIDOS");
        const key = `${item.dia_semana}-${item.jornada}`;
        if (seen.has(key)) throw friendlyError("DATOS_INVALIDOS");
        seen.add(key);
        return item;
      });
      this.data.horarios = normalized;
      this._save();
      return sortHorarios(normalized).map((row) => ({ ...row }));
    }

    async adminListReservas(filters) {
      this._assertSession();
      await this._delay(80);
      const opts = filters || {};
      const mesasById = new Map(this.data.mesas.map((mesa) => [mesa.id, mesa]));
      let rows = this.data.reservas.map((reserva) => {
        const mesa = mesasById.get(reserva.mesa_id);
        return {
          ...reserva,
          mesa_nombre: mesa ? mesa.nombre : "Mesa eliminada",
          mesa_zona: mesa ? mesa.zona : ""
        };
      });
      if (opts.fecha) rows = rows.filter((row) => row.fecha === opts.fecha);
      if (opts.mesaId) rows = rows.filter((row) => row.mesa_id === opts.mesaId);
      if (opts.estado) rows = rows.filter((row) => row.estado === opts.estado);
      return sortReservas(rows);
    }

    async adminUpdateReservaEstado(id, estado) {
      this._assertSession();
      await this._delay(120);
      if (!["confirmada", "cancelada", "completada"].includes(estado)) throw friendlyError("ESTADO_INVALIDO");
      const reserva = this.data.reservas.find((item) => item.id === id);
      if (!reserva) throw friendlyError("RESERVA_NO_ENCONTRADA");

      if (estado === "confirmada" && reserva.estado !== "confirmada") {
        const conflict = this.data.reservas.some((other) => (
          other.id !== reserva.id &&
          other.mesa_id === reserva.mesa_id &&
          other.fecha === reserva.fecha &&
          other.estado === "confirmada" &&
          rangesOverlap(reserva.hora_inicio, reserva.hora_fin, other.hora_inicio, other.hora_fin)
        ));
        if (conflict) throw friendlyError("HORARIO_OCUPADO");
      }

      reserva.estado = estado;
      this._save();
      return { ...reserva };
    }

    async adminListPlatos() {
      this._assertSession();
      await this._delay(70);
      return this.data.platos.map((plato) => ({ ...plato }));
    }

    async adminSavePlato(input) {
      this._assertSession();
      await this._delay(150);
      const data = {
        nombre: String(input.nombre || "").trim(),
        categoria: input.categoria,
        descripcion: String(input.descripcion || "").trim(),
        precio: Number(input.precio),
        disponible: input.disponible !== false,
        foto_url: String(input.foto_url || "").trim()
      };
      if (data.nombre.length < 2) throw friendlyError("DATOS_INVALIDOS");
      if (!["pizzas", "entradas", "postres", "bebidas"].includes(data.categoria)) throw friendlyError("CATEGORIA_INVALIDA");
      if (!Number.isFinite(data.precio) || data.precio < 0) throw friendlyError("PRECIO_INVALIDO");

      if (input.id) {
        const plato = this.data.platos.find((item) => item.id === input.id);
        if (!plato) throw friendlyError("PLATO_NO_ENCONTRADO");
        Object.assign(plato, data);
        this._save();
        return { ...plato };
      }
      const plato = normalizePlato({ ...data, id: uuid(), creado_en: nowIso() });
      this.data.platos.push(plato);
      this._save();
      return { ...plato };
    }

    async adminDeletePlato(id) {
      this._assertSession();
      await this._delay(120);
      const before = this.data.platos.length;
      this.data.platos = this.data.platos.filter((plato) => plato.id !== id);
      if (this.data.platos.length === before) throw friendlyError("PLATO_NO_ENCONTRADO");
      this._save();
      return true;
    }

    async adminTogglePlato(id, disponible) {
      this._assertSession();
      await this._delay(100);
      const plato = this.data.platos.find((item) => item.id === id);
      if (!plato) throw friendlyError("PLATO_NO_ENCONTRADO");
      plato.disponible = Boolean(disponible);
      this._save();
      return { ...plato };
    }
  }

  /* ============================================================
     BACKEND SUPABASE
     ============================================================ */
  class SupabaseBackend {
    constructor() {
      if (!window.supabase || typeof window.supabase.createClient !== "function") {
        throw new Error("No se cargó el SDK de Supabase.");
      }
      this.mode = "supabase";
      this.client = window.supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      });
      this.tokenKey = "konys_admin_token";
    }

    async init() {
      const { error } = await this.client
        .from("mesas")
        .select("id", { count: "exact", head: true })
        .limit(1);
      if (error && !/permission denied|violates row-level security/i.test(error.message || "")) {
        throw mapDatabaseError(error);
      }
      return this;
    }

    async _rpc(name, params) {
      const { data, error } = await this.client.rpc(name, params);
      if (error) throw mapDatabaseError(error);
      return data;
    }

    _getToken() {
      try {
        const raw = sessionStorage.getItem(this.tokenKey);
        if (!raw) return "";
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.token) return "";
        if (parsed.expira_en && new Date(parsed.expira_en).getTime() < Date.now()) {
          sessionStorage.removeItem(this.tokenKey);
          return "";
        }
        return parsed.token;
      } catch (error) {
        return "";
      }
    }

    _setToken(token, expires) {
      sessionStorage.setItem(this.tokenKey, JSON.stringify({ token, expira_en: expires || null }));
    }

    async _adminRpc(name, params) {
      const token = this._getToken();
      if (!token) throw friendlyError("SESION_INVALIDA");
      try {
        return await this._rpc(name, { p_token: token, ...(params || {}) });
      } catch (error) {
        if (error instanceof KonysError && error.code === "SESION_INVALIDA") {
          sessionStorage.removeItem(this.tokenKey);
        }
        throw error;
      }
    }

    /* ----- Público ----- */
    async listMesas() {
      const { data, error } = await this.client
        .from("mesas")
        .select("id,nombre,zona,capacidad,activa,foto_url,creado_en")
        .eq("activa", true)
        .order("creado_en", { ascending: true });
      if (error) throw mapDatabaseError(error);
      return sortMesas((data || []).map(normalizeMesa));
    }

    async listHorarios() {
      const { data, error } = await this.client
        .from("horarios")
        .select("id,dia_semana,jornada,hora_inicio,hora_fin,duracion_slot,activo")
        .eq("activo", true);
      if (error) throw mapDatabaseError(error);
      return sortHorarios((data || []).map(normalizeHorario));
    }

    async listPlatos() {
      const { data, error } = await this.client
        .from("platos")
        .select("id,nombre,categoria,descripcion,precio,disponible,foto_url")
        .eq("disponible", true)
        .order("categoria", { ascending: true })
        .order("nombre", { ascending: true });
      if (error) throw mapDatabaseError(error);
      return (data || []).map(normalizePlato);
    }

    async getOccupied(dateISO) {
      const data = await this._rpc("reservas_ocupadas", { p_fecha: dateISO });
      return (data || []).map((row) => ({
        mesa_id: row.mesa_id,
        hora_inicio: UI.normalizeTime(row.hora_inicio),
        hora_fin: UI.normalizeTime(row.hora_fin)
      }));
    }

    async createReservation(payload) {
      const data = await this._rpc("crear_reserva", {
        p_mesa_id: payload.mesa_id,
        p_cliente_nombre: String(payload.cliente_nombre || "").trim(),
        p_cliente_contacto: String(payload.cliente_contacto || "").trim() || null,
        p_num_personas: Number(payload.num_personas),
        p_fecha: payload.fecha,
        p_hora_inicio: payload.hora_inicio
      });
      const row = data && data.reserva ? data.reserva : data;
      if (!row || !row.id) throw new KonysError("CONEXION", "La base de datos no devolvió la reserva creada.");
      return normalizeReserva(row);
    }

    /* ----- Administración ----- */
    async adminLogin(password) {
      const data = await this._rpc("admin_login", { p_password: String(password || "") });
      if (!data || !data.token) throw new KonysError("SESION_INVALIDA");
      this._setToken(data.token, data.expira_en);
      return data;
    }

    async adminVerifySession() {
      const token = this._getToken();
      if (!token) return false;
      try {
        const data = await this._rpc("admin_sesion_valida", { p_token: token });
        return data === true;
      } catch (error) {
        sessionStorage.removeItem(this.tokenKey);
        return false;
      }
    }

    async adminLogout() {
      const token = this._getToken();
      sessionStorage.removeItem(this.tokenKey);
      if (!token) return true;
      try {
        await this._rpc("admin_logout", { p_token: token });
      } catch (error) {
        // La sesión local ya se cerró; no bloqueamos al usuario.
      }
      return true;
    }

    async adminListMesas() {
      const data = await this._adminRpc("admin_listar_mesas");
      return sortMesas((data || []).map(normalizeMesa));
    }

    async adminSaveMesa(input) {
      const params = {
        p_nombre: String(input.nombre || "").trim(),
        p_zona: input.zona === "terraza" ? "terraza" : "salon",
        p_capacidad: Number(input.capacidad),
        // Cadena vacía borra la foto; null se reserva para "no cambiar"
        // en las llamadas de activar/desactivar.
        p_foto_url: String(input.foto_url || "").trim(),
        p_activa: input.activa !== false
      };
      const data = input.id
        ? await this._adminRpc("admin_actualizar_mesa", { p_id: input.id, ...params })
        : await this._adminRpc("admin_crear_mesa", params);
      return normalizeMesa(data);
    }

    async adminDeleteMesa(id) {
      await this._adminRpc("admin_eliminar_mesa", { p_id: id });
      return true;
    }

    async adminToggleMesa(id, activa) {
      const data = await this._adminRpc("admin_actualizar_mesa", {
        p_id: id,
        p_nombre: null,
        p_zona: null,
        p_capacidad: null,
        p_foto_url: null,
        p_activa: Boolean(activa)
      });
      return normalizeMesa(data);
    }

    async adminListHorarios() {
      const data = await this._adminRpc("admin_listar_horarios");
      return sortHorarios((data || []).map(normalizeHorario));
    }

    async adminSaveHorarios(rows) {
      const payload = (rows || []).map((row) => ({
        id: row.id || null,
        dia_semana: row.dia_semana,
        jornada: row.jornada,
        hora_inicio: UI.normalizeTime(row.hora_inicio),
        hora_fin: UI.normalizeTime(row.hora_fin),
        duracion_slot: Number(row.duracion_slot) || 60,
        activo: row.activo !== false
      }));
      const data = await this._adminRpc("admin_guardar_horarios", { p_horarios: payload });
      return sortHorarios((data || []).map(normalizeHorario));
    }

    async adminListReservas(filters) {
      const opts = filters || {};
      const data = await this._adminRpc("admin_listar_reservas", {
        p_fecha: opts.fecha || null,
        p_mesa_id: opts.mesaId || null,
        p_estado: opts.estado || null
      });
      return sortReservas((data || []).map(normalizeReserva));
    }

    async adminUpdateReservaEstado(id, estado) {
      const data = await this._adminRpc("admin_actualizar_estado_reserva", { p_id: id, p_estado: estado });
      return normalizeReserva(data);
    }

    async adminListPlatos() {
      const data = await this._adminRpc("admin_listar_platos");
      return (data || []).map(normalizePlato);
    }

    async adminSavePlato(input) {
      const params = {
        p_nombre: String(input.nombre || "").trim(),
        p_categoria: input.categoria,
        p_descripcion: String(input.descripcion || "").trim(),
        p_precio: Number(input.precio),
        p_disponible: input.disponible !== false,
        // Cadena vacía borra la foto; null significa "no cambiar".
        p_foto_url: String(input.foto_url || "").trim()
      };
      const data = input.id
        ? await this._adminRpc("admin_actualizar_plato", { p_id: input.id, ...params })
        : await this._adminRpc("admin_crear_plato", params);
      return normalizePlato(data);
    }

    async adminDeletePlato(id) {
      await this._adminRpc("admin_eliminar_plato", { p_id: id });
      return true;
    }

    async adminTogglePlato(id, disponible) {
      const data = await this._adminRpc("admin_actualizar_plato", {
        p_id: id,
        p_nombre: null,
        p_categoria: null,
        p_descripcion: null,
        p_precio: null,
        p_disponible: Boolean(disponible),
        p_foto_url: null
      });
      return normalizePlato(data);
    }
  }

  /* ============================================================
     Carga defensiva del SDK de Supabase
     ------------------------------------------------------------
     Normalmente js/vendor/supabase.js ya dejó window.supabase listo.
     Si por caché, un 404 o un despliegue incompleto no fue así,
     intentamos cargarlo otra vez (primero local y luego CDN) antes
     de construir el backend. Así el sitio no cae en el error
     "No se cargó el SDK de Supabase".
     ============================================================ */
  const SUPABASE_SDK_SOURCES = [
    "js/vendor/supabase.js",
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js",
    "https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js"
  ];

  function hasSupabaseSdk() {
    return Boolean(window.supabase && typeof window.supabase.createClient === "function");
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const absolute = new URL(src, document.baseURI).href;
      const script = document.createElement("script");
      script.src = absolute;
      script.async = false;
      script.dataset.supabaseRetry = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("No se pudo cargar " + absolute));
      document.head.appendChild(script);
    });
  }

  async function ensureSupabaseSdk() {
    if (hasSupabaseSdk()) return;
    for (const src of SUPABASE_SDK_SOURCES) {
      try {
        await loadScriptOnce(src);
      } catch (error) {
        // Si esta fuente falla, intentamos con la siguiente.
      }
      if (hasSupabaseSdk()) return;
    }
    throw new Error("No se cargó el SDK de Supabase.");
  }

  /* ============================================================
     Fachada pública
     ============================================================ */
  let backend = null;
  let initPromise = null;

  async function init() {
    if (backend) return backend;
    if (initPromise) return initPromise;
    initPromise = (async () => {
      if (CONFIG.mode === "supabase") {
        await ensureSupabaseSdk();
        backend = new SupabaseBackend();
        await backend.init();
      } else {
        backend = new LocalBackend();
        await backend.init();
      }
      return backend;
    })();
    try {
      return await initPromise;
    } catch (error) {
      initPromise = null;
      backend = null;
      throw error;
    }
  }

  const API = {
    KonysError,
    init,
    get mode() { return backend ? backend.mode : CONFIG.mode; },
    get isDemo() { return (backend ? backend.mode : CONFIG.mode) === "demo"; },

    listMesas: (...args) => backend.listMesas(...args),
    listHorarios: (...args) => backend.listHorarios(...args),
    listPlatos: (...args) => backend.listPlatos(...args),
    getOccupied: (...args) => backend.getOccupied(...args),
    createReservation: (...args) => backend.createReservation(...args),

    adminLogin: (...args) => backend.adminLogin(...args),
    adminVerifySession: (...args) => backend.adminVerifySession(...args),
    adminLogout: (...args) => backend.adminLogout(...args),
    adminListMesas: (...args) => backend.adminListMesas(...args),
    adminSaveMesa: (...args) => backend.adminSaveMesa(...args),
    adminDeleteMesa: (...args) => backend.adminDeleteMesa(...args),
    adminToggleMesa: (...args) => backend.adminToggleMesa(...args),
    adminListHorarios: (...args) => backend.adminListHorarios(...args),
    adminSaveHorarios: (...args) => backend.adminSaveHorarios(...args),
    adminListReservas: (...args) => backend.adminListReservas(...args),
    adminUpdateReservaEstado: (...args) => backend.adminUpdateReservaEstado(...args),
    adminListPlatos: (...args) => backend.adminListPlatos(...args),
    adminSavePlato: (...args) => backend.adminSavePlato(...args),
    adminDeletePlato: (...args) => backend.adminDeletePlato(...args),
    adminTogglePlato: (...args) => backend.adminTogglePlato(...args),

    // Utilidades compartidas por el cliente y el panel.
    helpers: {
      scheduleFor,
      rangesOverlap,
      sortHorarios,
      TABLE_ORDER,
      errorMessage: (error) => (error instanceof KonysError ? error.message : (error && error.message) || ERROR_MESSAGES.CONEXION)
    }
  };

  window.KonysAPI = API;
})();
