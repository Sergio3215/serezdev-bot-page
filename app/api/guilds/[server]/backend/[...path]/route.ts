import { NextRequest, NextResponse } from "next/server";
import { checkGuildAdmin } from "@/lib/guildAccess";
import { BOT_API_BASE, internalApiHeaders } from "@/lib/internalApi";
import { defaultGifUrl } from "@/lib/gifs";
import { PLAN_LIMITS, PLANS } from "@/lib/plans";
import { getServerPlanView } from "@/lib/subscriptions";
import { endpointKey, forwardBody, forwardUrl, isAllowedEndpoint, isSnowflake, LIMITED_RESOURCES, limitCheckFor, ownershipCheckFor, type LimitedResource, type Method } from "@/lib/backendProxy";

type Context = { params: Promise<{ server: string; path: string[] }> };

/**
 * Límite del plan. Crear cuenta el total; activar cuenta solo los activos, así un servidor que
 * bajó de plan conserva los que ya tenía activos pero no puede reactivar hasta quedar por debajo
 * del límite. Si no se puede leer el plan o la cantidad, no deja continuar.
 */
async function planLimitError(
    serverId: string,
    resource: LimitedResource,
    action: "create" | "activate",
    itemId?: string
): Promise<{ error: string; status: number } | null> {
    const config = LIMITED_RESOURCES[resource];
    try {
        const plan = (await getServerPlanView(serverId)).plan;
        const limit = PLAN_LIMITS[plan][config.limit];
        if (limit === null) return null;
        const url = new URL(`${BOT_API_BASE}/${resource}`);
        url.searchParams.set("serverId", serverId);
        const res = await fetch(url, { headers: internalApiHeaders(), cache: "no-store" });
        if (!res.ok) throw new Error(`El backend respondió ${res.status}`);
        const data: { data?: { id?: string; enabled?: boolean }[] } = await res.json();
        const items = Array.isArray(data.data) ? data.data : [];
        if (action === "activate" && items.some((item) => item.id === itemId && item.enabled)) return null;
        const count = action === "create" ? items.length : items.filter((item) => item.enabled).length;
        if (count < limit) return null;
        const error = action === "create"
            ? `El plan ${PLANS[plan].name} permite hasta ${limit} ${config.total}.`
            : `El plan ${PLANS[plan].name} permite hasta ${limit} ${config.active}. Desactivá otro para activar este.`;
        return { error, status: 403 };
    } catch (err) {
        console.error(`[backend proxy] no se pudo verificar el límite de ${config.total}:`, err);
        return { error: `No se pudo verificar el límite de ${config.total} de tu plan.`, status: 502 };
    }
}

/**
 * Editar un GIF: tiene que pertenecer a la interacción indicada de este servidor. Los GIFs por
 * defecto solo se editan con Premium; volver a su URL original se permite en cualquier plan.
 */
async function gifEditError(serverId: string, body: { id?: unknown; url?: unknown; interaction?: unknown }): Promise<{ error: string; status: number } | null> {
    if (typeof body.id !== "string" || typeof body.url !== "string" || typeof body.interaction !== "string") {
        return { error: "Faltan datos del GIF.", status: 400 };
    }
    try {
        const url = new URL(`${BOT_API_BASE}/gif/getInteractionByName`);
        url.searchParams.set("name", body.interaction);
        url.searchParams.set("serverId", serverId);
        const res = await fetch(url, { headers: internalApiHeaders(), cache: "no-store" });
        if (!res.ok) throw new Error(`El backend respondió ${res.status}`);
        const data: { data?: { gifs?: { id: string; order: number; type: string }[] }[] } = await res.json();
        const gif = (data.data ?? []).flatMap((interaction) => interaction.gifs ?? []).find((item) => item.id === body.id);
        if (!gif) return { error: "No se encontró el GIF.", status: 404 };
        if (gif.type !== "default" || body.url === defaultGifUrl(body.interaction, gif.order)) return null;
        const plan = (await getServerPlanView(serverId)).plan;
        if (PLAN_LIMITS[plan].editDefaultGifs) return null;
        return { error: "Editar los GIFs por defecto está disponible en el plan Premium.", status: 403 };
    } catch (err) {
        console.error("[backend proxy] no se pudo verificar el GIF:", err);
        return { error: "No se pudo verificar el GIF.", status: 502 };
    }
}

/** El id tiene que pertenecer a este servidor: el bot no lo verifica en sus operaciones por id. */
async function ownershipError(serverId: string, resource: string, id: string): Promise<{ error: string; status: number } | null> {
    try {
        const url = new URL(`${BOT_API_BASE}/${resource}`);
        url.searchParams.set("serverId", serverId);
        const res = await fetch(url, { headers: internalApiHeaders(), cache: "no-store" });
        if (!res.ok) throw new Error(`El backend respondió ${res.status}`);
        const data: { data?: { id?: string }[] } = await res.json();
        const items = Array.isArray(data.data) ? data.data : [];
        return items.some((item) => item.id === id) ? null : { error: "No se encontró la configuración.", status: 404 };
    } catch (err) {
        console.error(`[backend proxy] no se pudo verificar ${resource}/${id}:`, err);
        return { error: "No se pudo verificar la configuración.", status: 502 };
    }
}

async function proxy(request: NextRequest, { params }: Context, method: Method) {
    const { server: serverId, path } = await params;
    const endpoint = path.join("/");

    if (!isAllowedEndpoint(path, method)) {
        return NextResponse.json({ error: "Endpoint no disponible" }, { status: 404 });
    }
    if (!isSnowflake(serverId)) {
        return NextResponse.json({ error: "Servidor inválido" }, { status: 400 });
    }

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

    const url = forwardUrl(BOT_API_BASE, path, request.nextUrl.searchParams, serverId);

    const headers = internalApiHeaders();
    let body: string | undefined;

    if (method !== "GET") {
        const text = await request.text().catch(() => "");
        let json: unknown = {};
        if (text) {
            try {
                json = JSON.parse(text);
            } catch {
                json = null;
            }
        }
        if (!json || typeof json !== "object" || Array.isArray(json)) {
            return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
        }
        body = JSON.stringify(forwardBody(path, json as Record<string, unknown>, serverId));
        headers["Content-Type"] = "application/json";
    }

    const limitCheck = limitCheckFor(method, path, body);
    if (method === "PUT" && endpointKey(path) === "gif/editGif") {
        const gifError = await gifEditError(serverId, JSON.parse(body ?? "{}"));
        if (gifError) return NextResponse.json({ error: gifError.error, message: gifError.error }, { status: gifError.status });
    }
    const ownership = ownershipCheckFor(path);
    if (ownership) {
        const ownershipFailure = await ownershipError(serverId, ownership.resource, ownership.id);
        if (ownershipFailure) return NextResponse.json({ error: ownershipFailure.error, message: ownershipFailure.error }, { status: ownershipFailure.status });
    }
    if (limitCheck) {
        const limit = await planLimitError(serverId, limitCheck.resource, limitCheck.action, limitCheck.id);
        if (limit) return NextResponse.json({ error: limit.error, message: limit.error }, { status: limit.status });
    }

    let res: Response;
    try {
        res = await fetch(url, { method, headers, body, cache: "no-store" });
    } catch (err) {
        console.error(`[backend proxy] ${method} ${endpoint} falló:`, err);
        return NextResponse.json({ error: "No se pudo conectar con el backend." }, { status: 502 });
    }

    if (res.status === 401) {
        console.error(`[backend proxy] ${method} ${endpoint}: el backend rechazó el secreto interno`);
        return NextResponse.json({ error: "El backend rechazó la petición." }, { status: 502 });
    }

    const responseHeaders: Record<string, string> = { "Content-Type": res.headers.get("content-type") ?? "application/json" };

    return new NextResponse(await res.text(), { status: res.status, headers: responseHeaders });
}

export const GET = (request: NextRequest, context: Context) => proxy(request, context, "GET");
export const POST = (request: NextRequest, context: Context) => proxy(request, context, "POST");
export const PUT = (request: NextRequest, context: Context) => proxy(request, context, "PUT");
export const PATCH = (request: NextRequest, context: Context) => proxy(request, context, "PATCH");
export const DELETE = (request: NextRequest, context: Context) => proxy(request, context, "DELETE");
