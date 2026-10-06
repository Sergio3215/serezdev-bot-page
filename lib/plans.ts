import type { BillingCycle, Currency, PaymentProvider, Plan, PlanId } from "@/types/Billing";
import type { BackgroundType } from "@/lib/card/types";

/**
 * Catálogo comercial de planes: precios, features y límites. Lo aplican la UI, el checkout
 * y el BFF (proxy hacia el bot); bot-serezdev no lo conoce, solo persiste y expone el estado
 * de la suscripción. Ver ARCHITECTURE.md.
 *
 * Los montos van en la unidad principal de cada moneda (USD y ARS). Free no se cobra (price === null).
 */
export const PLANS: Record<PlanId, Plan> = {
    free: {
        id: "free",
        name: "Free",
        tagline: "Lo esencial para empezar",
        price: null,
        rank: 0,
        features: [
            "Interacciones con GIFs (hasta 5 personalizados)",
            "Hasta 4 comandos personalizados",
            "Hasta 3 reglas de canal",
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
            "Tarjetas con fondo degradado",
            "Hasta 10 GIFs personalizados",
            "Hasta 15 comandos personalizados",
            "Hasta 15 reglas de canal",
            "Reinicio del bot bajo demanda",
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
            "Tarjetas con fondo de imagen",
            "GIFs personalizados ilimitados",
            "Editar los GIFs por defecto",
            "Comandos personalizados ilimitados",
            "Reglas de canal ilimitadas",
            "Plantillas exclusivas de tarjetas",
            "Prioridad de soporte",
        ],
    },
};

/** Servidores de Discord con Premium permanente, sin importar su suscripción. */
export const ALWAYS_PREMIUM_SERVER_IDS = ["1235045954491781150"];

/** Servidores que pueden usar degradado e imagen en las tarjetas aunque sean Free. */
export const CARD_BACKGROUND_UNLOCKED_SERVER_IDS = ["748652112485023854"];

/**
 * Límites por plan. `customGifs` es el total de GIFs personalizados del servidor,
 * sumando todas las interacciones; `customCommands`, el total de comandos personalizados
 * creados, activos o no; `channelRules`, lo mismo para las reglas de canal (null = sin límite).
 */
export const PLAN_LIMITS: Record<PlanId, {
    customGifs: number | null;
    customCommands: number | null;
    channelRules: number | null;
    cardBackgrounds: BackgroundType[];
    botRestart: boolean;
    editDefaultGifs: boolean;
}> = {
    free: { customGifs: 5, customCommands: 4, channelRules: 3, cardBackgrounds: ["color"], botRestart: false, editDefaultGifs: false },
    pro: { customGifs: 10, customCommands: 15, channelRules: 15, cardBackgrounds: ["color", "gradient"], botRestart: true, editDefaultGifs: false },
    premium: { customGifs: null, customCommands: null, channelRules: null, cardBackgrounds: ["color", "gradient", "image"], botRestart: true, editDefaultGifs: true },
};

/** Servidores que pueden reiniciar el bot aunque sean Free. */
export const BOT_RESTART_SERVER_IDS = ["748652112485023854"];

export function canRestartBot(plan: PlanId, serverId: string): boolean {
    return PLAN_LIMITS[plan].botRestart || BOT_RESTART_SERVER_IDS.includes(serverId);
}

export function allowedCardBackgrounds(plan: PlanId, serverId: string): BackgroundType[] {
    if (CARD_BACKGROUND_UNLOCKED_SERVER_IDS.includes(serverId)) return ["color", "gradient", "image"];
    return PLAN_LIMITS[plan].cardBackgrounds;
}

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
