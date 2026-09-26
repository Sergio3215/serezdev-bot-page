import { ALWAYS_PREMIUM_SERVER_IDS } from "@/lib/plans";
import type { PlanId, SubscriptionState, SubscriptionUpsert, SubscriptionView } from "@/types/Billing";

/**
 * Acceso a las suscripciones a través del backend del bot (Railway), igual que el
 * resto del panel (tarjetas, cumpleaños, gifs). El panel NO habla con MongoDB
 * directamente: le pega a `/api/v1/subscriptions` y el backend —que usa Prisma/Mongo—
 * persiste en su schema normalizado (Tier/Status/Provider/Payment). El bot lee esa
 * misma data para aplicar el plan.
 *
 * Contrato esperado del backend:
 *   GET  /api/v1/subscriptions?serverId=...
 *        -> { data: [ { serverId, tier, status, currentPeriodStart, currentPeriodEnd } ] }
 *   POST /api/v1/subscriptions
 *        -> upsert por serverId. Body: { serverId, tier, status, currentPeriodStart?,
 *           currentPeriodEnd?, payment? }. `tier`/`status`/`payment.provider` son los
 *           `code` de las tablas correspondientes.
 */

export const API_BASE = `${process.env.NEXT_PUBLIC_URL || "https://server-serez-dev-bot-production.up.railway.app"}/api/v1`;
export const SUBSCRIPTION_API = `${API_BASE}/subscriptions`;

/** Header opcional de secreto interno panel↔backend, si está configurado. */
function authHeaders(): Record<string, string> {
    const secret = process.env.INTERNAL_API_SECRET;
    return secret ? { Authorization: `Bearer ${secret}` } : {};
}

function rowToState(row: Record<string, unknown>, serverId: string): SubscriptionState {
    return {
        serverId: (row.serverId as string) ?? serverId,
        tier: (row.tier as PlanId) ?? "free",
        status: (row.status as SubscriptionState["status"]) ?? "active",
        currentPeriodStart: (row.currentPeriodStart as string) ?? null,
        currentPeriodEnd: (row.currentPeriodEnd as string) ?? null,
    };
}

export async function getSubscription(serverId: string): Promise<SubscriptionState | null> {
    const res = await fetch(`${SUBSCRIPTION_API}?serverId=${serverId}`, {
        cache: "no-store",
        headers: authHeaders(),
    });

    // Endpoint todavía no creado en el backend → tratamos como "sin suscripción".
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`El backend respondió ${res.status} al leer la suscripción.`);

    const dto = await res.json();
    const row = dto?.data?.[0];
    return row ? rowToState(row, serverId) : null;
}

/**
 * Upsert por serverId contra el backend. Lo usan los webhooks tras confirmar el pago.
 * Lanza si el backend responde con error, para que el proveedor reintente el webhook.
 */
export async function upsertSubscription(serverId: string, body: SubscriptionUpsert): Promise<void> {
    const res = await fetch(SUBSCRIPTION_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ serverId, ...body }),
    });

    if (!res.ok) {
        throw new Error(`El backend respondió ${res.status} al guardar la suscripción.`);
    }
}

/** Fecha ISO a un mes vista: fin del acceso de un pago de 1 mes o de un período mensual. */
export function inOneMonth(from: Date = new Date()): string {
    const d = new Date(from);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString();
}

/**
 * Plan efectivo de un servidor: solo cuenta si el estado es "active" y, cuando hay
 * `currentPeriodEnd`, si no venció. Es la misma regla que tiene que aplicar el bot.
 */
export function resolveActivePlan(state: SubscriptionState | null): PlanId {
    if (!state || state.status !== "active") return "free";
    if (state.currentPeriodEnd && new Date(state.currentPeriodEnd).getTime() < Date.now()) {
        return "free";
    }
    return state.tier;
}

/** Vista recortada para el cliente. */
export function toView(serverId: string, state: SubscriptionState | null): SubscriptionView {
    if (ALWAYS_PREMIUM_SERVER_IDS.includes(serverId)) {
        return { serverId, plan: "premium", status: "active", currentPeriodEnd: null };
    }
    return {
        serverId,
        plan: resolveActivePlan(state),
        status: state?.status ?? "active",
        currentPeriodEnd: state?.currentPeriodEnd ?? null,
    };
}

/** Plan vigente del servidor. Los de Premium permanente no consultan al backend. */
export async function getServerPlanView(serverId: string): Promise<SubscriptionView> {
    if (ALWAYS_PREMIUM_SERVER_IDS.includes(serverId)) return toView(serverId, null);
    return toView(serverId, await getSubscription(serverId));
}
