import crypto from "node:crypto";
import { amountFor, getPlan } from "@/lib/plans";
import type { BillingCycle, PlanId } from "@/types/Billing";

const API_URL = "https://api.lemonsqueezy.com/v1";

const VARIANT_ENV: Record<Exclude<PlanId, "free">, Record<BillingCycle, string>> = {
    pro: {
        monthly: "LEMONSQUEEZY_VARIANT_PRO_MONTHLY",
        onetime: "LEMONSQUEEZY_VARIANT_PRO_ONETIME",
    },
    premium: {
        monthly: "LEMONSQUEEZY_VARIANT_PREMIUM_MONTHLY",
        onetime: "LEMONSQUEEZY_VARIANT_PREMIUM_ONETIME",
    },
};

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Falta ${name} en el servidor.`);
    return value;
}

async function lsFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
            Accept: "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json",
            Authorization: `Bearer ${requireEnv("LEMONSQUEEZY_API_KEY")}`,
            ...init?.headers,
        },
        cache: "no-store",
    });

    if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Lemon Squeezy respondió ${res.status}: ${detail}`);
    }
    return res.json() as Promise<T>;
}

/** Plan al que corresponde un variant id, según las variables de entorno. */
export function planFromVariant(variantId: string | number | null | undefined): PlanId | null {
    if (variantId == null) return null;
    const id = String(variantId);
    for (const [plan, cycles] of Object.entries(VARIANT_ENV)) {
        if (Object.values(cycles).some((envName) => process.env[envName] === id)) {
            return plan as PlanId;
        }
    }
    return null;
}

/** Lo que viaja en custom_data y vuelve en `meta.custom_data` de cada webhook. */
export interface LsCustomData {
    server_id: string;
    plan: PlanId;
    cycle: BillingCycle;
    user_id: string;
}

export interface CheckoutParams {
    plan: PlanId;
    cycle: BillingCycle;
    serverId: string;
    userId: string;
    origin: string;
}

/**
 * Crea un checkout de Lemon Squeezy. El precio sale de `lib/plans.ts` vía
 * `custom_price`; para suscripciones se aplica también a las renovaciones.
 */
export async function createLemonSqueezyCheckout({
    plan,
    cycle,
    serverId,
    userId,
    origin,
}: CheckoutParams): Promise<{ url: string }> {
    const planDef = getPlan(plan);
    const amount = amountFor(plan, "usd", cycle);
    if (!planDef || amount == null || plan === "free") {
        throw new Error(`Plan inválido o sin precio: ${plan}`);
    }

    const storeId = requireEnv("LEMONSQUEEZY_STORE_ID");
    const variantId = requireEnv(VARIANT_ENV[plan][cycle]);
    const custom: LsCustomData = { server_id: serverId, plan, cycle, user_id: userId };

    const res = await lsFetch<{ data: { attributes: { url: string } } }>("/checkouts", {
        method: "POST",
        body: JSON.stringify({
            data: {
                type: "checkouts",
                attributes: {
                    custom_price: Math.round(amount * 100),
                    checkout_data: { custom },
                    product_options: {
                        name: `Serez Dev Bot — ${planDef.name}`,
                        enabled_variants: [Number(variantId)],
                        redirect_url: `${origin}/dashboard/${serverId}?checkout=success`,
                    },
                },
                relationships: {
                    store: { data: { type: "stores", id: storeId } },
                    variant: { data: { type: "variants", id: variantId } },
                },
            },
        }),
    });

    const url = res.data?.attributes?.url;
    if (!url) throw new Error("Lemon Squeezy no devolvió una URL de checkout.");
    return { url };
}

export interface LsSubscriptionAttributes {
    status: "on_trial" | "active" | "paused" | "past_due" | "unpaid" | "cancelled" | "expired";
    variant_id: number;
    renews_at: string | null;
    ends_at: string | null;
    created_at: string;
}

export async function getLemonSqueezySubscription(id: string | number): Promise<LsSubscriptionAttributes> {
    const res = await lsFetch<{ data: { attributes: LsSubscriptionAttributes } }>(`/subscriptions/${id}`);
    return res.data.attributes;
}

/** `X-Signature` es el HMAC-SHA256 en hex del cuerpo crudo con el signing secret. */
export function verifyLemonSqueezySignature(rawBody: string, signature: string | null): boolean {
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    if (!secret || !signature) return false;

    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    try {
        return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
    } catch {
        return false;
    }
}
