import { NextRequest, NextResponse } from "next/server";
import { checkGuildAdmin } from "@/lib/guildAccess";

const ADMINISTRATOR = BigInt(0x8);
const VIEW_CHANNEL = BigInt(0x400);
const SEND_MESSAGES = BigInt(0x800);
const ATTACH_FILES = BigInt(0x8000);

// https://discord.com/developers/docs/resources/channel#channel-object-channel-types
const GUILD_TEXT = 0;
const GUILD_CATEGORY = 4;
const GUILD_ANNOUNCEMENT = 5;

interface DiscordApiOverwrite {
  id: string;
  /** 0 = rol, 1 = miembro */
  type: number;
  allow: string;
  deny: string;
}

interface DiscordApiChannel {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id: string | null;
  permission_overwrites?: DiscordApiOverwrite[];
}

interface DiscordApiRole {
  id: string;
  permissions: string;
}

/**
 * Permisos efectivos del bot en un canal, siguiendo el orden que define Discord:
 * permisos base de sus roles, después la sobrescritura de @everyone, después las
 * de sus roles acumuladas, y por último la suya propia como miembro.
 */
function botPuedeEscribir(
  channel: DiscordApiChannel,
  guildId: string,
  botId: string,
  botRoleIds: string[],
  permisosPorRol: Map<string, bigint>
): boolean {
  // @everyone es el rol cuyo id es el del servidor.
  let permisos = permisosPorRol.get(guildId) ?? BigInt(0);
  for (const roleId of botRoleIds) {
    permisos |= permisosPorRol.get(roleId) ?? BigInt(0);
  }

  if ((permisos & ADMINISTRATOR) === ADMINISTRATOR) return true;

  const overwrites = channel.permission_overwrites ?? [];

  const everyone = overwrites.find((o) => o.id === guildId);
  if (everyone) {
    permisos &= ~BigInt(everyone.deny);
    permisos |= BigInt(everyone.allow);
  }

  let allow = BigInt(0);
  let deny = BigInt(0);
  for (const o of overwrites) {
    if (o.type === 0 && o.id !== guildId && botRoleIds.includes(o.id)) {
      allow |= BigInt(o.allow);
      deny |= BigInt(o.deny);
    }
  }
  permisos &= ~deny;
  permisos |= allow;

  const propia = overwrites.find((o) => o.type === 1 && o.id === botId);
  if (propia) {
    permisos &= ~BigInt(propia.deny);
    permisos |= BigInt(propia.allow);
  }

  const tiene = (flag: bigint) => (permisos & flag) === flag;

  // ATTACH_FILES hace falta porque la bienvenida se manda como imagen adjunta.
  return tiene(VIEW_CHANNEL) && tiene(SEND_MESSAGES) && tiene(ATTACH_FILES);
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

    // 2. Canales del servidor, con el token del bot
    const authBot = { Authorization: `Bot ${botToken.trim()}` };

    const channelsRes = await fetch(`https://discord.com/api/guilds/${guildId}/channels`, {
      headers: authBot,
      cache: "no-store",
    });

    if (!channelsRes.ok) {
      return NextResponse.json(
        { error: "No se pudieron obtener los canales del servidor" },
        { status: channelsRes.status }
      );
    }

    const allChannels: DiscordApiChannel[] = await channelsRes.json();

    // 3. Roles del bot y permisos de cada rol, para saber dónde puede escribir.
    //    Si algo de esto falla, no marcamos ningún canal como bloqueado: es peor
    //    esconder un canal válido que mostrar uno que después falle.
    const botId = process.env.DISCORD_CLIENT_ID || process.env.NEXT_PUBLIC_DISCORD_CLIENTID;
    let permisosConocidos = false;
    let botRoleIds: string[] = [];
    const permisosPorRol = new Map<string, bigint>();

    if (botId) {
      try {
        const [rolesRes, memberRes] = await Promise.all([
          fetch(`https://discord.com/api/guilds/${guildId}/roles`, { headers: authBot, cache: "no-store" }),
          fetch(`https://discord.com/api/guilds/${guildId}/members/${botId}`, { headers: authBot, cache: "no-store" }),
        ]);

        if (rolesRes.ok && memberRes.ok) {
          const roles: DiscordApiRole[] = await rolesRes.json();
          const member: { roles: string[] } = await memberRes.json();

          for (const role of roles) {
            permisosPorRol.set(role.id, BigInt(role.permissions));
          }
          botRoleIds = member.roles;
          permisosConocidos = true;
        }
      } catch (permErr) {
        console.error("No se pudieron calcular los permisos del bot:", permErr);
      }
    }

    // 4. Nombre de cada categoría, para agrupar en el desplegable
    const categorias = new Map<string, string>();
    for (const c of allChannels) {
      if (c.type === GUILD_CATEGORY) categorias.set(c.id, c.name);
    }

    const posicionCategoria = (parentId: string | null) => {
      if (!parentId) return -1; // los canales sueltos van arriba, como en Discord
      return allChannels.find((c) => c.id === parentId)?.position ?? 0;
    };

    const channels = allChannels
      .filter((c) => c.type === GUILD_TEXT || c.type === GUILD_ANNOUNCEMENT)
      .sort((a, b) => {
        const catDiff = posicionCategoria(a.parent_id) - posicionCategoria(b.parent_id);
        return catDiff !== 0 ? catDiff : a.position - b.position;
      })
      .map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        categoryName: c.parent_id ? categorias.get(c.parent_id) ?? null : null,
        canSend: permisosConocidos
          ? botPuedeEscribir(c, guildId, botId as string, botRoleIds, permisosPorRol)
          : true,
      }));

    return NextResponse.json({ channels });
  } catch (error) {
    console.error("Error en /api/guilds/[server]/channels:", error);
    return NextResponse.json(
      { error: "Error interno al obtener los canales" },
      { status: 500 }
    );
  }
}
