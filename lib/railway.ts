const RAILWAY_API = "https://backboard.railway.com/graphql/v2";
const BOT_SERVICE = {
    projectId: "03e039bb-5ccc-470c-ac74-4f52a4cdc70d",
    serviceId: "6afe9d6f-dd2c-414b-b8ca-a6140ca98b29",
    environmentId: "3aa425d0-9111-4781-9a57-956301fbab68",
};

export type RestartResult =
    | { ok: true; deploymentId: string }
    | { ok: false; status: number; error: string; details?: unknown };

async function railwayQuery(token: string, query: string, variables: Record<string, unknown>) {
    const response = await fetch(RAILWAY_API, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
    });
    return response.json() as Promise<{ data?: Record<string, unknown>; errors?: unknown[] }>;
}

/** Reinicia el último deployment del bot en Railway. No valida sesión ni plan: eso le toca a quien lo llama. */
export async function restartBotDeployment(): Promise<RestartResult> {
    const token = (process.env.RAILWAYS_TOKEN || process.env.RAILWAY_TOKEN)?.trim();
    if (!token) return { ok: false, status: 500, error: "Token de Railway no configurado en el archivo .env del servidor." };

    try {
        const latest = await railwayQuery(
            token,
            `query latestDeployment($input: DeploymentListInput!) {
                deployments(input: $input, first: 1) {
                    edges { node { id status url createdAt } }
                }
            }`,
            { input: BOT_SERVICE }
        );
        if (latest.errors?.length) {
            console.error("Railway GraphQL query error:", latest.errors);
            return { ok: false, status: 400, error: "Error en la consulta a Railway", details: latest.errors };
        }

        const deployments = latest.data?.deployments as { edges?: { node?: { id?: string } }[] } | undefined;
        const deploymentId = deployments?.edges?.[0]?.node?.id;
        if (!deploymentId) return { ok: false, status: 404, error: "No se encontró un deployment activo para reiniciar." };

        const restart = await railwayQuery(
            token,
            `mutation deploymentRestart($id: String!) {
                deploymentRestart(id: $id)
            }`,
            { id: deploymentId }
        );
        if (restart.errors?.length) {
            console.error("Railway GraphQL restart error:", restart.errors);
            return { ok: false, status: 400, error: "Error al ejecutar el reinicio en Railway", details: restart.errors };
        }

        return { ok: true, deploymentId };
    } catch (error) {
        console.error("Error en API de reinicio:", error);
        return { ok: false, status: 500, error: "Error interno al comunicarse con Railway" };
    }
}
