import Image from "next/image";
import { DiscordGuild, serverList } from "@/types/DiscordTypes"

export default function DashboardComponent({ searchQuery, setSearchQuery, filteredGuilds, loadingGuilds, getGuildIconUrl, getInitials }: serverList) {
    return (
        <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                        Servidores
                    </h1>
                    <p className="mt-1 text-xs sm:text-sm text-zinc-400">
                        Lista de servidores donde Serez Dev Bot está añadido.
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

            {/* Listado de Servidores */}
            {
                loadingGuilds ? (
                    <div className="mt-12 flex flex-col items-center justify-center gap-3">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#5865F2] border-t-transparent"></div>
                        <p className="text-xs text-zinc-400">Enlistando servidores...</p>
                    </div>
                ) : filteredGuilds.length === 0 ? (
                    <div className="mt-12 flex flex-col items-center justify-center rounded-3xl border border-white/5 bg-[#12141e]/50 p-12 text-center">
                        <div className="w-full flex h-16 items-center justify-center rounded-2xl text-zinc-500 mb-4">
                            <span>No hay servidores donde este el bot</span>
                        </div>
                    </div>
                ) :
                    (
                        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            {filteredGuilds.map((guild: DiscordGuild) => {
                                const iconUrl = getGuildIconUrl(guild);
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
                                                </div>
                                            </div>
                                        </div>

                                        {/* Acciones */}
                                        <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                                            <a className="w-full rounded-xl bg-[#5865F2] py-2 shadow-md shadow-[#5865F2]/20 hover:bg-[#4752c4] transition-all cursor-pointer" href={`/dashboard/${guild.id}`}>
                                                <button className="w-full text-xs font-semibold text-white shadow-md shadow-[#5865F2]/20 transition-all cursor-pointer">
                                                    Administrar Servidor &rarr;
                                                </button>
                                            </a>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )
            }
        </>
    );
}