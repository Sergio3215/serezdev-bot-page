export type TriggerType = "exact" | "startsWith" | "endsWith" | "include";

/** Comando tal como lo devuelve la API, ya normalizado (ver `normalizeCustomCommand`). */
export interface CustomCommand {
    id: string;
    command: string;
    triggerType: TriggerType;
    code: string;
    description: string | null;
    allowedRoleIds: string[];
    enabled: boolean;
}

export interface CustomCommandPayload {
    command: string;
    triggerType: TriggerType;
    code: string;
    description: string | null;
    allowedRoleIds: string[];
    enabled?: boolean;
}
