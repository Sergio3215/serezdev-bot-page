import type { BillingCycle, Currency, PaymentProvider, Plan, PlanId } from "@/types/Billing";

/**
 * Catálogo de planes. Es la única fuente de verdad de precios y features: la UI, el
 * checkout y (a futuro) el bot leen de acá. Los montos van en la unidad principal
 * de cada moneda (USD y ARS); Stripe cobra en centavos, así que el helper de abajo
 * multiplica ×100 cuando hace falta.
 *
 * Ajustá los precios reales acá. Free no se cobra (price === null).
 */
export const PLANS: Record<PlanId, Plan> = {
    free: {
        id: "free",
        name: "Free",
        tagline: "Lo esencial para empezar",
        price: null,
        rank: 0,
        features: [
            "Interacciones con GIFs",
            "Recordatorio de cumpleaños",
            "Bienvenida con rol automático",
        ],
    },
    pro: {
        id: "pro",
        name: "Pro",
        tagline: "Para comunidades que crecen",
        price: {
            usd: { monthly: 3.99, onetime: 9.99 },
            ars: { monthly: 3000, onetime: 5000 },
        },
        rank: 1,
        features: [
            "Todo lo de Free",
            "Tarjeta de bienvenida con imagen",
            "Tarjeta de cumpleaños con imagen",
            "GIFs personalizados ilimitados",
        ],
    },
    premium: {
        id: "premium",
        name: "Premium",
        tagline: "Todo, sin límites",
        price: {
            usd: { monthly: 7.99, onetime: 15.99 },
            ars: { monthly: 8000, onetime: 10000 },
        },
        rank: 2,
        features: [
            "Todo lo de Pro",
            "Plantillas exclusivas de tarjetas",
            "Prioridad de soporte",
            "Reinicio del bot bajo demanda",
        ],
    },
};

/** GIFs personalizados que puede tener un servidor Free, sumando todas las interacciones. */
export const FREE_CUSTOM_GIF_LIMIT = 5;

/** En orden de presentación. */
export const PLAN_LIST: Plan[] = [PLANS.free, PLANS.pro, PLANS.premium];

export function getPlan(id: string): Plan | null {
    return (PLANS as Record<string, Plan>)[id] ?? null;
}

export function isPaidPlan(id: PlanId): boolean {
    return PLANS[id].rank > 0;
}

/** Moneda según el proveedor: MercadoPago cobra en ARS, el resto en USD. */
export function currencyForProvider(provider: PaymentProvider): Currency {
    return provider === "mercadopago" ? "ars" : "usd";
}

/**
 * Monto a cobrar para un plan pago, en la unidad principal de la moneda.
 * Devuelve null si el plan no se cobra (free) o no tiene ese precio.
 */
export function amountFor(planId: PlanId, currency: Currency, cycle: BillingCycle): number | null {
    const plan = PLANS[planId];
    if (!plan.price) return null;
    return plan.price[currency][cycle];
}
