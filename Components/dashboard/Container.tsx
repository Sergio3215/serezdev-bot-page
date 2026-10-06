"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/Components/dashboard/NavBar";
import DashboardComponent from "@/Components/dashboard/DashboardComponent";

import { DiscordGuild, DiscordUser } from "@/types/DiscordTypes";
import ServerDashboard from "@/Components/dashboard/ServerDashboard";

import { ContainerProps } from "@/types/Elements"
import { loadGuilds } from "@/lib/guildLoading";


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
    const session = useRef<AbortController | null>(null);

    const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENTID || "1312903712238469170";
    const redirectUri = encodeURIComponent(
        process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI || "http://localhost:3000/auth/discord"
    );
    const reauthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=identify%20guilds`;

    useEffect(() => {
        const controller = new AbortController();
        session.current = controller;
        const { signal } = controller;

        async function fetchUser(): Promise<boolean> {
            try {
                const res = await fetch("/api/auth/me", { signal });
                const data = res.ok ? await res.json() : null;
                if (signal.aborted) return false;
                if (data?.authenticated && data.user) {
                    setUser(data.user);
                    return true;
                }
            } catch (err) {
                if (signal.aborted) return false;
                console.error("Error al obtener usuario:", err);
            } finally {
                if (!signal.aborted) setLoadingUser(false);
            }
            controller.abort();
            router.replace("/");
            return false;
        }

        const authenticated = fetchUser();
        loadGuilds({
            authenticated,
            signal,
            request: async () => {
                const res = await fetch("/api/guilds", { cache: "no-store", signal });
                const data = await res.json().catch(() => ({}));
                return { ok: res.ok, status: res.status, data };
            },
        })
            .then((outcome) => {
                if (outcome.kind === "reauth") window.location.href = reauthUrl;
                if (outcome.kind === "loaded") {
                    setBotGuilds(outcome.botGuilds);
                    setOtherAdminGuilds(outcome.otherAdminGuilds);
                }
            })
            .catch((err) => {
                if (!signal.aborted) console.error("Error al consultar servidores:", err);
            })
            .finally(() => {
                if (!signal.aborted) setLoadingGuilds(false);
            });
        return () => controller.abort();
    }, [router, reauthUrl]);

    const handleLogout = async () => {
        setLoggingOut(true);
        session.current?.abort();
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
        if (u.avatar) {
            return `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64`;
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
                        <ServerDashboard filteredGuilds={filteredGuilds} loadingGuilds={loadingGuilds} />
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