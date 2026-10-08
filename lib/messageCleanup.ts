import type {
    AutoCleanMessage,
    AutoCleanMessagePayload,
    CleanupConfig,
    CleanupDraft,
    CleanupKind,
    CleanupTimeUnit,
    GhostMessage,
    GhostMessagePayload,
} from "@/types/MessageCleanup";

export const CLEANUP_TIME_UNITS: { id: CleanupTimeUnit; label: string }[] = [
    { id: "hours", label: "Horas" },
    { id: "days", label: "Días" },
];

/** Endpoint del bot, campos del contrato y textos de cada estrategia. */
export const CLEANUP_KINDS = {
    autoClean: {
        endpoint: "autoCleanMessage",
        valueField: "frequencyValue",
        unitField: "frequencyUnit",
        label: "Limpieza automática",
        intro: "Limpia el canal completo cada cierto tiempo. Ideal para canales de música, bots o spam.",
        timeLabel: "Limpiar el canal cada",
        empty: "Todavía no hay canales con limpieza automática.",
        saved: "Limpieza automática guardada.",
        deleted: "Limpieza automática eliminada.",
        deleteTitle: "Eliminar limpieza automática",
        deleteQuestion: (channel: string) => `¿Seguro que querés eliminar la limpieza automática de ${channel}?`,
        sameKindConflict: "Este canal ya tiene una limpieza automática. Editá la existente.",
        /** Cómo nombra el bot a esta estrategia en sus mensajes de error. */
        backendName: "Auto Clean Message",
    },
    ghost: {
        endpoint: "ghostMessage",
        valueField: "lifetimeValue",
        unitField: "lifetimeUnit",
        label: "Mensajes fantasma",
        intro: "Cada mensaje del canal se elimina solo después del tiempo que elijas.",
        timeLabel: "Eliminar cada mensaje después de",
        empty: "Todavía no hay canales con mensajes fantasma.",
        saved: "Mensajes fantasma guardados.",
        deleted: "Mensajes fantasma eliminados.",
        deleteTitle: "Eliminar mensajes fantasma",
        deleteQuestion: (channel: string) => `¿Seguro que querés eliminar los mensajes fantasma de ${channel}?`,
        sameKindConflict: "Este canal ya tiene mensajes fantasma. Editá la configuración existente.",
        backendName: "Ghost Message",
    },
} as const;

export const CLEANUP_KIND_IDS: CleanupKind[] = ["autoClean", "ghost"];

export const OTHER_STRATEGY_CONFLICT = "Este canal ya tiene configurada otra estrategia de limpieza.";
export const PINNED_MESSAGES_NOTE = "Los mensajes fijados no se eliminarán.";

export function otherKind(kind: CleanupKind): CleanupKind {
    return kind === "autoClean" ? "ghost" : "autoClean";
}

// ─── Validación de tiempo ────────────────────────────────────────────────────

/** Misma tolerancia que el bot: absorbe el error de punto flotante sin aceptar 1.33. */
const QUARTER_TOLERANCE = 1e-9;

export const TIME_ERRORS = {
    empty: "Ingresá un número.",
    notPositive: "El valor debe ser mayor que 0.",
    hours: "En horas, usá intervalos de 15 minutos: 0.25, 0.50, 0.75, 1, 1.25...",
    days: "Los días deben ser un número entero.",
    unit: "Elegí Horas o Días.",
} as const;

export function isCleanupTimeUnit(unit: unknown): unit is CleanupTimeUnit {
    return unit === "hours" || unit === "days";
}

/** Error de validación del tiempo, o null si es válido: horas en múltiplos de 0.25, días enteros, siempre > 0. */
export function validateCleanupTime(value: number, unit: unknown): string | null {
    if (!isCleanupTimeUnit(unit)) return TIME_ERRORS.unit;
    if (!Number.isFinite(value)) return TIME_ERRORS.empty;
    if (value <= 0) return TIME_ERRORS.notPositive;
    if (unit === "days") return Number.isInteger(value) ? null : TIME_ERRORS.days;
    const quarters = value * 4;
    return Math.abs(quarters - Math.round(quarters)) <= QUARTER_TOLERANCE ? null : TIME_ERRORS.hours;
}

/** Texto del input → número. Acepta coma decimal; cualquier otra cosa da NaN. */
export function parseCleanupValue(text: string): number {
    const normalized = text.trim().replace(",", ".");
    return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}

/** `step` del input numérico. Es solo una ayuda del navegador: la validación real es `validateCleanupTime`. */
export function timeInputStep(unit: CleanupTimeUnit): number {
    return unit === "hours" ? 0.25 : 1;
}

// ─── Formato humano ──────────────────────────────────────────────────────────

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "15 minutos", "1 hora", "2 horas 30 minutos", "1 día". `joiner` va entre horas y minutos. */
export function formatCleanupDuration(value: number, unit: CleanupTimeUnit, joiner = " "): string {
    if (unit === "days") return plural(value, "día", "días");
    const totalMinutes = Math.round(value * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const parts = [
        ...(hours > 0 ? [plural(hours, "hora", "horas")] : []),
        ...(minutes > 0 ? [plural(minutes, "minuto", "minutos")] : []),
    ];
    return parts.join(joiner);
}

export function describeCleanup(kind: CleanupKind, config: Pick<CleanupConfig, "value" | "unit">): string {
    const duration = formatCleanupDuration(config.value, config.unit, " y ");
    return kind === "autoClean" ? `Cada ${duration}` : `Los mensajes duran ${duration}`;
}

// ─── Entidades, borradores y payload ─────────────────────────────────────────

export function toCleanupConfig(kind: CleanupKind, raw: AutoCleanMessage | GhostMessage): CleanupConfig {
    if (kind === "autoClean") {
        const item = raw as AutoCleanMessage;
        return { id: item.id, channelId: item.channelId, value: item.frequencyValue, unit: item.frequencyUnit, enabled: item.enabled, nextRunAt: item.nextRunAt ?? null };
    }
    const item = raw as GhostMessage;
    return { id: item.id, channelId: item.channelId, value: item.lifetimeValue, unit: item.lifetimeUnit, enabled: item.enabled, nextRunAt: null };
}

export function emptyCleanupDraft(): CleanupDraft {
    return { id: null, channelId: "", value: "", unit: "hours", enabled: true };
}

export function draftFromConfig(config: CleanupConfig): CleanupDraft {
    return { id: config.id, channelId: config.channelId, value: String(config.value), unit: config.unit, enabled: config.enabled };
}

/** Cambiar la unidad conserva el número tal cual: si deja de ser válido (2.5 días), la validación lo marca. */
export function changeDraftUnit(draft: CleanupDraft, unit: CleanupTimeUnit): CleanupDraft {
    return { ...draft, unit };
}

export type CleanupLists = Record<CleanupKind, CleanupConfig[]>;

/** Conflicto conocido del lado del panel para ese canal. El bot igual responde 409 si algo cambió. */
export function channelConflict(kind: CleanupKind, channelId: string, lists: CleanupLists, editingId: string | null): string | null {
    if (!channelId) return null;
    if (lists[otherKind(kind)].some((item) => item.channelId === channelId)) return OTHER_STRATEGY_CONFLICT;
    if (lists[kind].some((item) => item.channelId === channelId && item.id !== editingId)) return CLEANUP_KINDS[kind].sameKindConflict;
    return null;
}

export type CleanupDraftErrors = Partial<Record<"channelId" | "value", string>>;

export function validateCleanupDraft(kind: CleanupKind, draft: CleanupDraft, lists: CleanupLists): CleanupDraftErrors {
    const errors: CleanupDraftErrors = {};
    if (!draft.channelId) errors.channelId = "Seleccioná un canal.";
    else {
        const conflict = channelConflict(kind, draft.channelId, lists, draft.id);
        if (conflict) errors.channelId = conflict;
    }
    const value = parseCleanupValue(draft.value);
    const timeError = draft.value.trim() === "" ? TIME_ERRORS.empty : validateCleanupTime(value, draft.unit);
    if (timeError) errors.value = timeError;
    return errors;
}

export function buildCleanupPayload(kind: CleanupKind, draft: CleanupDraft): AutoCleanMessagePayload | GhostMessagePayload {
    const raw = parseCleanupValue(draft.value);
    // Redondea al cuarto de hora para no mandar 1.2500000000000002.
    const value = draft.unit === "hours" ? Math.round(raw * 4) / 4 : raw;
    return kind === "autoClean"
        ? { channelId: draft.channelId, frequencyValue: value, frequencyUnit: draft.unit, enabled: draft.enabled }
        : { channelId: draft.channelId, lifetimeValue: value, lifetimeUnit: draft.unit, enabled: draft.enabled };
}

/** Lo que el formulario manda, o los errores que impiden mandarlo. Nunca hay payload con un borrador inválido. */
export function prepareCleanupSave(kind: CleanupKind, draft: CleanupDraft, lists: CleanupLists):
    | { ok: true; payload: AutoCleanMessagePayload | GhostMessagePayload }
    | { ok: false; errors: CleanupDraftErrors } {
    const errors = validateCleanupDraft(kind, draft, lists);
    if (Object.keys(errors).length > 0) return { ok: false, errors };
    return { ok: true, payload: buildCleanupPayload(kind, draft) };
}

// ─── Errores de la API ───────────────────────────────────────────────────────

export interface ApiErrorBody {
    message?: string;
    error?: string;
}

/**
 * Mensaje para el usuario a partir de la respuesta del BFF/bot. Los textos del bot son técnicos
 * ("frequencyValue debe ser..."), así que solo se muestran los que redacta el BFF (403, límites).
 * `status` 0 = no hubo respuesta.
 */
export function cleanupErrorMessage(kind: CleanupKind, status: number, body: ApiErrorBody, fallback: string): string {
    const text = body.message || body.error || "";
    switch (status) {
        case 0:
        case 502:
        case 503:
        case 504:
            return "No se pudo conectar con el bot. Probá de nuevo en unos minutos.";
        case 400:
            return "Los datos no son válidos. Revisá el canal y el tiempo.";
        case 401:
            return "Tu sesión expiró. Volvé a iniciar sesión.";
        case 403:
            return text || "No tenés permiso para administrar este servidor.";
        case 404:
            return "No se encontró la configuración. Puede que la hayan eliminado.";
        case 409:
            return text.includes(CLEANUP_KINDS[kind].backendName) ? CLEANUP_KINDS[kind].sameKindConflict : OTHER_STRATEGY_CONFLICT;
        case 429:
            return "Demasiadas solicitudes. Probá de nuevo en unos segundos.";
        default:
            return fallback;
    }
}
