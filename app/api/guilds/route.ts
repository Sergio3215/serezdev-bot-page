import { NextRequest, NextResponse } from "next/server";

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features: string[];
}

export async function GET(request: NextRequest) {
  const tokenCookie = request.cookies.get("discord_token");
  if (!tokenCookie || !tokenCookie.value) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const userToken = tokenCookie.value;
  const botToken = process.env.DISCORD_BOT_TOKEN;

  try {
    // 1. Obtener servidores donde está el usuario
    const userGuildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    if (userGuildsRes.status === 401) {
      return NextResponse.json(
        {
          error: "Token expirado o falta el scope 'guilds'",
          needsReauth: true,
        },
        { status: 401 }
      );
    }

    if (!userGuildsRes.ok) {
      const errData = await userGuildsRes.json();
      return NextResponse.json(
        { error: "Error al consultar servidores de Discord", details: errData },
        { status: userGuildsRes.status }
      );
    }

    const userGuilds: DiscordGuild[] = await userGuildsRes.json();

    // 2. Filtrar donde el usuario es Administrador (permiso 0x8, 0x20 o es owner)
    // ADMINISTRATOR bit is 0x8 (1 << 3), MANAGE_GUILD bit is 0x20 (1 << 5)
    const adminGuilds = userGuilds.filter((guild) => {
      if (guild.owner) return true;
      try {
        const perms = BigInt(guild.permissions);
        const isAdmin =
          (perms & BigInt(0x8)) === BigInt(0x8) ||
          (perms & BigInt(0x20)) === BigInt(0x20);
        return isAdmin;
      } catch {
        return false;
      }
    });

    // 3. Si hay DISCORD_BOT_TOKEN, consultar los servidores donde el bot está añadido
    let botGuildIds: Set<string> | null = null;
    let hasBotToken = false;

    if (botToken && botToken.trim() !== "") {
      hasBotToken = true;
      try {
        const botGuildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
          headers: {
            Authorization: `Bot ${botToken.trim()}`,
          },
        });

        if (botGuildsRes.ok) {
          const botGuilds: Array<{ id: string }> = await botGuildsRes.json();
          botGuildIds = new Set(botGuilds.map((g) => g.id));
        } else {
          console.error(
            "Error al consultar servidores del bot con DISCORD_BOT_TOKEN:",
            await botGuildsRes.text()
          );
        }
      } catch (botErr) {
        console.error("Fallo de conexión al consultar bot guilds:", botErr);
      }
    }

    // Clasificar los servidores
    const guildsWithBot = adminGuilds.filter((g) =>
      botGuildIds ? botGuildIds.has(g.id) : true
    );
    const guildsWithoutBot = adminGuilds.filter((g) =>
      botGuildIds ? !botGuildIds.has(g.id) : false
    );

    return NextResponse.json({
      hasBotToken,
      botGuilds: guildsWithBot,
      otherAdminGuilds: guildsWithoutBot,
      totalAdminGuilds: adminGuilds.length,
      filteredByBot: botGuildIds !== null,
    });
  } catch (error) {
    console.error("Error en /api/guilds:", error);
    return NextResponse.json(
      { error: "Error interno al procesar servidores" },
      { status: 500 }
    );
  }
}
