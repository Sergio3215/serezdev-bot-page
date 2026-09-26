import { NextRequest, NextResponse } from "next/server";
import { checkGuildAdmin } from "@/lib/guildAccess";
import { getServerPlanView } from "@/lib/subscriptions";

/** GET /api/billing/[server] — plan vigente del servidor (para la UI). */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ server: string }> }
) {
    const { server: serverId } = await params;

    const token = request.cookies.get("discord_token")?.value;
    if (!token) {
        return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const access = await checkGuildAdmin(token, serverId);
    if (access.status === "unauthenticated") {
        return NextResponse.json({ error: "Tu sesión expiró.", needsReauth: true }, { status: 401 });
    }
    if (access.status === "denied") {
        return NextResponse.json({ error: "No administrás este servidor" }, { status: 403 });
    }
    if (access.status === "unknown") {
        return NextResponse.json(
            { error: "No se pudieron verificar tus permisos." },
            { status: access.httpStatus === 429 ? 429 : 502 }
        );
    }

    try {
        return NextResponse.json({ subscription: await getServerPlanView(serverId) });
    } catch (err) {
        console.error("Error al leer la suscripción:", err);
        return NextResponse.json(
            { error: "No se pudo leer el estado del plan." },
            { status: 500 }
        );
    }
}
