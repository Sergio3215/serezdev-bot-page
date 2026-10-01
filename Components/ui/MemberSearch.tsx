"use client"

import { useEffect, useId, useRef, useState } from "react";
import { useParams } from "next/navigation";

interface GuildMember {
    id: string;
    name: string;
    username: string;
    bot: boolean;
}

interface MemberSearchProps {
    value: string | null;
    onChange: (memberId: string) => void;
}

const SEARCH_DELAY_MS = 300;

export default function MemberSearch({ value, onChange }: MemberSearchProps) {
    const params = useParams();
    const idServer = (params?.server as string) || "";
    const listId = useId();

    const [query, setQuery] = useState("");
    const [results, setResults] = useState<GuildMember[]>([]);
    const [selected, setSelected] = useState<GuildMember | null>(null);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!value || !idServer || selected?.id === value) return;
        const controller = new AbortController();
        fetch(`/api/guilds/${idServer}/members?id=${value}`, { signal: controller.signal })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (!controller.signal.aborted) setSelected(data?.members?.[0] ?? { id: value, name: value, username: "", bot: false });
            })
            .catch(() => undefined);
        return () => controller.abort();
    }, [value, idServer, selected?.id]);

    useEffect(() => {
        const text = query.trim();
        if (!text || !idServer) return;
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(`/api/guilds/${idServer}/members?query=${encodeURIComponent(text)}`, { signal: controller.signal });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
                setResults(data.members ?? []);
                setActive(0);
                setError(null);
            } catch (err) {
                if (controller.signal.aborted) return;
                setResults([]);
                setError(err instanceof Error ? err.message : "No se pudieron buscar miembros.");
            } finally {
                if (!controller.signal.aborted) setSearching(false);
            }
        }, SEARCH_DELAY_MS);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query, idServer]);

    useEffect(() => {
        if (!open) return;
        const close = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [open]);

    const choose = (member: GuildMember) => {
        setSelected(member);
        onChange(member.id);
        setQuery("");
        setResults([]);
        setOpen(false);
    };

    const visible = query.trim() ? results : [];

    return (
        <div ref={containerRef} className="relative">
            <input
                role="combobox"
                aria-expanded={open && visible.length > 0}
                aria-controls={listId}
                aria-autocomplete="list"
                value={query}
                placeholder={selected ? `${selected.name}${selected.username ? ` (@${selected.username})` : ""}` : "Buscá un miembro por su nombre"}
                onChange={(event) => {
                    setQuery(event.target.value);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setActive((index) => Math.min(index + 1, visible.length - 1));
                    } else if (event.key === "ArrowUp") {
                        event.preventDefault();
                        setActive((index) => Math.max(index - 1, 0));
                    } else if (event.key === "Enter" && visible[active]) {
                        event.preventDefault();
                        choose(visible[active]);
                    } else if (event.key === "Escape") {
                        setOpen(false);
                    }
                }}
                className={`w-full rounded-lg border border-white/10 bg-[#111214] px-3 py-2 text-sm text-white focus:border-[#5865F2] focus:outline-none ${selected ? "placeholder:text-white" : "placeholder:text-zinc-500"}`}
            />
            {open && query.trim() && (
                <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-white/10 bg-[#1e1f22] py-1 shadow-xl">
                    {searching && visible.length === 0 && <li className="px-3 py-2 text-xs text-zinc-400">Buscando...</li>}
                    {!searching && error && <li className="px-3 py-2 text-xs text-red-300">{error}</li>}
                    {!searching && !error && visible.length === 0 && <li className="px-3 py-2 text-xs text-zinc-400">Sin resultados</li>}
                    {visible.map((member, index) => (
                        <li
                            key={member.id}
                            role="option"
                            aria-selected={index === active}
                            onMouseDown={(event) => {
                                event.preventDefault();
                                choose(member);
                            }}
                            onMouseEnter={() => setActive(index)}
                            className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm ${index === active ? "bg-[#5865F2] text-white" : "text-zinc-200"}`}
                        >
                            <span className="truncate">
                                {member.name} <span className="text-xs opacity-60">@{member.username}</span>
                            </span>
                            {member.bot && <span className="rounded bg-white/10 px-1.5 text-[10px] font-semibold">BOT</span>}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
