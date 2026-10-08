"use client"

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { botApiUrl } from "@/lib/botApi";
import {
    CLEANUP_KINDS,
    CLEANUP_KIND_IDS,
    cleanupErrorMessage,
    draftFromConfig,
    emptyCleanupDraft,
    toCleanupConfig,
    type ApiErrorBody,
    type CleanupLists,
} from "@/lib/messageCleanup";
import type { DiscordChannel } from "@/types/DiscordTypes";
import type { AutoCleanMessage, CleanupConfig, CleanupDraft, CleanupKind, GhostMessage } from "@/types/MessageCleanup";
import CleanupForm from "./CleanupForm";
import CleanupList from "./CleanupList";

async function readJson(res: Response): Promise<ApiErrorBody & { data?: unknown }> {
    return res.json().catch(() => ({}));
}

type Feedback = { type: "success" | "error"; text: string } | null;

interface MessageCleanupManagerProps {
    /** Qué feature es: Limpieza automática o Mensajes fantasma. Cada una tiene su propia tarjeta en el dashboard. */
    kind: CleanupKind;
    /** Lo controla el "Atrás" del encabezado: al pasar a false se vuelve al listado. */
    editing: boolean;
    setEditing: (editing: boolean) => void;
}

/**
 * Lista y formulario de Limpieza automática o de Mensajes fantasma. Muestra solo las configuraciones de
 * `kind`, pero también carga las de la otra estrategia (en paralelo, junto con los canales) para que el
 * formulario avise si un canal ya la tiene.
 */
export default function MessageCleanupManager({ kind, editing, setEditing }: MessageCleanupManagerProps) {
    const params = useParams();
    const idServer = (params?.server as string) || "";

    const [lists, setLists] = useState<CleanupLists>({ autoClean: [], ghost: [] });
    const [loading, setLoading] = useState<Record<CleanupKind, boolean>>({ autoClean: true, ghost: true });
    const [listErrors, setListErrors] = useState<Record<CleanupKind, string | null>>({ autoClean: null, ghost: null });
    const [channels, setChannels] = useState<DiscordChannel[]>([]);
    const [channelsLoading, setChannelsLoading] = useState(true);
    const [feedback, setFeedback] = useState<Feedback>(null);
    const [formDraft, setFormDraft] = useState<CleanupDraft | null>(null);
    const [togglingIds, setTogglingIds] = useState<ReadonlySet<string>>(new Set());

    const loadList = useCallback(async (kind: CleanupKind, signal?: AbortSignal) => {
        try {
            const res = await fetch(botApiUrl(idServer, CLEANUP_KINDS[kind].endpoint), { signal, cache: "no-store" });
            const data = await readJson(res);
            if (!res.ok) {
                setListErrors((current) => ({ ...current, [kind]: cleanupErrorMessage(kind, res.status, data, "No se pudieron cargar las configuraciones.") }));
                return;
            }
            const raw = Array.isArray(data.data) ? (data.data as (AutoCleanMessage | GhostMessage)[]) : [];
            setLists((current) => ({ ...current, [kind]: raw.map((item) => toCleanupConfig(kind, item)) }));
            setListErrors((current) => ({ ...current, [kind]: null }));
        } catch {
            if (signal?.aborted) return;
            setListErrors((current) => ({ ...current, [kind]: cleanupErrorMessage(kind, 0, {}, "") }));
        } finally {
            if (!signal?.aborted) setLoading((current) => ({ ...current, [kind]: false }));
        }
    }, [idServer]);

    useEffect(() => {
        if (!idServer) return;
        const controller = new AbortController();
        // eslint-disable-next-line react-hooks/set-state-in-effect
        for (const listKind of CLEANUP_KIND_IDS) loadList(listKind, controller.signal);
        fetch(`/api/guilds/${idServer}/channels`, { signal: controller.signal })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data && !controller.signal.aborted) setChannels(data.channels ?? []);
            })
            .catch(() => undefined)
            .finally(() => {
                if (!controller.signal.aborted) setChannelsLoading(false);
            });
        return () => controller.abort();
    }, [idServer, loadList]);

    const channelName = (channelId: string) => {
        const channel = channels.find((item) => item.id === channelId);
        return channel ? `#${channel.name}` : channelsLoading ? "#…" : `Canal ${channelId}`;
    };

    const openForm = (item: CleanupConfig | null) => {
        setFormDraft(item ? draftFromConfig(item) : emptyCleanupDraft());
        setFeedback(null);
        setEditing(true);
    };

    const onSaved = async (message: string) => {
        setFeedback({ type: "success", text: message });
        await loadList(kind);
        setEditing(false);
    };

    const setEnabledLocally = (id: string, enabled: boolean) => {
        setLists((current) => ({ ...current, [kind]: current[kind].map((item) => (item.id === id ? { ...item, enabled } : item)) }));
    };

    const toggle = async (item: CleanupConfig) => {
        if (togglingIds.has(item.id)) return;
        const enabled = !item.enabled;
        setTogglingIds((current) => new Set(current).add(item.id));
        setEnabledLocally(item.id, enabled);
        setFeedback(null);
        try {
            const res = await fetch(botApiUrl(idServer, `${CLEANUP_KINDS[kind].endpoint}/${item.id}/status`), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled }),
            }).catch(() => null);
            if (!res?.ok) {
                const data = res ? await readJson(res) : {};
                setEnabledLocally(item.id, item.enabled);
                setFeedback({ type: "error", text: cleanupErrorMessage(kind, res?.status ?? 0, data, "No se pudo cambiar el estado.") });
                if (res?.status === 404) await loadList(kind);
            }
        } finally {
            setTogglingIds((current) => {
                const next = new Set(current);
                next.delete(item.id);
                return next;
            });
        }
    };

    const remove = async (item: CleanupConfig) => {
        const res = await fetch(botApiUrl(idServer, `${CLEANUP_KINDS[kind].endpoint}/${item.id}`), { method: "DELETE" }).catch(() => null);
        if (!res?.ok) {
            const data = res ? await readJson(res) : {};
            setFeedback({ type: "error", text: cleanupErrorMessage(kind, res?.status ?? 0, data, "No se pudo eliminar la configuración.") });
        } else {
            setFeedback({ type: "success", text: CLEANUP_KINDS[kind].deleted });
        }
        await loadList(kind);
    };

    if (editing && formDraft) {
        return (
            <CleanupForm
                key={formDraft.id ?? "new"}
                kind={kind}
                idServer={idServer}
                initialDraft={formDraft}
                channels={channels}
                channelsLoading={channelsLoading}
                lists={lists}
                onSaved={onSaved}
            />
        );
    }

    return (
        <div className="mx-auto mt-6 max-w-4xl space-y-4">
            {listErrors[kind] && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{listErrors[kind]}</div>}
            {feedback && (
                <div
                    role={feedback.type === "error" ? "alert" : "status"}
                    className={`rounded-xl border p-3 text-xs ${feedback.type === "error" ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}
                >
                    {feedback.text}
                </div>
            )}
            <CleanupList
                kind={kind}
                items={lists[kind]}
                loading={loading[kind]}
                togglingIds={togglingIds}
                channelName={channelName}
                onCreate={() => openForm(null)}
                onEdit={openForm}
                onToggle={toggle}
                onDelete={remove}
            />
        </div>
    );
}
