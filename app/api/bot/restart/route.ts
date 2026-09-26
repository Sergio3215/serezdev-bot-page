import { NextRequest, NextResponse } from "next/server";
import { checkGuildAdmin } from "@/lib/guildAccess";
import { canRestartBot } from "@/lib/plans";
import { getServerPlanView } from "@/lib/subscriptions";

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

  const token = process.env.RAILWAYS_TOKEN || process.env.RAILWAY_TOKEN;

  if (!token) {
    return NextResponse.json(
      { error: "Token de Railway no configurado en el archivo .env del servidor." },
      { status: 500 }
    );
  }

  try {
    // 2. Consultar el último deployment del bot
    const response = await fetch("https://backboard.railway.com/graphql/v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `query latestDeployment($input: DeploymentListInput!) {
          deployments(input: $input, first: 1) {
            edges {
              node {
                id
                status
                url
                createdAt
              }
            }
          }
        }`,
        variables: {
          input: {
            projectId: "03e039bb-5ccc-470c-ac74-4f52a4cdc70d",
            serviceId: "6afe9d6f-dd2c-414b-b8ca-a6140ca98b29",
            environmentId: "3aa425d0-9111-4781-9a57-956301fbab68",
          },
        },
      }),
    });

    const resData = await response.json();

    if (resData.errors && resData.errors.length > 0) {
      console.error("Railway GraphQL query error:", resData.errors);
      return NextResponse.json(
        { error: "Error en la consulta a Railway", details: resData.errors },
        { status: 400 }
      );
    }

    const deploymentId = resData.data?.deployments?.edges?.[0]?.node?.id;
    if (!deploymentId) {
      return NextResponse.json(
        { error: "No se encontró un deployment activo para reiniciar." },
        { status: 404 }
      );
    }

    // 3. Ejecutar mutation para reiniciar el deployment
    const response2 = await fetch("https://backboard.railway.com/graphql/v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `mutation deploymentRestart($id: String!) {
          deploymentRestart(id: $id)
        }`,
        variables: {
          id: deploymentId,
        },
      }),
    });

    const resData2 = await response2.json();

    if (resData2.errors && resData2.errors.length > 0) {
      console.error("Railway GraphQL restart error:", resData2.errors);
      return NextResponse.json(
        { error: "Error al ejecutar el reinicio en Railway", details: resData2.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, deploymentId });
  } catch (err) {
    console.error("Error en API de reinicio:", err);
    return NextResponse.json(
      { error: "Error interno al comunicarse con Railway" },
      { status: 500 }
    );
  }
}
