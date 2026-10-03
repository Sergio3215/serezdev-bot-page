"use client"

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ChannelDropdown from "@/Components/ui/ChannelDropdown";
import { botApiUrl } from "@/lib/botApi";
import type { ChannelRule, ChannelRuleInput, LinkRuleMode, LinkType } from "@/types/ChannelRule";
import type { DiscordChannel } from "@/types/DiscordTypes";

const LINK_TYPES: { id: LinkType; label: string }[] = [
    { id: "youtube", label: "YouTube" },
    { id: "x", label: "X / Twitter" },
    { id: "instagram", label: "Instagram" },
    { id: "twitch", label: "Twitch" },
    { id: "kick", label: "Kick" },
    { id: "https", label: "Otros HTTPS" },
];

const MODES: { id: LinkRuleMode; label: string; description: string }[] = [
    { id: "contains", label: "Enlace con texto", description: "Cada mensaje tiene que incluir un enlace permitido; puede llevar texto." },
    { id: "linksOnly", label: "Solo enlaces", description: "Cada mensaje tiene que ser solo enlaces permitidos, sin texto." },
];

const LINK_LABEL = new Map(LINK_TYPES.map((type) => [type.id, type.label]));
const MODE_LABEL = new Map(MODES.map((mode) => [mode.id, mode.label]));

interface Draft extends ChannelRuleInput {
    id: string | null;
    enabled: boolean;
}

type Feedback = { type: "success" | "error"; text: string } | null;

async function readJson(res: Response): Promise<{ message?: string; error?: string; data?: unknown }> {
    return res.json().catch(() => ({}));
}

const emptyDraft = (): Draft => ({ id: null, channelId: "", type: "linkRestriction", allowedTypes: [], mode: "contains", enabled: true });

interface ChannelRuleManagerProps {
    /** Lo controla el "Atrás" del encabezado: al pasar a false se vuelve al listado. */
    editing: boolean;
    setEditing: (editing: boolean) => void;
}

export default function ChannelRuleManager({ editing, setEditing }: ChannelRuleManagerProps) {
    const params = useParams();
    const idServer = (params?.server as string) || "";

    const [rules, setRules] = useState<ChannelRule[]>([]);
    const [channels, setChannels] = useState<DiscordChannel[]>([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);
    const [draft, setDraft] = useState<Draft>(emptyDraft);
    const [formError, setFormError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<Feedback>(null);
    const [saving, setSaving] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<ChannelRule | null>(null);

    const loadRules = useCallback(async (signal?: AbortSignal) => {
        try {
            const res = await fetch(botApiUrl(idServer, "channelRule"), { signal, cache: "no-store" });
            const data = await readJson(res);
            if (!res.ok) throw new Error(data.message || data.error || `Error ${res.status}`);
            setRules(Array.isArray(data.data) ? (data.data as ChannelRule[]) : []);
            setListError(null);
        } catch (error) {
            if (signal?.aborted) return;
            setListError(error instanceof Error ? error.message : "No se pudieron cargar las reglas.");
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [idServer]);

    useEffect(() => {
        if (!idServer) return;
        const controller = new AbortController();
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadRules(controller.signal);
        fetch(`/api/guilds/${idServer}/channels`, { signal: controller.signal })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data && !controller.signal.aborted) setChannels(data.channels ?? []);
            })
            .catch(() => undefined);
        return () => controller.abort();
    }, [idServer, loadRules]);

    useEffect(() => {
        if (!pendingDelete) return;
        const close = (event: KeyboardEvent) => {
            if (event.key === "Escape") setPendingDelete(null);
        };
        window.addEventListener("keydown", close);
        return () => window.removeEventListener("keydown", close);
    }, [pendingDelete]);

    const channelName = (channelId: string) => {
        const channel = channels.find((item) => item.id === channelId);
        return channel ? `#${channel.name}` : channelId;
    };

    const openForm = (rule: ChannelRule | null) => {
        setDraft(rule
            ? { id: rule.id, channelId: rule.channelId, type: rule.type, allowedTypes: [...rule.allowedTypes], mode: rule.mode, enabled: rule.enabled }
            : emptyDraft());
        setFormError(null);
        setFeedback(null);
        setEditing(true);
    };

    const toggleType = (type: LinkType) => {
        setDraft((current) => ({
            ...current,
            allowedTypes: current.allowedTypes.includes(type)
                ? current.allowedTypes.filter((item) => item !== type)
                : LINK_TYPES.map((item) => item.id).filter((id) => id === type || current.allowedTypes.includes(id)),
        }));
    };

    const save = async () => {
        if (!draft.channelId) {
            setFormError("Elegí un canal.");
            return;
        }
        if (draft.allowedTypes.length === 0) {
            setFormError("Elegí al menos un tipo de enlace permitido.");
            return;
        }
        setFormError(null);
        setSaving(true);
        try {
            const body: ChannelRuleInput = {
                channelId: draft.channelId,
                type: draft.type,
                allowedTypes: draft.allowedTypes,
                mode: draft.mode,
                enabled: draft.enabled,
            };
            const res = await fetch(botApiUrl(idServer, draft.id ? `channelRule/${draft.id}` : "channelRule"), {
                method: draft.id ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await readJson(res);
            if (!res.ok) {
                setFormError(data.message || data.error || `Error ${res.status} al guardar.`);
                return;
            }
            setFeedback({ type: "success", text: data.message || "Regla guardada." });
            await loadRules();
            setEditing(false);
        } catch {
            setFormError("No se pudo conectar con el servidor.");
        } finally {
            setSaving(false);
        }
    };

    const toggleEnabled = async (rule: ChannelRule) => {
        setRules((list) => list.map((item) => (item.id === rule.id ? { ...item, enabled: !rule.enabled } : item)));
        const res = await fetch(botApiUrl(idServer, `channelRule/${rule.id}/enabled`), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled: !rule.enabled }),
        }).catch(() => null);
        if (!res?.ok) {
            const data = res ? await readJson(res) : {};
            setListError(data.message || data.error || "No se pudo cambiar el estado de la regla.");
            await loadRules();
        }
    };

    const remove = async (rule: ChannelRule) => {
        setPendingDelete(null);
        const res = await fetch(botApiUrl(idServer, `channelRule/${rule.id}`), { method: "DELETE" }).catch(() => null);
        if (!res?.ok) {
            const data = res ? await readJson(res) : {};
            setListError(data.message || data.error || "No se pudo eliminar la regla.");
        } else {
            setFeedback({ type: "success", text: "Regla eliminada." });
        }
        await loadRules();
    };

    if (editing) {
        return (
            <div className="mx-auto mt-6 max-w-xl space-y-5">
                <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-zinc-300">Tipo de regla</span>
                    <p className="text-sm text-white">Restricción de enlaces</p>
                    <p className="text-[11px] text-zinc-500">El bot borra los mensajes del canal que no cumplan la regla.</p>
                </div>

                <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-zinc-300">Canal *</span>
                    <ChannelDropdown
                        channels={channels}
                        value={draft.channelId || null}
                        onChange={(channelId) => setDraft((current) => ({ ...current, channelId }))}
                    />
                </div>

                <fieldset className="space-y-2">
                    <legend className="text-xs font-semibold text-zinc-300">Enlaces permitidos *</legend>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {LINK_TYPES.map((type) => (
                            <label
                                key={type.id}
                                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs ${draft.allowedTypes.includes(type.id)
                                    ? "border-[#5865F2] bg-[#5865F2]/15 text-white"
                                    : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={draft.allowedTypes.includes(type.id)}
                                    onChange={() => toggleType(type.id)}
                                    className="accent-[#5865F2]"
                                />
                                {type.label}
                            </label>
                        ))}
                    </div>
                </fieldset>

                <fieldset className="space-y-2">
                    <legend className="text-xs font-semibold text-zinc-300">Modo</legend>
                    {MODES.map((mode) => (
                        <label
                            key={mode.id}
                            className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 ${draft.mode === mode.id
                                ? "border-[#5865F2] bg-[#5865F2]/15"
                                : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                        >
                            <input
                                type="radio"
                                name="channel-rule-mode"
                                checked={draft.mode === mode.id}
                                onChange={() => setDraft((current) => ({ ...current, mode: mode.id }))}
                                className="mt-0.5 accent-[#5865F2]"
                            />
                            <span>
                                <span className="block text-xs font-semibold text-white">{mode.label}</span>
                                <span className="block text-[11px] text-zinc-400">{mode.description}</span>
                            </span>
                        </label>
                    ))}
                </fieldset>

                <label className="flex cursor-pointer items-center gap-3 text-xs text-zinc-300">
                    <input
                        type="checkbox"
                        checked={draft.enabled}
                        onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))}
                        className="accent-[#5865F2]"
                    />
                    Regla activa
                </label>

                {formError && (
                    <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{formError}</div>
                )}

                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={save}
                        disabled={saving}
                        className="rounded-xl bg-[#5865F2] px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#5865F2]/20 hover:bg-[#4752c4] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    >
                        {saving ? "Guardando..." : "Guardar"}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto mt-6 max-w-4xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-zinc-400">Reglas que el bot aplica a los mensajes de un canal.</p>
                <button
                    type="button"
                    onClick={() => openForm(null)}
                    className="rounded-xl bg-[#5865F2] px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#5865F2]/20 hover:bg-[#4752c4] cursor-pointer"
                >
                    + Nueva regla
                </button>
            </div>

            {listError && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{listError}</div>}
            {feedback && (
                <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">{feedback.text}</div>
            )}

            {loading ? (
                <p className="text-xs text-zinc-400">Cargando reglas...</p>
            ) : rules.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-xs text-zinc-400">Todavía no hay reglas de canal.</p>
            ) : (
                <ul className="divide-y divide-white/5 rounded-xl border border-white/10 bg-[#12141e]">
                    {rules.map((rule) => (
                        <li key={rule.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                            <div className="min-w-0 space-y-1">
                                <p className="text-sm font-semibold text-white">{channelName(rule.channelId)}</p>
                                <p className="text-[11px] text-zinc-400">
                                    {MODE_LABEL.get(rule.mode) ?? rule.mode} · {rule.allowedTypes.map((type) => LINK_LABEL.get(type) ?? type).join(", ")}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={rule.enabled}
                                    aria-label={`Activar la regla de ${channelName(rule.channelId)}`}
                                    title={rule.enabled ? "Activa" : "Inactiva"}
                                    onClick={() => toggleEnabled(rule)}
                                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${rule.enabled ? "bg-[#23a55a]" : "bg-[#4e5058]"}`}
                                >
                                    <span
                                        aria-hidden="true"
                                        className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${rule.enabled ? "translate-x-[23px]" : "translate-x-[3px]"}`}
                                    />
                                </button>
                                <button type="button" onClick={() => openForm(rule)} className="rounded-lg px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5 cursor-pointer">
                                    Editar
                                </button>
                                <button type="button" onClick={() => setPendingDelete(rule)} className="rounded-lg px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 cursor-pointer">
                                    Eliminar
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {pendingDelete && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) setPendingDelete(null);
                    }}
                >
                    <div
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="delete-rule-title"
                        className="w-full max-w-md space-y-5 rounded-2xl border border-white/10 bg-[#1e1f22] p-6 text-white shadow-2xl sm:p-7"
                    >
                        <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-2.5 text-xl text-red-400">🗑️</div>
                            <div>
                                <h3 id="delete-rule-title" className="text-lg font-bold tracking-tight">Eliminar regla</h3>
                                <p className="text-xs text-zinc-400">Esta acción no se puede deshacer</p>
                            </div>
                        </div>
                        <p className="text-sm leading-relaxed text-zinc-300">
                            ¿Seguro que querés eliminar la regla del canal &quot;<span className="font-semibold text-white">{channelName(pendingDelete.channelId)}</span>&quot;? El bot dejará de aplicarla.
                        </p>
                        <div className="flex gap-2 pt-1">
                            <button
                                type="button"
                                autoFocus
                                onClick={() => setPendingDelete(null)}
                                className="flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-white/10 cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => remove(pendingDelete)}
                                className="flex-1 rounded-xl bg-[#da373c] py-2.5 text-xs font-semibold text-white shadow-lg shadow-red-500/20 hover:bg-[#a12828] cursor-pointer"
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
