const ADMINISTRATOR = BigInt(0x8);
const MANAGE_GUILD = BigInt(0x20);

export type GuildAccess =
    | { status: "allowed" }
    | { status: "denied" }           // sesión válida, pero no administra ese servidor
    | { status: "unauthenticated" }  // token vencido o inválido
    | { status: "unknown"; httpStatus: number }; // 429, 5xx, red caída

/**
 * Verifica contra Discord que el dueño del token administre el servidor pedido.
 * Es la única fuente de verdad: la usan tanto las rutas de API como las páginas.
 */
export async function checkGuildAdmin(userToken: string, guildId: string): Promise<GuildAccess> {
    try {
        const res = await fetch("https://discord.com/api/users/@me/guilds", {
            headers: { Authorization: `Bearer ${userToken}` },
            cache: "no-store",
        });

        if (!res.ok) {
            const detail = await res.text().catch(() => "");
            console.error(`[guildAccess] /users/@me/guilds respondió ${res.status}:`, detail);

            if (res.status === 401) return { status: "unauthenticated" };
            return { status: "unknown", httpStatus: res.status };
        }

        const guilds: Array<{ id: string; owner: boolean; permissions: string }> = await res.json();
        const target = guilds.find((g) => g.id === guildId);

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
