import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // 1. Validar sesión de usuario autenticado
  const userCookie = request.cookies.get("discord_user");
  if (!userCookie || !userCookie.value) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
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
