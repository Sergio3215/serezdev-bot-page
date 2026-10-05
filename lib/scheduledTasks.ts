import type { ScheduledTask, ScheduledTaskDraft, ScheduledTaskPayload, ScheduleType } from "@/types/ScheduledTask";

export const CONTENT_MAX_LENGTH = 2000;
export const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires";

export const SCHEDULE_TYPES: { id: ScheduleType; label: string }[] = [
    { id: "daily", label: "Todos los días" },
    { id: "weekly", label: "Algunos días de la semana" },
];

/** Índice = número de día de la API (0 = domingo). */
export const WEEKDAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** Orden de presentación: la semana empieza el lunes. */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(time: string): boolean {
    return TIME_PATTERN.test(time);
}

export function isValidTimezone(timezone: string): boolean {
    if (!timezone.trim()) return false;
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone.trim() }).format();
        return true;
    } catch {
        return false;
    }
}

/** Zona horaria del navegador, o la de Argentina si no se puede leer. */
export function browserTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
    } catch {
        return DEFAULT_TIMEZONE;
    }
}

/** Zonas IANA que conoce el navegador; si no las expone, una lista corta de las más usadas. */
export function timezoneOptions(): string[] {
    const fallback = [
        DEFAULT_TIMEZONE, "America/Montevideo", "America/Santiago", "America/Sao_Paulo", "America/Bogota",
        "America/Lima", "America/Mexico_City", "America/New_York", "Europe/Madrid", "UTC",
    ];
    try {
        const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
        return intl.supportedValuesOf?.("timeZone") ?? fallback;
    } catch {
        return fallback;
    }
}

/** Días únicos, válidos y ordenados. */
export function cleanWeekdays(weekdays: number[]): number[] {
    return [...new Set(weekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b);
}

export function emptyDraft(timezone: string = DEFAULT_TIMEZONE): ScheduledTaskDraft {
    return { id: null, name: "", channelId: "", content: "", scheduleType: "daily", time: "09:00", weekdays: [], timezone, enabled: true };
}

export function draftFromTask(task: ScheduledTask): ScheduledTaskDraft {
    return {
        id: task.id,
        name: task.name,
        channelId: task.channelId,
        content: task.content,
        scheduleType: task.scheduleType === "weekly" ? "weekly" : "daily",
        time: task.time,
        weekdays: cleanWeekdays(task.weekdays ?? []),
        timezone: task.timezone,
        enabled: task.enabled,
    };
}

export type DraftErrors = Partial<Record<"name" | "channelId" | "content" | "scheduleType" | "time" | "weekdays" | "timezone", string>>;

export function validateDraft(draft: ScheduledTaskDraft): DraftErrors {
    const errors: DraftErrors = {};
    if (!draft.name.trim()) errors.name = "Escribí un nombre.";
    if (!draft.channelId) errors.channelId = "Elegí un canal.";
    if (!draft.content.trim()) errors.content = "Escribí el mensaje.";
    else if (draft.content.trim().length > CONTENT_MAX_LENGTH) errors.content = `El mensaje no puede superar ${CONTENT_MAX_LENGTH} caracteres.`;
    if (!SCHEDULE_TYPES.some((type) => type.id === draft.scheduleType)) errors.scheduleType = "Elegí una frecuencia.";
    if (!isValidTime(draft.time)) errors.time = "La hora debe tener formato HH:mm.";
    if (!isValidTimezone(draft.timezone)) errors.timezone = "Elegí una zona horaria válida.";
    if (draft.scheduleType === "weekly" && cleanWeekdays(draft.weekdays).length === 0) errors.weekdays = "Elegí al menos un día.";
    return errors;
}

/** Cuerpo para la API. `daily` siempre envía `weekdays: []`; `enabled` solo al crear (la edición no lo acepta). */
export function buildPayload(draft: ScheduledTaskDraft): ScheduledTaskPayload {
    return {
        name: draft.name.trim(),
        channelId: draft.channelId,
        content: draft.content.trim(),
        scheduleType: draft.scheduleType,
        time: draft.time,
        weekdays: draft.scheduleType === "daily" ? [] : cleanWeekdays(draft.weekdays),
        timezone: draft.timezone.trim(),
        ...(draft.id === null ? { enabled: draft.enabled } : {}),
    };
}

/** Texto corto de la recurrencia, por ejemplo "Lun, Mié y Vie a las 18:30". */
export function describeSchedule(task: Pick<ScheduledTask, "scheduleType" | "time" | "weekdays">): string {
    if (task.scheduleType === "daily") return `Todos los días a las ${task.time}`;
    const days = WEEKDAY_ORDER.filter((day) => task.weekdays.includes(day)).map((day) => WEEKDAY_LABELS[day].slice(0, 3));
    const list = days.length <= 1 ? days.join("") : `${days.slice(0, -1).join(", ")} y ${days[days.length - 1]}`;
    return `${list} a las ${task.time}`;
}
