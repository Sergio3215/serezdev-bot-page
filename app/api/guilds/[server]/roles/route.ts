import { NextRequest, NextResponse } from "next/server";

interface DiscordApiRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
}

const ADMINISTRATOR = BigInt(0x8);
const MANAGE_GUILD = BigInt(0x20);

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
    const userGuildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${tokenCookie.value}` },
      cache: "no-store",
    });

    if (!userGuildsRes.ok) {
      const detail = await userGuildsRes.text().catch(() => "");
      console.error(
        `[roles] /users/@me/guilds respondió ${userGuildsRes.status}:`,
        detail
      );

      if (userGuildsRes.status === 429) {
        const retryAfter = userGuildsRes.headers.get("retry-after");
        return NextResponse.json(
          {
            error: `Discord limitó las peticiones. Probá de nuevo en ${retryAfter || "unos"} segundos.`,
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          error:
            userGuildsRes.status === 401
              ? "Tu sesión de Discord expiró. Volvé a iniciar sesión."
              : `No se pudieron verificar tus permisos (Discord respondió ${userGuildsRes.status}).`,
          needsReauth: userGuildsRes.status === 401,
        },
        { status: userGuildsRes.status }
      );
    }

    const userGuilds: Array<{ id: string; owner: boolean; permissions: string }> =
      await userGuildsRes.json();

    const target = userGuilds.find((g) => g.id === guildId);

    let isAdmin = false;
    if (target) {
      if (target.owner) {
        isAdmin = true;
      } else {
        try {
          const perms = BigInt(target.permissions);
          isAdmin =
            (perms & ADMINISTRATOR) === ADMINISTRATOR ||
            (perms & MANAGE_GUILD) === MANAGE_GUILD;
        } catch {
          isAdmin = false;
        }
      }
    }

    if (!isAdmin) {
      return NextResponse.json(
        { error: "No administrás este servidor" },
        { status: 403 }
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
