/**
 * Modelo de pagos y planes (lado panel).
 *
 * El backend guarda esto en MongoDB con un schema normalizado (Prisma): `Tier`,
 * `SubscriptionStatus` y `PaymentProvider` son tablas con `code`, y `Payment` es una
 * tabla aparte ligada a `Subscription`. Del lado del panel usamos esos `code`
 * directamente:
 *   - PlanId          ↔ Tier.code            ("free" | "pro" | "premium")
 *   - SubscriptionStatus ↔ SubscriptionStatus.code
 *   - PaymentProvider ↔ PaymentProvider.code ("stripe" | "mercadopago" | "lemonsqueezy")
 *
 * `billing` (mensual / 1 mes sin renovación) NO se persiste: el schema no lo tiene.
 * Ambos dan acceso hasta `currentPeriodEnd`; vive solo como dato de UI/checkout.
 */

export type PlanId = "free" | "pro" | "premium";          // Tier.code
export type BillingCycle = "monthly" | "onetime";         // solo UI/checkout
export type PaymentProvider = "stripe" | "mercadopago" | "lemonsqueezy"; // PaymentProvider.code
export type Currency = "usd" | "ars";
export type SubscriptionStatus = "active" | "pending" | "canceled" | "expired"; // SubscriptionStatus.code

/** Monto por modalidad, en la unidad principal de la moneda (USD o ARS, no centavos). */
export interface PlanPrice {
    monthly: number;
    onetime: number;
}

export interface Plan {
    id: PlanId;
    name: string;
    tagline: string;
    /** null en Free (no se cobra). */
    price: { usd: PlanPrice; ars: PlanPrice } | null;
    features: string[];
    /** Orden jerárquico: free < pro < premium. */
    rank: number;
}

/** Estado que devuelve el backend (Subscription aplanada: tier/status por code). */
export interface SubscriptionState {
    serverId: string;
    tier: PlanId;
    status: SubscriptionStatus;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
}

/** Datos de un cobro concreto, para que el backend cree un registro `Payment`. */
export interface PaymentInput {
    provider: PaymentProvider;
    payerUserId?: string | null;
    amount?: number | null;
    currency?: Currency | null;
    /** Id externo del pago/sesión (Stripe session/invoice, payment de MP). */
    reference?: string | null;
}

/** Cuerpo del upsert que el panel manda al backend. */
export interface SubscriptionUpsert {
    tier: PlanId;
    status: SubscriptionStatus;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    /** Presente solo cuando hubo un cobro confirmado. */
    payment?: PaymentInput;
}

/** Vista recortada para el cliente. */
export interface SubscriptionView {
    serverId: string;
    plan: PlanId;
    status: SubscriptionStatus;
    currentPeriodEnd: string | null;
}
