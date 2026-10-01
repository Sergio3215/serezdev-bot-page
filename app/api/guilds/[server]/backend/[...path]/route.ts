import { NextRequest, NextResponse } from "next/server";
import { checkGuildAdmin } from "@/lib/guildAccess";
import { BOT_API_BASE, internalApiHeaders } from "@/lib/internalApi";

type Method = "GET" | "POST" | "PUT" | "DELETE";
type Context = { params: Promise<{ server: string; path: string[] }> };

/** Endpoints del backend que el panel puede usar. El resto (sync, suscripciones, borrados masivos) no se expone. */
const ALLOWED_ENDPOINTS: Record<string, readonly Method[]> = {
    "gif/getInteractions": ["GET"],
    "gif/getInteractionByName": ["GET"],
    "gif/addGif": ["POST"],
    "gif/editGif": ["PUT"],
    "gif/deleteGif": ["DELETE"],
    "birthday/setup": ["GET", "PUT"],
    "birthday/setup-card": ["GET", "POST", "PUT"],
    "joinServer/setup": ["GET", "POST", "PUT"],
    "joinServer/setup-card": ["GET", "POST", "PUT"],
};

const SNOWFLAKE_PATTERN = /^\d{17,20}$/;

async function proxy(request: NextRequest, { params }: Context, method: Method) {
    const { server: serverId, path } = await params;
    const endpoint = path.join("/");

    if (!ALLOWED_ENDPOINTS[endpoint]?.includes(method)) {
        return NextResponse.json({ error: "Endpoint no disponible" }, { status: 404 });
    }
    if (!SNOWFLAKE_PATTERN.test(serverId)) {
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

    const url = new URL(`${BOT_API_BASE}/${endpoint}`);
    request.nextUrl.searchParams.forEach((value, key) => url.searchParams.append(key, value));
    url.searchParams.set("serverId", serverId);

    const headers = internalApiHeaders();
    let body: string | undefined;

    if (method !== "GET") {
        const json = await request.json().catch(() => null);
        if (!json || typeof json !== "object" || Array.isArray(json)) {
            return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
        }
        body = JSON.stringify({ ...json, serverId });
        headers["Content-Type"] = "application/json";
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

    return new NextResponse(await res.text(), {
        status: res.status,
        headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
    });
}

export const GET = (request: NextRequest, context: Context) => proxy(request, context, "GET");
export const POST = (request: NextRequest, context: Context) => proxy(request, context, "POST");
export const PUT = (request: NextRequest, context: Context) => proxy(request, context, "PUT");
export const DELETE = (request: NextRequest, context: Context) => proxy(request, context, "DELETE");
