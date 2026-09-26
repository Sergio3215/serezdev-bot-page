import crypto from "node:crypto";
import { MercadoPagoConfig, PreApproval, Payment, Preference } from "mercadopago";
import { amountFor, getPlan } from "@/lib/plans";
import type { BillingCycle, PlanId } from "@/types/Billing";

let config: MercadoPagoConfig | null = null;

/** Cliente de MercadoPago. Lanza si falta el access token. */
export function getMP(): MercadoPagoConfig {
    if (!config) {
        const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        if (!accessToken) throw new Error("Falta MERCADOPAGO_ACCESS_TOKEN en el servidor.");
        config = new MercadoPagoConfig({ accessToken });
    }
    return config;
}

/** Lo que viaja en external_reference, para reconstruir el pago en el webhook. */
export interface MpReference {
    serverId: string;
    plan: PlanId;
    cycle: BillingCycle;
    userId: string;
}

export function encodeReference(ref: MpReference): string {
    return JSON.stringify(ref);
}

export function decodeReference(raw: string | null | undefined): MpReference | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.serverId && parsed.plan && parsed.cycle) return parsed as MpReference;
    } catch {
        /* referencia inválida */
    }
    return null;
}

export interface CheckoutParams {
    plan: PlanId;
    cycle: BillingCycle;
    serverId: string;
    userId: string;
    origin: string;
    /** Requerido para suscripciones (preapproval); opcional para el pago de 1 mes. */
    email?: string;
}

/**
 * Crea el checkout de MercadoPago y devuelve la URL (`init_point`).
 *
 * - 1 mes   → Preference (checkout normal, sin renovación).
 * - mensual → PreApproval (suscripción). MercadoPago **exige** el email del pagador.
 */
export async function createMercadoPagoCheckout({
    plan,
    cycle,
    serverId,
    userId,
    origin,
    email,
}: CheckoutParams): Promise<{ url: string }> {
    const planDef = getPlan(plan);
    const amount = amountFor(plan, "ars", cycle);
    if (!planDef || amount == null) throw new Error(`Plan inválido o sin precio: ${plan}`);

    const client = getMP();
    const externalReference = encodeReference({ serverId, plan, cycle, userId });
    const notificationUrl = `${origin}/api/webhooks/mercadopago`;
    const backUrl = `${origin}/dashboard/${serverId}?checkout=success`;

    if (cycle === "monthly") {
        if (!email) {
            throw new Error("MercadoPago requiere el email del pagador para suscripciones.");
        }
        const res = await new PreApproval(client).create({
            body: {
                reason: `Serez Dev Bot — ${planDef.name} (mensual) · servidor ${serverId}`,
                external_reference: externalReference,
                payer_email: email,
                back_url: backUrl,
                auto_recurring: {
                    frequency: 1,
                    frequency_type: "months",
                    transaction_amount: amount,
                    currency_id: "ARS",
                },
                status: "pending",
            },
        });
        if (!res.init_point) throw new Error("MercadoPago no devolvió init_point (preapproval).");
        return { url: res.init_point };
    }

    const res = await new Preference(client).create({
        body: {
            items: [
                {
                    id: `${plan}-onetime`,
                    title: `Serez Dev Bot — ${planDef.name} (1 mes, sin renovación)`,
                    quantity: 1,
                    unit_price: amount,
                    currency_id: "ARS",
                },
            ],
            metadata: { serverId, plan, cycle, userId, provider: "mercadopago" },
            external_reference: externalReference,
            notification_url: notificationUrl,
            back_urls: {
                success: backUrl,
                pending: backUrl,
                failure: `${origin}/dashboard/${serverId}?checkout=cancel`,
            },
            auto_return: "approved",
        },
    });

    const url = res.init_point ?? res.sandbox_init_point;
    if (!url) throw new Error("MercadoPago no devolvió init_point (preference).");
    return { url };
}

/** Trae un pago por id (para confirmar el estado desde el webhook). */
export async function getMercadoPagoPayment(id: string) {
    return new Payment(getMP()).get({ id });
}

/** Trae una suscripción (preapproval) por id. */
export async function getMercadoPagoPreApproval(id: string) {
    return new PreApproval(getMP()).get({ id });
}

/**
 * Valida la firma del webhook de MercadoPago.
 *
 * MP manda `x-signature: ts=<ts>,v1=<hash>` y `x-request-id`. El manifest es
 * `id:<dataId>;request-id:<reqId>;ts:<ts>;` y `v1` es su HMAC-SHA256 con el secreto.
 * Si no hay secreto configurado, no bloquea (devuelve true) pero conviene setearlo.
 */
export function verifyMercadoPagoSignature(params: {
    signature: string | null;
    requestId: string | null;
    dataId: string | null;
}): boolean {
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    if (!secret) return true; // sin secreto no se puede validar; el token de acceso sigue protegiendo la consulta

    const { signature, requestId, dataId } = params;
    if (!signature || !dataId) return false;

    const parts = Object.fromEntries(
        signature.split(",").map((kv) => kv.split("=").map((s) => s.trim()) as [string, string])
    );
    const ts = parts["ts"];
    const v1 = parts["v1"];
    if (!ts || !v1) return false;

    // El id alfanumérico va en minúsculas en el manifest.
    const id = /^[a-zA-Z0-9]+$/.test(dataId) ? dataId.toLowerCase() : dataId;
    const manifest = `id:${id};request-id:${requestId ?? ""};ts:${ts};`;
    const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

    try {
        return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
    } catch {
        return false;
    }
}
