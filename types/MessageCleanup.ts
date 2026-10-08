/** Únicas unidades que acepta el bot para Auto Clean y Ghost Messages. */
export type CleanupTimeUnit = "hours" | "days";

/** Limpieza automática (Auto Clean) y Mensajes fantasma (Ghost). Un canal puede tener solo una de las dos. */
export type CleanupKind = "autoClean" | "ghost";

/** Auto Clean: limpia el canal completo cada `frequencyValue` `frequencyUnit`. */
export interface AutoCleanMessage {
    id: string;
    serverId: string;
    channelId: string;
    frequencyValue: number;
    frequencyUnit: CleanupTimeUnit;
    enabled: boolean;
    nextRunAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

/** Ghost Message: cada mensaje del canal se elimina `lifetimeValue` `lifetimeUnit` después de enviarse. */
export interface GhostMessage {
    id: string;
    serverId: string;
    channelId: string;
    lifetimeValue: number;
    lifetimeUnit: CleanupTimeUnit;
    enabled: boolean;
    createdAt?: string;
    updatedAt?: string;
}

/** Vista común de ambas entidades para listas y formularios. */
export interface CleanupConfig {
    id: string;
    channelId: string;
    value: number;
    unit: CleanupTimeUnit;
    enabled: boolean;
    nextRunAt: string | null;
}

/** Estado editable del formulario. `value` es el texto del input, para poder marcarlo inválido sin perderlo. */
export interface CleanupDraft {
    id: string | null;
    channelId: string;
    value: string;
    unit: CleanupTimeUnit;
    enabled: boolean;
}

/** Cuerpo para el bot (el BFF agrega `serverId`). */
export type AutoCleanMessagePayload = Pick<AutoCleanMessage, "channelId" | "frequencyValue" | "frequencyUnit" | "enabled">;
export type GhostMessagePayload = Pick<GhostMessage, "channelId" | "lifetimeValue" | "lifetimeUnit" | "enabled">;
