"use client"

import { useEffect, useId, useRef, useState } from "react";

export interface MultiSelectItem {
    id: string;
    label: string;
    /** Color opcional del punto que acompaña la etiqueta. */
    color?: string;
}

interface MultiSelectChipsProps {
    items: MultiSelectItem[];
    selectedIds: string[];
    onChange: (selectedIds: string[]) => void;
    placeholder?: string;
    /** Texto que se muestra cuando no hay nada seleccionado. */
    emptyLabel?: string;
    disabled?: boolean;
    loading?: boolean;
    /** Ordena la selección según el orden de `items` (útil para días de la semana). */
    keepItemOrder?: boolean;
}

/** Selector múltiple genérico: dropdown con buscador y la selección como chips quitables. */
export default function MultiSelectChips({
    items,
    selectedIds,
    onChange,
    placeholder = "Agregar...",
    emptyLabel = "Nada seleccionado",
    disabled = false,
    loading = false,
    keepItemOrder = false,
}: MultiSelectChipsProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const listId = useId();

    const itemById = new Map(items.map((item) => [item.id, item]));
    const selected = selectedIds.filter((id, index) => itemById.has(id) && selectedIds.indexOf(id) === index);
    const available = items.filter((item) => !selected.includes(item.id) && item.label.toLowerCase().includes(query.trim().toLowerCase()));

    useEffect(() => {
        if (!open) return;
        const close = (event: MouseEvent | KeyboardEvent) => {
            if (event instanceof KeyboardEvent && event.key !== "Escape") return;
            if (event instanceof MouseEvent && containerRef.current?.contains(event.target as Node)) return;
            setOpen(false);
            setQuery("");
        };
        document.addEventListener("mousedown", close);
        document.addEventListener("keydown", close);
        return () => {
            document.removeEventListener("mousedown", close);
            document.removeEventListener("keydown", close);
        };
    }, [open]);

    const add = (id: string) => {
        if (selected.includes(id)) return;
        const next = [...selected, id];
        onChange(keepItemOrder ? items.map((item) => item.id).filter((itemId) => next.includes(itemId)) : next);
        setQuery("");
    };

    const remove = (id: string) => onChange(selected.filter((selectedId) => selectedId !== id));

    return (
        <div ref={containerRef} className="relative space-y-2">
            <div className="flex min-h-[40px] flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-[#111214] px-2 py-1.5">
                {selected.length === 0 && <span className="px-1 text-xs text-zinc-400">{emptyLabel}</span>}
                {selected.map((id) => {
                    const item = itemById.get(id);
                    if (!item) return null;
                    return (
                        <span key={id} className="inline-flex items-center gap-1.5 rounded-md border border-[#5865F2]/40 bg-[#5865F2]/15 py-0.5 pl-2 pr-1 text-xs text-white">
                            {item.color && <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />}
                            {item.label}
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => remove(id)}
                                aria-label={`Quitar ${item.label}`}
                                className="rounded px-1 text-zinc-300 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed cursor-pointer"
                            >
                                ×
                            </button>
                        </span>
                    );
                })}
                <button
                    type="button"
                    disabled={disabled || loading}
                    onClick={() => setOpen((value) => !value)}
                    aria-expanded={open}
                    aria-controls={listId}
                    className="ml-auto rounded-md px-2 py-1 text-xs text-[#aab1ff] hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                    {loading ? "Cargando..." : placeholder}
                </button>
            </div>

            {open && (
                <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-white/10 bg-[#1e1f22] shadow-xl">
                    <input
                        autoFocus
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Buscar..."
                        className="w-full border-b border-white/10 bg-transparent px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
                    />
                    <ul id={listId} role="listbox" aria-multiselectable="true" className="max-h-56 overflow-y-auto py-1">
                        {available.length === 0 && <li className="px-3 py-2 text-xs text-zinc-400">Sin opciones disponibles</li>}
                        {available.map((item) => (
                            <li key={item.id} role="option" aria-selected="false">
                                <button
                                    type="button"
                                    onClick={() => add(item.id)}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-[#5865F2] hover:text-white cursor-pointer"
                                >
                                    {item.color && <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />}
                                    {item.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
