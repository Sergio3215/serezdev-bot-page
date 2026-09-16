"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/Components/NavBar";
import DashboardComponent from "@/Components/DashboardComponent";

import { DiscordGuild, DiscordUser } from "../types/DiscordTypes";
import ServerDashboard from "./ServerDashboard";

import { ContainerProps } from "../types/Elements"


export default function Container({ children, site }: ContainerProps) {
    const router = useRouter();
    const [user, setUser] = useState<DiscordUser | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [loadingGuilds, setLoadingGuilds] = useState(true);

    const [botGuilds, setBotGuilds] = useState<DiscordGuild[]>([]);
    const [otherAdminGuilds, setOtherAdminGuilds] = useState<DiscordGuild[]>([]);
    const [activeTab] = useState<"withBot" | "all">("withBot");
    const [searchQuery, setSearchQuery] = useState("");
    const [loggingOut, setLoggingOut] = useState(false);

    const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENTID || "1312903712238469170";
    const redirectUri = encodeURIComponent(
        process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI || "http://localhost:3000/auth/discord"
    );
    const reauthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=identify%20guilds`;

    // 1. Validar usuario autenticado
    useEffect(() => {
        async function fetchUser() {
            try {
                const res = await fetch("/api/auth/me");
                if (!res.ok) {
                    router.replace("/");
                    return;
                }
                const data = await res.json();
                if (data.authenticated && data.user) {
                    setUser(data.user);
                } else {
                    router.replace("/");
                }
            } catch (err) {
                console.error("Error al obtener usuario:", err);
                router.replace("/");
            } finally {
                setLoadingUser(false);
            }
        }

        fetchUser();
    }, [router]);

    // 2. Obtener servidores donde es Admin y el bot está añadido
    useEffect(() => {
        if (!user) return;

        async function fetchGuilds() {
            setLoadingGuilds(true);
            try {
                const res = await fetch("/api/guilds");
                const data = await res.json();

                // Si falta el scope 'guilds' del login previo, redirigir automáticamente para actualizar credenciales
                if (res.status === 401 && data.needsReauth) {
                    window.location.href = reauthUrl;
                    return;
                }

                if (res.ok) {
                    setBotGuilds(data.botGuilds || []);
                    setOtherAdminGuilds(data.otherAdminGuilds || []);
                }
            } catch (err) {
                console.error("Error al consultar servidores:", err);
            } finally {
                setLoadingGuilds(false);
            }
        }

        fetchGuilds();
    }, [user, reauthUrl]);

    const handleLogout = async () => {
        setLoggingOut(true);
        try {
            await fetch("/api/auth/logout", { method: "POST" });
        } catch (err) {
            console.error("Error cerrando sesión:", err);
        } finally {
            document.cookie = "discord_user=; path=/; max-age=0";
            document.cookie = "discord_token=; path=/; max-age=0";
            router.replace("/");
        }
    };

    const getAvatarUrl = (u: DiscordUser) => {
        // console.log(u.avatar)
        if (u.avatar) {
            return `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=256`;
        }
        const defaultIndex = Math.abs(Number(BigInt(u.id || "0") >> BigInt(22)) % 6);
        return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
    };

    const getGuildIconUrl = (guild: DiscordGuild) => {
        if (guild.icon) {
            return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`;
        }
        return null;
    };

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 3)
            .toUpperCase();
    };

    if (loadingUser) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#5865F2] border-t-transparent"></div>
                    <p className="text-sm text-zinc-400">Cargando...</p>
                </div>
            </div>
        );
    }

    if (!user) return null;

    const displayName = user.global_name || user.username;
    const currentGuildList =
        activeTab === "withBot"
            ? botGuilds
            : [...botGuilds, ...otherAdminGuilds];

    const filteredGuilds = currentGuildList.filter((g) =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-[#0a0b10] text-zinc-100 font-sans selection:bg-[#5865F2] selection:text-white">
            {/* Navbar Superior */}

            {
                user && (
                    <NavBar user={user} displayName={displayName} handleLogout={handleLogout} loggingOut={loggingOut} getAvatarUrl={getAvatarUrl} />
                )
            }


            {/* Main Container */}
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {/* Título de la Sección y Barra de Búsqueda */}
                {
                    site === "dashboard" && (
                        <DashboardComponent
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            filteredGuilds={filteredGuilds}
                            loadingGuilds={loadingGuilds}
                            getGuildIconUrl={getGuildIconUrl}
                            getInitials={getInitials}
                        />
                    )
                }

                {
                    site === "server" && (
                        <ServerDashboard filteredGuilds={filteredGuilds} />
                    )
                }

                {
                    !site && (
                        children
                    )
                }
            </main>
        </div>
    );
}