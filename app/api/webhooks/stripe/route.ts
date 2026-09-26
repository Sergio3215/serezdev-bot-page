import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import {
    constructStripeEvent,
    getStripe,
    subscriptionPeriodEnd,
    subscriptionPeriodStart,
} from "@/lib/payments/stripe";
import { upsertSubscription } from "@/lib/subscriptions";
import type { Currency, PaymentInput, PlanId, SubscriptionStatus } from "@/types/Billing";

/** Estado de Stripe → nuestro estado (code de SubscriptionStatus). */
function mapStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
    if (stripeStatus === "active" || stripeStatus === "trialing") return "active";
    if (stripeStatus === "canceled" || stripeStatus === "incomplete_expired") return "canceled";
    if (stripeStatus === "unpaid" || stripeStatus === "past_due") return "expired";
    return "pending";
}

/** Arma el objeto payment (montos en centavos → unidad principal). */
function buildPayment(
    amountCents: number | null | undefined,
    currency: string | null | undefined,
    userId: string | null | undefined,
    reference: string | null | undefined
): PaymentInput | undefined {
    if (amountCents == null) return undefined;
    return {
        provider: "stripe",
        payerUserId: userId || null,
        amount: amountCents / 100,
        currency: (currency as Currency) ?? null,
        reference: reference ?? null,
    };
}

/** Guarda el estado de una suscripción de Stripe (+ payment opcional). */
async function syncSubscription(sub: Stripe.Subscription, payment?: PaymentInput) {
    const meta = sub.metadata ?? {};
    const serverId = meta.serverId;
    if (!serverId) return;

    await upsertSubscription(serverId, {
        tier: (meta.plan as PlanId) || "pro",
        status: mapStatus(sub.status),
        currentPeriodStart: subscriptionPeriodStart(sub),
        currentPeriodEnd: subscriptionPeriodEnd(sub),
        payment,
    });
}

export async function POST(request: NextRequest) {
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
        return NextResponse.json({ error: "Falta la firma" }, { status: 400 });
    }

    // Stripe firma el cuerpo crudo: hay que leerlo como texto, sin parsear.
    const rawBody = await request.text();

    let event: Stripe.Event;
    try {
        event = constructStripeEvent(rawBody, signature);
    } catch (err) {
        console.error("Firma de webhook de Stripe inválida:", err);
        return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
    }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                const meta = session.metadata ?? {};
                const serverId = session.client_reference_id ?? meta.serverId;
                if (!serverId) break;

                const payment = buildPayment(session.amount_total, session.currency, meta.userId, session.id);

                if (session.mode === "subscription" && session.subscription) {
                    const subId =
                        typeof session.subscription === "string"
                            ? session.subscription
                            : session.subscription.id;
                    const sub = await getStripe().subscriptions.retrieve(subId);
                    await syncSubscription(sub, payment);
                } else {
                    // Pago único: no vence.
                    await upsertSubscription(serverId, {
                        tier: (meta.plan as PlanId) || "pro",
                        status: "active",
                        currentPeriodStart: null,
                        currentPeriodEnd: null,
                        payment,
                    });
                }
                break;
            }

            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
                await syncSubscription(event.data.object as Stripe.Subscription);
                break;
            }

            case "invoice.paid": {
                // Renovación mensual: refrescar período y registrar el cobro.
                const invoice = event.data.object as Stripe.Invoice;
                const raw = invoice as unknown as { subscription?: string | { id: string } };
                const subId = typeof raw.subscription === "string" ? raw.subscription : raw.subscription?.id;
                if (subId) {
                    const sub = await getStripe().subscriptions.retrieve(subId);
                    const payment = buildPayment(
                        invoice.amount_paid,
                        invoice.currency,
                        sub.metadata?.userId,
                        invoice.id
                    );
                    await syncSubscription(sub, payment);
                }
                break;
            }

            default:
                break;
        }
    } catch (err) {
        console.error(`Error procesando el webhook de Stripe (${event.type}):`, err);
        // 500 hace que Stripe reintente, que es lo que queremos ante un fallo transitorio.
        return NextResponse.json({ error: "Error al procesar el evento" }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}
