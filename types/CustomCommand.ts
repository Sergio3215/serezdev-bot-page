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

export interface CustomCommandPreviewRequest {
    code: string;
    message: string;
    mention: boolean;
}

export interface CustomCommandPreviewEmbed {
    title: string | null;
    description: string | null;
    color: string | null;
    url: string | null;
    image: string | null;
    author: { name: string; icon: string | null; url: string | null } | null;
    footer: { text: string; icon: string | null } | null;
}

export type CustomCommandPreviewAction =
    | { type: "ReplyMessage"; message: string | null }
    | { type: "SendMessage"; channelId: string; message: string | null }
    | { type: "ReplyEmbed"; message: string | null; embed: CustomCommandPreviewEmbed }
    | { type: "SendEmbed"; channelId: string; message: string | null; embed: CustomCommandPreviewEmbed }
    | { type: "AddRole"; memberId: string; memberName: string; roleId: string };

export interface CustomCommandPreviewDiagnostic {
    phase: string;
    code: string;
    message: string;
    line: number | null;
    column: number | null;
}

/** Resultado de ejecutar el código en el bot con un contexto simulado y sin efectos reales. */
export interface CustomCommandPreview {
    ok: boolean;
    stage: "compile" | "runtime" | null;
    diagnostics: CustomCommandPreviewDiagnostic[];
    actions: CustomCommandPreviewAction[];
    context: {
        message: string;
        serverId: string;
        memberCount: number;
        author: { id: string; username: string; displayName: string };
        channel: { id: string; name: string };
        mentionedMembers: { id: string; displayName: string }[];
    };
}
