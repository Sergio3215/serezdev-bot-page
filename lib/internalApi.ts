/**
 * Backend del bot (Railway). Solo se usa del lado del servidor: el secreto interno
 * nunca llega al navegador, que pasa por `/api/guilds/[server]/backend/...`.
 */
export const BOT_API_BASE = `${process.env.NEXT_PUBLIC_URL || "https://server-serez-dev-bot-production.up.railway.app"}/api/v1`;

export function internalApiHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${process.env.INTERNAL_API_SECRET}` };
}
