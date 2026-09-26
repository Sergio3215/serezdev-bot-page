const ADMINISTRATOR = BigInt(0x8);
const MANAGE_GUILD = BigInt(0x20);

export type GuildAccess =
    | { status: "allowed" }
    | { status: "denied" }           // sesión válida, pero no administra ese servidor
    | { status: "unauthenticated" }  // token vencido o inválido
    | { status: "unknown"; httpStatus: number }; // 429, 5xx, red caída

export type DiscordGuildsResult =
    | { ok: true; guilds: Array<{ id: string; owner: boolean; permissions: string }> }
    | { ok: false; status: number; body: string };

const GUILDS_TTL_MS = 60_000;
const guildsCache = new Map<string, { expires: number; promise: Promise<DiscordGuildsResult> }>();

/**
 * `GET /users/@me/guilds` con caché de un minuto por credencial. Discord limita mucho
 * esta ruta y el panel la necesita en varias requests seguidas al abrir un servidor;
 * las llamadas simultáneas comparten la misma promesa. Los errores no se cachean.
 */
export function fetchDiscordGuilds(authorization: string): Promise<DiscordGuildsResult> {
    const now = Date.now();
    const hit = guildsCache.get(authorization);
    if (hit && hit.expires > now) return hit.promise;

    if (guildsCache.size > 500) {
        for (const [key, entry] of guildsCache) if (entry.expires <= now) guildsCache.delete(key);
    }

    const promise: Promise<DiscordGuildsResult> = fetch("https://discord.com/api/users/@me/guilds", {
        headers: { Authorization: authorization },
        cache: "no-store",
    }).then(async (res) =>
        res.ok
            ? { ok: true as const, guilds: await res.json() }
            : { ok: false as const, status: res.status, body: await res.text().catch(() => "") }
    );

    guildsCache.set(authorization, { expires: now + GUILDS_TTL_MS, promise });
    promise.then(
        (result) => { if (!result.ok) guildsCache.delete(authorization); },
        () => guildsCache.delete(authorization)
    );
    return promise;
}

/**
 * Verifica contra Discord que el dueño del token administre el servidor pedido.
 * Es la única fuente de verdad: la usan tanto las rutas de API como las páginas.
 */
export async function checkGuildAdmin(userToken: string, guildId: string): Promise<GuildAccess> {
    try {
        const res = await fetchDiscordGuilds(`Bearer ${userToken}`);

        if (!res.ok) {
            console.error(`[guildAccess] /users/@me/guilds respondió ${res.status}:`, res.body);
            if (res.status === 401) return { status: "unauthenticated" };
            return { status: "unknown", httpStatus: res.status };
        }

        const target = res.guilds.find((g) => g.id === guildId);

        if (!target) return { status: "denied" };
        if (target.owner) return { status: "allowed" };

        const perms = BigInt(target.permissions);
        const isAdmin =
            (perms & ADMINISTRATOR) === ADMINISTRATOR ||
            (perms & MANAGE_GUILD) === MANAGE_GUILD;

        return isAdmin ? { status: "allowed" } : { status: "denied" };
    } catch (err) {
        console.error("[guildAccess] fallo al consultar Discord:", err);
        return { status: "unknown", httpStatus: 0 };
    }
}
