import { NextRequest, NextResponse } from "next/server";
import { checkGuildAdmin } from "@/lib/guildAccess";
import { getPlan, isPaidPlan } from "@/lib/plans";
import { createMercadoPagoCheckout } from "@/lib/payments/mercadopago";
import { createLemonSqueezyCheckout } from "@/lib/payments/lemonsqueezy";
import type { BillingCycle, PaymentProvider, PlanId } from "@/types/Billing";

const PROVIDERS: PaymentProvider[] = ["lemonsqueezy", "mercadopago"];
const CYCLES: BillingCycle[] = ["monthly", "onetime"];

/** Id de Discord de quien paga, para registro. La cookie no es fuente de autorización. */
function readUserId(request: NextRequest): string | null {
    const raw = request.cookies.get("discord_user")?.value;
    if (!raw) return null;
    try {
        return JSON.parse(raw).id ?? null;
    } catch {
        return null;
    }
}

export async function POST(request: NextRequest) {
    // 1. Sesión: el token httpOnly es la única fuente de autorización.
    const token = request.cookies.get("discord_token")?.value;
    if (!token) {
        return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    let body: {
        provider?: string;
        plan?: string;
        cycle?: string;
        serverId?: string;
        email?: string;
    };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
    }

    const { provider, plan, cycle, serverId, email } = body;

    // 2. Validar entradas.
    if (!serverId) {
        return NextResponse.json({ error: "Falta serverId" }, { status: 400 });
    }
    if (!provider || !PROVIDERS.includes(provider as PaymentProvider)) {
        return NextResponse.json({ error: "Proveedor inválido" }, { status: 400 });
    }
    if (!cycle || !CYCLES.includes(cycle as BillingCycle)) {
        return NextResponse.json({ error: "Modalidad inválida" }, { status: 400 });
    }
    const planDef = plan ? getPlan(plan) : null;
    if (!planDef || !isPaidPlan(planDef.id)) {
        return NextResponse.json({ error: "Plan inválido (no se puede comprar Free)" }, { status: 400 });
    }

    // 3. Autorización: solo un admin del servidor puede comprar su plan.
    const access = await checkGuildAdmin(token, serverId);
    if (access.status === "unauthenticated") {
        return NextResponse.json({ error: "Tu sesión expiró. Volvé a iniciar sesión.", needsReauth: true }, { status: 401 });
    }
    if (access.status === "denied") {
        return NextResponse.json({ error: "No administrás este servidor" }, { status: 403 });
    }
    if (access.status === "unknown") {
        return NextResponse.json(
            { error: "No se pudieron verificar tus permisos. Probá de nuevo en unos segundos." },
            { status: access.httpStatus === 429 ? 429 : 502 }
        );
    }

    const userId = readUserId(request) ?? "";
    const origin = request.headers.get("origin") ?? new URL(request.url).origin;
    const planId = planDef.id as PlanId;
    const billingCycle = cycle as BillingCycle;
    const paymentProvider = provider as PaymentProvider;

    try {
        const { url } =
            paymentProvider === "lemonsqueezy"
                ? await createLemonSqueezyCheckout({ plan: planId, cycle: billingCycle, serverId, userId, origin })
                : await createMercadoPagoCheckout({ plan: planId, cycle: billingCycle, serverId, userId, origin, email });
        return NextResponse.json({ url });
    } catch (err) {
        console.error("Error al crear el checkout:", err);
        const message = err instanceof Error ? err.message : "Error al crear el checkout";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
