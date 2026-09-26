import { NextRequest, NextResponse } from "next/server";
import {
    decodeReference,
    getMercadoPagoPayment,
    getMercadoPagoPreApproval,
    verifyMercadoPagoSignature,
} from "@/lib/payments/mercadopago";
import { getSubscription, inOneMonth, upsertSubscription } from "@/lib/subscriptions";

export async function POST(request: NextRequest) {
    const url = new URL(request.url);

    let body: { type?: string; topic?: string; action?: string; data?: { id?: string } } = {};
    try {
        body = await request.json();
    } catch {
        /* MercadoPago a veces notifica solo por query params */
    }

    const type = body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
    const dataId = body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id");

    // 1. Verificar la firma antes de tocar nada.
    const valid = verifyMercadoPagoSignature({
        signature: request.headers.get("x-signature"),
        requestId: request.headers.get("x-request-id"),
        dataId,
    });
    if (!valid) {
        return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
    }

    if (!dataId) {
        return NextResponse.json({ received: true }); // nada que procesar
    }

    try {
        // 2a. Suscripción (preapproval): alta, baja o pausa. Sin cobro puntual acá.
        if (type === "subscription_preapproval" || type === "preapproval") {
            const pre = await getMercadoPagoPreApproval(dataId);
            const ref = decodeReference(pre.external_reference);
            if (!ref) return NextResponse.json({ received: true });

            const status = pre.status; // authorized | paused | cancelled | pending
            if (status !== "authorized" && status !== "cancelled" && status !== "paused") {
                return NextResponse.json({ received: true });
            }

            if (status === "authorized") {
                const nextPayment = (pre as unknown as { next_payment_date?: string }).next_payment_date;
                await upsertSubscription(ref.serverId, {
                    tier: ref.plan,
                    status: "active",
                    currentPeriodStart: new Date().toISOString(),
                    currentPeriodEnd: nextPayment || inOneMonth(),
                });
                return NextResponse.json({ received: true });
            }

            // Baja o pausa: conserva el acceso hasta el fin del período ya pagado.
            const current = await getSubscription(ref.serverId);
            const paidUntil = current?.currentPeriodEnd;
            const stillPaid = paidUntil && new Date(paidUntil).getTime() > Date.now();

            await upsertSubscription(ref.serverId, {
                tier: ref.plan,
                status: stillPaid ? "active" : "canceled",
                currentPeriodStart: current?.currentPeriodStart ?? null,
                currentPeriodEnd: paidUntil ?? null,
            });

            return NextResponse.json({ received: true });
        }

        // 2b. Pago de 1 mes, o cobro recurrente de una suscripción.
        if (type === "payment" || type === "payment.created" || type === "payment.updated") {
            const payment = await getMercadoPagoPayment(dataId);
            const ref = decodeReference(payment.external_reference);
            if (!ref) return NextResponse.json({ received: true });

            if (payment.status === "approved") {
                await upsertSubscription(ref.serverId, {
                    tier: ref.plan,
                    status: "active",
                    currentPeriodStart: new Date().toISOString(),
                    currentPeriodEnd: inOneMonth(),
                    payment: {
                        provider: "mercadopago",
                        payerUserId: ref.userId || null,
                        amount: payment.transaction_amount ?? null,
                        currency: "ars",
                        reference: String(payment.id ?? dataId),
                    },
                });
            }

            return NextResponse.json({ received: true });
        }

        return NextResponse.json({ received: true });
    } catch (err) {
        console.error("Error procesando el webhook de MercadoPago:", err);
        return NextResponse.json({ error: "Error al procesar el evento" }, { status: 500 });
    }
}
