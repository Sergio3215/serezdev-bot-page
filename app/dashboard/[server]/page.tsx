import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Container from "@/Components/Container";
import { checkGuildAdmin } from "@/lib/guildAccess";

export default async function Server({ params }: { params: Promise<{ server: string }> }) {
    const { server } = await params;

    const token = (await cookies()).get("discord_token")?.value;
    if (!token) redirect("/");

    const access = await checkGuildAdmin(token, server);

    if (access.status === "unauthenticated") redirect("/");
    if (access.status === "denied") redirect("/dashboard");
    // "unknown" (429, 5xx, red caída): no echamos a un admin legítimo por un fallo
    // transitorio de Discord. El filtro del cliente sigue tapando la vista.

    return (
        <Container site="server" />
    );
}
