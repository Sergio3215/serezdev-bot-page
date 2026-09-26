import Stripe from "stripe";
import { amountFor, getPlan } from "@/lib/plans";
import type { BillingCycle, PlanId } from "@/types/Billing";

let stripe: Stripe | null = null;

/** Cliente de Stripe. Lanza si falta la clave, para no fallar silenciosamente. */
export function getStripe(): Stripe {
    if (!stripe) {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) throw new Error("Falta STRIPE_SECRET_KEY en el servidor.");
        // Sin apiVersion fija: usa la de la cuenta y evita desajustes de tipos.
        stripe = new Stripe(key);
    }
    return stripe;
}

export interface CheckoutParams {
    plan: PlanId;
    cycle: BillingCycle;
    serverId: string;
    userId: string;
    /** Base pública desde donde se inició el checkout, para las URLs de retorno. */
    origin: string;
}

/**
 * Crea una Checkout Session con precio dinámico (no hace falta crear productos en el
 * dashboard). Devuelve la URL a la que redirigir al usuario.
 *
 * - mensual  → mode "subscription" con `recurring.interval = month`.
 * - único    → mode "payment".
 */
export async function createStripeCheckout({
    plan,
    cycle,
    serverId,
    userId,
    origin,
}: CheckoutParams): Promise<{ url: string }> {
    const planDef = getPlan(plan);
    const amount = amountFor(plan, "usd", cycle);
    if (!planDef || amount == null) {
        throw new Error(`Plan inválido o sin precio: ${plan}`);
    }

    const isSubscription = cycle === "monthly";
    const metadata = { serverId, plan, cycle, userId, provider: "stripe" };

    const session = await getStripe().checkout.sessions.create({
        mode: isSubscription ? "subscription" : "payment",
        client_reference_id: serverId,
        line_items: [
            {
                quantity: 1,
                price_data: {
                    currency: "usd",
                    unit_amount: Math.round(amount * 100), // Stripe cobra en centavos.
                    product_data: {
                        name: `Serez Dev Bot — ${planDef.name}`,
                        description: isSubscription
                            ? `Plan ${planDef.name} mensual para el servidor ${serverId}`
                            : `Plan ${planDef.name} (pago único) para el servidor ${serverId}`,
                    },
                    ...(isSubscription ? { recurring: { interval: "month" as const } } : {}),
                },
            },
        ],
        metadata,
        // Para suscripciones, que el objeto subscription también lleve la metadata.
        ...(isSubscription ? { subscription_data: { metadata } } : {}),
        success_url: `${origin}/dashboard/${serverId}?checkout=success`,
        cancel_url: `${origin}/dashboard/${serverId}?checkout=cancel`,
    });

    if (!session.url) throw new Error("Stripe no devolvió una URL de checkout.");
    return { url: session.url };
}

/** Verifica la firma del webhook y devuelve el evento. Lanza si la firma no valida. */
export function constructStripeEvent(rawBody: string, signature: string): Stripe.Event {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error("Falta STRIPE_WEBHOOK_SECRET en el servidor.");
    return getStripe().webhooks.constructEvent(rawBody, signature, secret);
}

/** Fin del período de una suscripción en ISO, robusto entre versiones de la API. */
export function subscriptionPeriodEnd(sub: Stripe.Subscription): string | null {
    const raw = sub as unknown as {
        current_period_end?: number;
        items?: { data?: Array<{ current_period_end?: number }> };
    };
    const ts = raw.current_period_end ?? raw.items?.data?.[0]?.current_period_end;
    return ts ? new Date(ts * 1000).toISOString() : null;
}

/** Inicio del período de una suscripción en ISO, robusto entre versiones de la API. */
export function subscriptionPeriodStart(sub: Stripe.Subscription): string | null {
    const raw = sub as unknown as {
        current_period_start?: number;
        items?: { data?: Array<{ current_period_start?: number }> };
    };
    const ts = raw.current_period_start ?? raw.items?.data?.[0]?.current_period_start;
    return ts ? new Date(ts * 1000).toISOString() : null;
}
