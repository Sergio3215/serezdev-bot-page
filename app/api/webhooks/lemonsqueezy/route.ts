import { NextRequest, NextResponse } from "next/server";
import {
    getLemonSqueezySubscription,
    planFromVariant,
    verifyLemonSqueezySignature,
    type LsCustomData,
    type LsSubscriptionAttributes,
} from "@/lib/payments/lemonsqueezy";
import { getPlan, isPaidPlan } from "@/lib/plans";
import { inOneMonth, upsertSubscription } from "@/lib/subscriptions";
import type { Currency, PaymentInput, PlanId, SubscriptionUpsert } from "@/types/Billing";

interface LsWebhook {
    meta: {
        event_name: string;
        custom_data?: Partial<LsCustomData>;
    };
    data: {
        id: string;
        type: string;
        attributes: Record<string, unknown>;
    };
}

function buildPayment(
    totalCents: unknown,
    currency: unknown,
    userId: string | undefined,
    reference: string
): PaymentInput {
    return {
        provider: "lemonsqueezy",
        payerUserId: userId || null,
        amount: typeof totalCents === "number" ? totalCents / 100 : null,
        currency: typeof currency === "string" ? (currency.toLowerCase() as Currency) : null,
        reference,
    };
}

/**
 * Un plan cancelado conserva el acceso hasta `ends_at`: se guarda como "active"
 * con ese vencimiento y `resolveActivePlan` lo baja a Free cuando pasa la fecha.
 */
function subscriptionState(
    tier: PlanId,
    sub: LsSubscriptionAttributes,
    payment?: PaymentInput
): SubscriptionUpsert {
    switch (sub.status) {
        case "on_trial":
        case "active":
        case "past_due":
            return { tier, status: "active", currentPeriodStart: sub.created_at, currentPeriodEnd: sub.renews_at, payment };
        case "cancelled":
            return { tier, status: "active", currentPeriodStart: sub.created_at, currentPeriodEnd: sub.ends_at, payment };
        default:
            return { tier, status: "expired", currentPeriodStart: sub.created_at, currentPeriodEnd: sub.ends_at ?? sub.renews_at };
    }
}

export async function POST(request: NextRequest) {
    const rawBody = await request.text();

    if (!verifyLemonSqueezySignature(rawBody, request.headers.get("x-signature"))) {
        return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
    }

    let event: LsWebhook;
    try {
        event = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
    }

    const eventName = event.meta?.event_name;
    const custom = event.meta?.custom_data ?? {};
    const serverId = custom.server_id;
    const attrs = event.data?.attributes ?? {};

    if (!serverId) {
        return NextResponse.json({ received: true });
    }

    const tierFrom = (variantId: unknown): PlanId | null => {
        const plan = planFromVariant(variantId as string | number) ?? getPlan(custom.plan ?? "")?.id ?? null;
        return plan && isPaidPlan(plan) ? plan : null;
    };

    try {
        switch (eventName) {
            case "order_created":
            case "order_refunded": {
                if (custom.cycle !== "onetime") break;
                const item = attrs.first_order_item as { variant_id?: number } | undefined;
                const tier = tierFrom(item?.variant_id);
                if (!tier) break;

                if (eventName === "order_refunded") {
                    await upsertSubscription(serverId, { tier, status: "canceled" });
                } else if (attrs.status === "paid") {
                    await upsertSubscription(serverId, {
                        tier,
                        status: "active",
                        currentPeriodStart: new Date().toISOString(),
                        currentPeriodEnd: inOneMonth(),
                        payment: buildPayment(attrs.total, attrs.currency, custom.user_id, `order_${event.data.id}`),
                    });
                }
                break;
            }

            case "subscription_created":
            case "subscription_updated":
            case "subscription_cancelled":
            case "subscription_resumed":
            case "subscription_expired":
            case "subscription_paused":
            case "subscription_unpaused": {
                const sub = attrs as unknown as LsSubscriptionAttributes;
                const tier = tierFrom(sub.variant_id);
                if (!tier) break;
                await upsertSubscription(serverId, subscriptionState(tier, sub));
                break;
            }

            case "subscription_payment_success": {
                const subId = attrs.subscription_id as number | undefined;
                if (!subId) break;
                const sub = await getLemonSqueezySubscription(subId);
                const tier = tierFrom(sub.variant_id);
                if (!tier) break;
                const payment = buildPayment(attrs.total, attrs.currency, custom.user_id, `invoice_${event.data.id}`);
                await upsertSubscription(serverId, subscriptionState(tier, sub, payment));
                break;
            }

            default:
                break;
        }
    } catch (err) {
        console.error(`Error procesando el webhook de Lemon Squeezy (${eventName}):`, err);
        return NextResponse.json({ error: "Error al procesar el evento" }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}
