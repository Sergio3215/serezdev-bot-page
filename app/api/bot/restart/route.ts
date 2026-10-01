import { NextRequest, NextResponse } from "next/server";
import { checkGuildAdmin } from "@/lib/guildAccess";
import { canRestartBot } from "@/lib/plans";
import { getServerPlanView } from "@/lib/subscriptions";
import { restartBotDeployment } from "@/lib/railway";

export async function POST(request: NextRequest) {
  // 1. Validar sesión, que administre el servidor y que su plan permita reiniciar
  const discordToken = request.cookies.get("discord_token")?.value;
  if (!discordToken) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body: { serverId?: string } = await request.json().catch(() => ({}));
  const serverId = body.serverId;
  if (!serverId) {
    return NextResponse.json({ error: "Falta serverId" }, { status: 400 });
  }

  const access = await checkGuildAdmin(discordToken, serverId);
  if (access.status === "unauthenticated") {
    return NextResponse.json({ error: "Tu sesión expiró. Volvé a iniciar sesión." }, { status: 401 });
  }
  if (access.status === "denied") {
    return NextResponse.json({ error: "No administrás este servidor" }, { status: 403 });
  }
  if (access.status === "unknown") {
    return NextResponse.json({ error: "No se pudieron verificar tus permisos." }, { status: 502 });
  }

  let plan;
  try {
    plan = (await getServerPlanView(serverId)).plan;
  } catch {
    return NextResponse.json({ error: "No se pudo leer el plan del servidor." }, { status: 502 });
  }
  if (!canRestartBot(plan, serverId)) {
    return NextResponse.json({ error: "Reiniciar el bot está disponible desde el plan Pro." }, { status: 403 });
  }

  const result = await restartBotDeployment();
  if (!result.ok) {
    return NextResponse.json({ error: result.error, details: result.details }, { status: result.status });
  }
  return NextResponse.json({ success: true, deploymentId: result.deploymentId });
}
