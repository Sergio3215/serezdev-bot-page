"use client"

import { roleDropdownType } from "@/types/DiscordTypes";
import { useEffect, useRef, useState } from "react";

export default function RoleDropdown({
    roles,
    value,
    onChange,
    disabled = false,
    loading = false,
    error = null
}: roleDropdownType) {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [query, setQuery] = useState<string>("");

    const containerRef = useRef<HTMLDivElement>(null);

    const selected = roles.find(r => r.id === value);
    const filtered = roles.filter(r => r.name.toLowerCase().includes(query.trim().toLowerCase()));

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

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => { setIsOpen(!isOpen); setQuery(""); }}
                disabled={disabled || loading || roles.length === 0}
                className="w-full flex items-center justify-between gap-3 bg-[#111214] border border-white/15 hover:border-white/25 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-[#5865F2] focus:ring-1 focus:ring-[#5865F2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
                {loading ? (
                    <span className="flex items-center gap-2.5 text-zinc-400">
                        <span className="w-3.5 h-3.5 border-2 border-[#5865F2] border-t-transparent rounded-full animate-spin"></span>
                        Cargando roles...
                    </span>
                ) : selected ? (
                    <span className="flex items-center gap-2.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: selected.color }}></span>
                        <span className="truncate font-medium" style={{ color: selected.color }}>@{selected.name}</span>
                    </span>
                ) : (
                    <span className={value ? "text-amber-300" : "text-zinc-500"}>
                        {value ? "El rol guardado ya no está disponible" : "Elegí un rol..."}
                    </span>
                )}

                <span className={`text-zinc-400 text-[10px] shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}>
                    &#9660;
                </span>
            </button>

            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

            {isOpen && (
                <div className="absolute z-50 mt-2 w-full bg-[#1e1f22] border border-white/15 rounded-xl shadow-2xl overflow-hidden">
                    {roles.length > 6 && (
                        <div className="p-2 border-b border-white/10">
                            <input
                                type="text"
                                value={query}
                                autoFocus
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Buscar rol..."
                                className="w-full bg-[#111214] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#5865F2]"
                            />
                        </div>
                    )}

                    <div className="max-h-64 overflow-y-auto py-1">
                        {filtered.length === 0 && (
                            <p className="px-3.5 py-3 text-xs text-zinc-500">Ningún rol coincide.</p>
                        )}

                        {filtered.map((role) => (
                            <button
                                key={role.id}
                                type="button"
                                disabled={!role.assignable}
                                title={role.assignable ? undefined : "El bot no puede asignar este rol: está por encima suyo en la jerarquía"}
                                onClick={() => { onChange(role.id); setIsOpen(false); setQuery(""); }}
                                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors ${role.assignable ? "hover:bg-[#2b2d31] cursor-pointer" : "opacity-40 cursor-not-allowed"} ${role.id === value ? "bg-[#5865F2]/10" : ""}`}
                            >
                                <span className="flex items-center gap-2.5 min-w-0">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: role.color }}></span>
                                    <span className="truncate text-sm font-medium" style={{ color: role.color }}>@{role.name}</span>
                                </span>
                                {role.id === value && <span className="text-[#5865F2] text-xs font-bold shrink-0">&#10003;</span>}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
