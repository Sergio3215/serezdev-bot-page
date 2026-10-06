import type { CustomCommand, CustomCommandPayload, TriggerType } from "@/types/CustomCommand";

export const TRIGGER_TYPES: { id: TriggerType; label: string; description: string }[] = [
    { id: "exact", label: "Coincidencia exacta", description: "Todo el mensaje coincide." },
    { id: "startsWith", label: "Empieza con", description: "El mensaje comienza con el trigger." },
    { id: "endsWith", label: "Termina con", description: "El mensaje termina con el trigger." },
    { id: "include", label: "Contiene", description: "El trigger aparece en cualquier parte." },
];

const TRIGGER_IDS = new Set<string>(TRIGGER_TYPES.map((trigger) => trigger.id));
const DEFAULT_TRIGGER: TriggerType = "include";

export function isTriggerType(value: unknown): value is TriggerType {
    return typeof value === "string" && TRIGGER_IDS.has(value);
}

/** Lista de IDs sin vacíos, sin espacios sobrantes ni duplicados, conservando el orden. */
export function cleanRoleIds(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const ids = value.filter((id): id is string => typeof id === "string").map((id) => id.trim()).filter(Boolean);
    return [...new Set(ids)];
}

/** Los comandos guardados sin trigger ni roles se representan como `include` y abiertos a todos. */
export function normalizeCustomCommand(raw: Record<string, unknown>): CustomCommand {
    return {
        id: String(raw.id ?? ""),
        command: typeof raw.command === "string" ? raw.command : "",
        triggerType: isTriggerType(raw.triggerType) ? raw.triggerType : DEFAULT_TRIGGER,
        code: typeof raw.code === "string" ? raw.code : "",
        description: typeof raw.description === "string" ? raw.description : null,
        allowedRoleIds: cleanRoleIds(raw.allowedRoleIds),
        enabled: raw.enabled !== false,
    };
}

/**
 * Roles que siguen existiendo en el servidor. Mientras los roles no cargaron (`null`),
 * se conserva la lista para no borrar permisos por un error de red.
 */
export function effectiveRoleIds(allowedRoleIds: string[], serverRoleIds: string[] | null): string[] {
    const ids = cleanRoleIds(allowedRoleIds);
    if (serverRoleIds === null) return ids;
    const existing = new Set(serverRoleIds);
    return ids.filter((id) => existing.has(id));
}

export function buildCustomCommandPayload(
    draft: { command: string; triggerType: TriggerType; code: string; description: string; allowedRoleIds: string[] },
    serverRoleIds: string[] | null,
    isNew: boolean
): CustomCommandPayload {
    const description = draft.description.trim();
    return {
        command: draft.command.trim(),
        triggerType: isTriggerType(draft.triggerType) ? draft.triggerType : DEFAULT_TRIGGER,
        code: draft.code,
        description: description === "" ? null : description,
        allowedRoleIds: effectiveRoleIds(draft.allowedRoleIds, serverRoleIds),
        ...(isNew ? { enabled: true } : {}),
    };
}
