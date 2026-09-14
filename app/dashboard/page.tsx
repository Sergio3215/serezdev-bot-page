"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
  discriminator: string;
  global_name?: string | null;
}

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<DiscordUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingGuilds, setLoadingGuilds] = useState(true);

  const [botGuilds, setBotGuilds] = useState<DiscordGuild[]>([]);
  const [otherAdminGuilds, setOtherAdminGuilds] = useState<DiscordGuild[]>([]);
  const [activeTab, setActiveTab] = useState<"withBot" | "all">("withBot");
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
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0e1017]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5865F2] shadow-lg shadow-[#5865F2]/25">
              <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-lg text-white">Serez Dev Bot</span>
              <span className="ml-2 rounded-md bg-[#5865F2]/15 border border-[#5865F2]/30 px-2 py-0.5 text-[10px] font-semibold text-[#8a94f8]">
                SERVIDORES
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 rounded-full bg-white/5 border border-white/10 px-3 py-1.5">
              <div className="relative h-7 w-7 overflow-hidden rounded-full ring-2 ring-[#5865F2]/50">
                <Image
                  src={getAvatarUrl(user)}
                  alt={displayName}
                  width={28}
                  height={28}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              </div>
              <span className="hidden sm:inline-block text-xs font-medium text-zinc-200">
                {displayName}
              </span>
            </div>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-1.5 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-all hover:bg-red-500 hover:text-white disabled:opacity-50"
            >
              <span>{loggingOut ? "Saliendo..." : "Cerrar Sesión"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Título de la Sección y Barra de Búsqueda */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Servidores
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-400">
              Servidores donde eres Administrador y Serez Dev Bot está añadido.
            </p>
          </div>

          {/* Barra de Búsqueda */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Buscar servidor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#12141e] px-3.5 py-2 pl-9 text-xs text-white placeholder-zinc-500 focus:border-[#5865F2] focus:outline-none focus:ring-1 focus:ring-[#5865F2]"
            />
            <svg
              className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Pestañas si existen otros servidores administrados */}
        {otherAdminGuilds.length > 0 && (
          <div className="mt-6 flex gap-2">
            <button
              onClick={() => setActiveTab("withBot")}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "withBot"
                  ? "bg-[#5865F2] text-white shadow-lg shadow-[#5865F2]/25"
                  : "bg-[#12141e] text-zinc-400 hover:text-white border border-white/5"
              }`}
            >
              Con Serez Dev Bot ({botGuilds.length})
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "all"
                  ? "bg-[#5865F2] text-white shadow-lg shadow-[#5865F2]/25"
                  : "bg-[#12141e] text-zinc-400 hover:text-white border border-white/5"
              }`}
            >
              Todos mis servidores Admin ({botGuilds.length + otherAdminGuilds.length})
            </button>
          </div>
        )}

        {/* Listado de Servidores */}
        {loadingGuilds ? (
          <div className="mt-12 flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#5865F2] border-t-transparent"></div>
            <p className="text-xs text-zinc-400">Enlistando servidores...</p>
          </div>
        ) : filteredGuilds.length === 0 ? (
          <div className="mt-12 flex flex-col items-center justify-center rounded-3xl border border-white/5 bg-[#12141e]/50 p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-zinc-500 mb-4">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="text-base font-bold text-white">
              {searchQuery
                ? "No se encontraron servidores con ese nombre"
                : "No se encontraron servidores con Serez Dev Bot añadido"}
            </h3>
            <p className="mt-1 text-xs text-zinc-400 max-w-sm">
              Añade el bot a tus servidores donde eres Administrador para empezar a gestionarlo.
            </p>

            <a
              href={`https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#5865F2] px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#5865F2]/25 hover:bg-[#4752c4] transition-all"
            >
              <span>Invitar Serez Dev Bot</span>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredGuilds.map((guild) => {
              const iconUrl = getGuildIconUrl(guild);
              const isWithBot = botGuilds.some((b) => b.id === guild.id);
              const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands&guild_id=${guild.id}`;

              return (
                <div
                  key={guild.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/5 bg-[#12141e] p-5 shadow-lg transition-all hover:border-[#5865F2]/40 hover:bg-[#151825]"
                >
                  <div className="flex items-start gap-4">
                    {/* Icono del Servidor */}
                    <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl bg-gradient-to-tr from-zinc-800 to-zinc-700 ring-2 ring-white/10 shadow-md">
                      {iconUrl ? (
                        <Image
                          src={iconUrl}
                          alt={guild.name}
                          width={56}
                          height={56}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-bold text-sm text-zinc-300">
                          {getInitials(guild.name)}
                        </div>
                      )}
                    </div>

                    {/* Información del Servidor */}
                    <div className="flex-1 min-w-0">
                      <h3 className="truncate text-base font-bold text-white group-hover:text-[#8a94f8] transition-colors">
                        {guild.name}
                      </h3>
                      <p className="mt-0.5 text-[11px] text-zinc-500 font-mono truncate">
                        ID: {guild.id}
                      </p>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {guild.owner ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                            👑 Propietario
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
                            🛡️ Administrador
                          </span>
                        )}

                        {isWithBot ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            Bot Añadido
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-500/10 border border-zinc-500/20 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
                            Sin Bot
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                    {isWithBot ? (
                      <button className="w-full rounded-xl bg-[#5865F2] py-2 text-xs font-semibold text-white shadow-md shadow-[#5865F2]/20 hover:bg-[#4752c4] transition-all">
                        Administrar Servidor &rarr;
                      </button>
                    ) : (
                      <a
                        href={inviteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full text-center rounded-xl bg-white/10 border border-white/10 py-2 text-xs font-semibold text-white hover:bg-[#5865F2] hover:border-[#5865F2] transition-all"
                      >
                        + Añadir Serez Dev Bot
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}