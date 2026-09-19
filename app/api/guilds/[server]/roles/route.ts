import { NextRequest, NextResponse } from "next/server";
import { checkGuildAdmin } from "@/lib/guildAccess";

interface DiscordApiRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ server: string }> }
) {
  const { server: guildId } = await params;

  const tokenCookie = request.cookies.get("discord_token");
  if (!tokenCookie || !tokenCookie.value) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken || botToken.trim() === "") {
    return NextResponse.json(
      { error: "Falta DISCORD_BOT_TOKEN en el servidor" },
      { status: 500 }
    );
  }

  try {
    // 1. Verificar que quien pide sea administrador de ESE servidor
    const access = await checkGuildAdmin(tokenCookie.value, guildId);

    if (access.status === "unauthenticated") {
      return NextResponse.json(
        { error: "Tu sesión de Discord expiró. Volvé a iniciar sesión.", needsReauth: true },
        { status: 401 }
      );
    }

    if (access.status === "denied") {
      return NextResponse.json(
        { error: "No administrás este servidor" },
        { status: 403 }
      );
    }

    if (access.status === "unknown") {
      return NextResponse.json(
        {
          error:
            access.httpStatus === 429
              ? "Discord limitó las peticiones. Probá de nuevo en unos segundos."
              : `No se pudieron verificar tus permisos (Discord respondió ${access.httpStatus}).`,
        },
        { status: access.httpStatus === 429 ? 429 : 502 }
      );
    }

    // 2. Roles del servidor, con el token del bot
    const rolesRes = await fetch(`https://discord.com/api/guilds/${guildId}/roles`, {
      headers: { Authorization: `Bot ${botToken.trim()}` },
      cache: "no-store",
    });

    if (!rolesRes.ok) {
      return NextResponse.json(
        { error: "No se pudieron obtener los roles del servidor" },
        { status: rolesRes.status }
      );
    }

    const allRoles: DiscordApiRole[] = await rolesRes.json();

    // 3. Rol más alto del bot: solo puede asignar roles por debajo del suyo.
    //    Si no se puede averiguar, no marcamos ninguno como no asignable.
    let botHighestPosition = Number.POSITIVE_INFINITY;
    const botId =
      process.env.DISCORD_CLIENT_ID || process.env.NEXT_PUBLIC_DISCORD_CLIENTID;

    if (botId) {
      try {
        const memberRes = await fetch(
          `https://discord.com/api/guilds/${guildId}/members/${botId}`,
          {
            headers: { Authorization: `Bot ${botToken.trim()}` },
            cache: "no-store",
          }
        );

        if (memberRes.ok) {
          const botMember: { roles: string[] } = await memberRes.json();
          const positions = allRoles
            .filter((r) => botMember.roles.includes(r.id))
            .map((r) => r.position);
          botHighestPosition = positions.length > 0 ? Math.max(...positions) : 0;
        }
      } catch (hierarchyErr) {
        console.error("No se pudo calcular la jerarquía del bot:", hierarchyErr);
      }
    }

    const roles = allRoles
      .filter((r) => r.id !== guildId) // @everyone
      .filter((r) => !r.managed) // roles de bots, integraciones y booster
      .sort((a, b) => b.position - a.position)
      .map((r) => ({
        id: r.id,
        name: r.name,
        color: r.color ? `#${r.color.toString(16).padStart(6, "0")}` : "#99AAB5",
        position: r.position,
        assignable: r.position < botHighestPosition,
      }));

    return NextResponse.json({ roles });
  } catch (error) {
    console.error("Error en /api/guilds/[server]/roles:", error);
    return NextResponse.json(
      { error: "Error interno al obtener los roles" },
      { status: 500 }
    );
  }
}
