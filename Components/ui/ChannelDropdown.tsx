"use client"

import { channelDropdownType, DiscordChannel } from "@/types/DiscordTypes";
import { useEffect, useRef, useState } from "react";

/** Los canales de anuncios (type 5) se marcan aparte: el bot igual puede publicar. */
const iconoDe = (channel: DiscordChannel) => (channel.type === 5 ? "📢" : "#");

export default function ChannelDropdown({
    channels,
    value,
    onChange,
    disabled = false,
    loading = false,
    error = null
}: channelDropdownType) {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [query, setQuery] = useState<string>("");

    const containerRef = useRef<HTMLDivElement>(null);

    const selected = channels.find(c => c.id === value);
    const filtered = channels.filter(c => c.name.toLowerCase().includes(query.trim().toLowerCase()));

    useEffect(() => {
        if (!isOpen) return;

        const close = (e: MouseEvent | KeyboardEvent) => {
            if (e instanceof KeyboardEvent && e.key !== "Escape") return;
            if (e instanceof MouseEvent && containerRef.current?.contains(e.target as Node)) return;
            setIsOpen(false);
            setQuery("");
        };

        document.addEventListener("mousedown", close);
        document.addEventListener("keydown", close);

        return () => {
            document.removeEventListener("mousedown", close);
            document.removeEventListener("keydown", close);
        };
    }, [isOpen]);

    // Agrupa por categoría respetando el orden que ya trae la API.
    const grupos: { categoria: string | null; canales: DiscordChannel[] }[] = [];
    for (const canal of filtered) {
        const ultimo = grupos[grupos.length - 1];
        if (ultimo && ultimo.categoria === canal.categoryName) ultimo.canales.push(canal);
        else grupos.push({ categoria: canal.categoryName, canales: [canal] });
    }

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => { setIsOpen(!isOpen); setQuery(""); }}
                disabled={disabled || loading || channels.length === 0}
                className="w-full flex items-center justify-between gap-3 bg-[#111214] border border-white/15 hover:border-white/25 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-[#5865F2] focus:ring-1 focus:ring-[#5865F2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
                {loading ? (
                    <span className="flex items-center gap-2.5 text-zinc-400">
                        <span className="w-3.5 h-3.5 border-2 border-[#5865F2] border-t-transparent rounded-full animate-spin"></span>
                        Cargando canales...
                    </span>
                ) : selected ? (
                    <span className="flex items-center gap-2 min-w-0">
                        <span className="text-zinc-500 shrink-0">{iconoDe(selected)}</span>
                        <span className="truncate font-medium">{selected.name}</span>
                        {!selected.canSend && (
                            <span className="text-[10px] text-amber-400 shrink-0">sin permisos</span>
                        )}
                    </span>
                ) : (
                    <span className={value ? "text-amber-300" : "text-zinc-500"}>
                        {value ? "El canal guardado ya no existe" : "Elegí un canal..."}
                    </span>
                )}

                <span className={`text-zinc-400 text-[10px] shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}>
                    &#9660;
                </span>
            </button>

            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

            {isOpen && (
                <div className="absolute z-50 mt-2 w-full bg-[#1e1f22] border border-white/15 rounded-xl shadow-2xl overflow-hidden">
                    {channels.length > 6 && (
                        <div className="p-2 border-b border-white/10">
                            <input
                                type="text"
                                value={query}
                                autoFocus
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Buscar canal..."
                                className="w-full bg-[#111214] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#5865F2]"
                            />
                        </div>
                    )}

                    <div className="max-h-64 overflow-y-auto py-1">
                        {filtered.length === 0 && (
                            <p className="px-3.5 py-3 text-xs text-zinc-500">Ningún canal coincide.</p>
                        )}

                        {grupos.map((grupo, i) => (
                            <div key={grupo.categoria ?? `sueltos-${i}`}>
                                {grupo.categoria && (
                                    <p className="px-3.5 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                        {grupo.categoria}
                                    </p>
                                )}

                                {grupo.canales.map((channel) => (
                                    <button
                                        key={channel.id}
                                        type="button"
                                        disabled={!channel.canSend}
                                        title={channel.canSend ? undefined : "El bot no puede escribir o adjuntar archivos en este canal"}
                                        onClick={() => { onChange(channel.id); setIsOpen(false); setQuery(""); }}
                                        className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors ${channel.canSend ? "hover:bg-[#2b2d31] cursor-pointer" : "opacity-40 cursor-not-allowed"} ${channel.id === value ? "bg-[#5865F2]/10" : ""}`}
                                    >
                                        <span className="flex items-center gap-2 min-w-0">
                                            <span className="text-zinc-500 shrink-0">{iconoDe(channel)}</span>
                                            <span className="truncate text-sm font-medium">{channel.name}</span>
                                        </span>
                                        {channel.id === value && <span className="text-[#5865F2] text-xs font-bold shrink-0">&#10003;</span>}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
