import type { DiscordGuild } from "@/types/DiscordTypes";

export const MAX_GUILD_RETRIES = 3;

export interface GuildsResponse {
    ok: boolean;
    status: number;
    data: { botGuilds?: DiscordGuild[]; otherAdminGuilds?: DiscordGuild[]; needsReauth?: boolean; retryAfter?: unknown };
}

export type GuildsOutcome =
    | { kind: "loaded"; botGuilds: DiscordGuild[]; otherAdminGuilds: DiscordGuild[] }
    | { kind: "reauth" }
    | { kind: "failed" }
    | { kind: "cancelled" };

interface LoadGuildsOptions {
    request: () => Promise<GuildsResponse>;
    /** Resultado de la validación de sesión; la respuesta de guilds solo se aplica si es true. */
    authenticated: Promise<boolean>;
    signal: AbortSignal;
    wait?: (seconds: number) => Promise<void>;
}

const defaultWait = (seconds: number) => new Promise<void>((resolve) => setTimeout(resolve, seconds * 1000));

/**
 * La primera consulta sale sin esperar a la sesión; su resultado se aplica cuando la sesión queda confirmada.
 * Discord limita mucho la lista de servidores: ante un 429 espera lo que indica y reintenta.
 */
export async function loadGuilds({ request, authenticated, signal, wait = defaultWait }: LoadGuildsOptions): Promise<GuildsOutcome> {
    let pending = request();
    for (let attempt = 0; attempt <= MAX_GUILD_RETRIES; attempt++) {
        const [res, isAuthenticated] = await Promise.all([pending, authenticated]);
        if (signal.aborted || !isAuthenticated) return { kind: "cancelled" };
        if (res.status === 401 && res.data.needsReauth) return { kind: "reauth" };
        if (res.ok) return { kind: "loaded", botGuilds: res.data.botGuilds ?? [], otherAdminGuilds: res.data.otherAdminGuilds ?? [] };
        if (res.status !== 429 || attempt === MAX_GUILD_RETRIES) return { kind: "failed" };
        await wait(Math.min(Math.max(Number(res.data.retryAfter) || 1, 0.5), 10));
        if (signal.aborted) return { kind: "cancelled" };
        pending = request();
    }
    return { kind: "failed" };
}
