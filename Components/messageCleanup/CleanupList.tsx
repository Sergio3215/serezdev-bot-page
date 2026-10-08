"use client"

import { useEffect, useState } from "react";
import { CLEANUP_KINDS, describeCleanup } from "@/lib/messageCleanup";
import type { CleanupConfig, CleanupKind } from "@/types/MessageCleanup";
import StatusSwitch from "./StatusSwitch";

const NEXT_RUN_FORMAT = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });

function formatNextRun(nextRunAt: string | null): string | null {
    if (!nextRunAt) return null;
    const date = new Date(nextRunAt);
    return Number.isNaN(date.getTime()) ? null : NEXT_RUN_FORMAT.format(date);
}

interface CleanupListProps {
    kind: CleanupKind;
    items: CleanupConfig[];
    loading: boolean;
    togglingIds: ReadonlySet<string>;
    channelName: (channelId: string) => string;
    onCreate: () => void;
    onEdit: (item: CleanupConfig) => void;
    onToggle: (item: CleanupConfig) => void;
    onDelete: (item: CleanupConfig) => Promise<void>;
}

export default function CleanupList({ kind, items, loading, togglingIds, channelName, onCreate, onEdit, onToggle, onDelete }: CleanupListProps) {
    const config = CLEANUP_KINDS[kind];
    const [pendingDelete, setPendingDelete] = useState<CleanupConfig | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (!pendingDelete || deleting) return;
        const close = (event: KeyboardEvent) => {
            if (event.key === "Escape") setPendingDelete(null);
        };
        window.addEventListener("keydown", close);
        return () => window.removeEventListener("keydown", close);
    }, [pendingDelete, deleting]);

    const confirmDelete = async () => {
        if (!pendingDelete || deleting) return;
        setDeleting(true);
        try {
            await onDelete(pendingDelete);
        } finally {
            setDeleting(false);
            setPendingDelete(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-zinc-400">{config.intro}</p>
                <button
                    type="button"
                    onClick={onCreate}
                    className="rounded-xl bg-[#5865F2] px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#5865F2]/20 hover:bg-[#4752c4] cursor-pointer"
                >
                    + Nueva configuración
                </button>
            </div>

            {loading ? (
                <p role="status" className="text-xs text-zinc-400">Cargando configuraciones...</p>
            ) : items.length === 0 ? (
                <div className="space-y-3 rounded-xl border border-dashed border-white/15 p-6 text-center">
                    <p className="text-xs text-zinc-400">{config.empty}</p>
                    <button
                        type="button"
                        onClick={onCreate}
                        className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10 cursor-pointer"
                    >
                        Crear la primera
                    </button>
                </div>
            ) : (
                <ul className="divide-y divide-white/5 rounded-xl border border-white/10 bg-[#12141e]">
                    {items.map((item) => {
                        const nextRun = item.enabled ? formatNextRun(item.nextRunAt) : null;
                        return (
                            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                                <div className="min-w-0 space-y-0.5">
                                    <p className="text-sm font-semibold text-white">{channelName(item.channelId)}</p>
                                    <p className="text-[11px] text-zinc-400">
                                        {describeCleanup(kind, item)} · {item.enabled ? "Activo" : "Inactivo"}
                                    </p>
                                    {nextRun && <p className="text-[10px] text-zinc-500">Próxima limpieza: {nextRun}</p>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <StatusSwitch
                                        checked={item.enabled}
                                        label={`Activar ${config.label.toLowerCase()} en ${channelName(item.channelId)}`}
                                        disabled={togglingIds.has(item.id)}
                                        onChange={() => onToggle(item)}
                                    />
                                    <button type="button" onClick={() => onEdit(item)} className="rounded-lg px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5 cursor-pointer">
                                        Editar
                                    </button>
                                    <button type="button" onClick={() => setPendingDelete(item)} className="rounded-lg px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 cursor-pointer">
                                        Eliminar
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {pendingDelete && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
                    onClick={(event) => {
                        if (event.target === event.currentTarget && !deleting) setPendingDelete(null);
                    }}
                >
                    <div
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="delete-cleanup-title"
                        aria-describedby="delete-cleanup-question"
                        className="w-full max-w-md space-y-5 rounded-2xl border border-white/10 bg-[#1e1f22] p-6 text-white shadow-2xl sm:p-7"
                    >
                        <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-2.5 text-xl text-red-400">🗑️</div>
                            <div>
                                <h3 id="delete-cleanup-title" className="text-lg font-bold tracking-tight">{config.deleteTitle}</h3>
                                <p className="text-xs text-zinc-400">Esta acción no se puede deshacer</p>
                            </div>
                        </div>
                        <p id="delete-cleanup-question" className="text-sm leading-relaxed text-zinc-300">
                            {config.deleteQuestion(channelName(pendingDelete.channelId))}
                        </p>
                        <div className="flex gap-2 pt-1">
                            <button
                                type="button"
                                autoFocus
                                disabled={deleting}
                                onClick={() => setPendingDelete(null)}
                                className="flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-white/10 disabled:opacity-50 cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={confirmDelete}
                                className="flex-1 rounded-xl bg-[#da373c] py-2.5 text-xs font-semibold text-white shadow-lg shadow-red-500/20 hover:bg-[#a12828] disabled:cursor-wait disabled:opacity-50 cursor-pointer"
                            >
                                {deleting ? "Eliminando..." : "Eliminar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
