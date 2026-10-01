import { NextRequest, NextResponse } from "next/server";
import { checkGuildAdmin } from "@/lib/guildAccess";

interface DiscordApiMember {
  nick: string | null;
  avatar: string | null;
  user: { id: string; username: string; global_name: string | null; avatar: string | null; bot?: boolean };
}

const MAX_RESULTS = 10;
const SNOWFLAKE_PATTERN = /^\d{17,20}$/;

function toMember(member: DiscordApiMember) {
  return {
    id: member.user.id,
    name: member.nick ?? member.user.global_name ?? member.user.username,
    username: member.user.username,
    avatar: member.user.avatar,
    bot: member.user.bot ?? false,
  };
}

/**
 * GET /api/guilds/[server]/members?query=texto → hasta 10 miembros cuyo nombre empieza con el texto.
 * GET /api/guilds/[server]/members?id=snowflake → un miembro puntual (para mostrar el nombre de uno ya elegido).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ server: string }> }
) {
  const { server: guildId } = await params;

  const token = request.cookies.get("discord_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const botToken = process.env.DISCORD_BOT_TOKEN?.trim();
  if (!botToken) {
    return NextResponse.json({ error: "Falta DISCORD_BOT_TOKEN en el servidor" }, { status: 500 });
  }

  const access = await checkGuildAdmin(token, guildId);
  if (access.status === "unauthenticated") {
    return NextResponse.json({ error: "Tu sesión de Discord expiró. Volvé a iniciar sesión.", needsReauth: true }, { status: 401 });
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

  const id = request.nextUrl.searchParams.get("id");
  const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";
  const headers = { Authorization: `Bot ${botToken}` };

  try {
    if (id) {
      if (!SNOWFLAKE_PATTERN.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
      const res = await fetch(`https://discord.com/api/guilds/${guildId}/members/${id}`, { headers, cache: "no-store" });
      if (res.status === 404) return NextResponse.json({ members: [] });
      if (!res.ok) return NextResponse.json({ error: "No se pudo obtener el miembro" }, { status: res.status });
      return NextResponse.json({ members: [toMember(await res.json())] });
    }

    if (query.length === 0 || query.length > 100) return NextResponse.json({ members: [] });
    const url = `https://discord.com/api/guilds/${guildId}/members/search?query=${encodeURIComponent(query)}&limit=${MAX_RESULTS}`;
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: res.status === 429 ? "Discord limitó las búsquedas. Probá en unos segundos." : "No se pudieron buscar miembros" },
        { status: res.status }
      );
    }
    const members: DiscordApiMember[] = await res.json();
    return NextResponse.json({ members: members.map(toMember) });
  } catch (error) {
    console.error("Error en /api/guilds/[server]/members:", error);
    return NextResponse.json({ error: "Error interno al buscar miembros" }, { status: 500 });
  }
}
