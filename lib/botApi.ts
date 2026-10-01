/**
 * URL del proxy del panel hacia el backend del bot. El proxy verifica que el usuario
 * administre el servidor y fija `serverId`, así que el cliente no necesita mandarlo.
 */
export function botApiUrl(serverId: string, path: string, query?: Record<string, string>): string {
    const base = `/api/guilds/${encodeURIComponent(serverId)}/backend/${path}`;
    if (!query) return base;
    return `${base}?${new URLSearchParams(query)}`;
}
