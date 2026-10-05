"use client"

import { useState } from "react";
import ChannelDropdown from "@/Components/ui/ChannelDropdown";
import { botApiUrl } from "@/lib/botApi";
import { CONTENT_MAX_LENGTH, buildPayload, validateDraft, type DraftErrors } from "@/lib/scheduledTasks";
import type { DiscordChannel } from "@/types/DiscordTypes";
import type { ScheduledTaskDraft } from "@/types/ScheduledTask";
import ScheduleFields from "./ScheduleFields";

const inputClass = "w-full rounded-lg border border-white/10 bg-[#111214] px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-[#5865F2] focus:outline-none";

interface ScheduledTaskFormProps {
    idServer: string;
    initialDraft: ScheduledTaskDraft;
    channels: DiscordChannel[];
    onSaved: (message: string) => void;
}

/** Formulario de una tarea: valida localmente, guarda por el proxy y conserva lo escrito si la API falla. */
export default function ScheduledTaskForm({ idServer, initialDraft, channels, onSaved }: ScheduledTaskFormProps) {
    const [draft, setDraft] = useState(initialDraft);
    const [errors, setErrors] = useState<DraftErrors>({});
    const [apiError, setApiError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const update = (patch: Partial<ScheduledTaskDraft>) => setDraft((current) => ({ ...current, ...patch }));

    const save = async () => {
        if (saving) return;
        const found = validateDraft(draft);
        setErrors(found);
        if (Object.keys(found).length > 0) return;

        setSaving(true);
        setApiError(null);
        try {
            const res = await fetch(botApiUrl(idServer, draft.id ? `scheduledTask/${draft.id}` : "scheduledTask"), {
                method: draft.id ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildPayload(draft)),
            });
            const data: { message?: string; error?: string } = await res.json().catch(() => ({}));
            if (!res.ok) {
                setApiError(data.message || data.error || `Error ${res.status} al guardar.`);
                return;
            }
            onSaved(data.message || "Tarea guardada.");
        } catch {
            setApiError("No se pudo conectar con el servidor.");
        } finally {
            setSaving(false);
        }
    };

    const contentLength = draft.content.length;

    return (
        <div className="mx-auto mt-6 max-w-xl space-y-5">
            <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-zinc-300">Nombre interno *</span>
                <input
                    value={draft.name}
                    onChange={(event) => update({ name: event.target.value })}
                    placeholder="Aviso semanal"
                    className={inputClass}
                />
                {errors.name && <p className="text-[11px] text-red-300">{errors.name}</p>}
            </label>

            <div className="space-y-1.5">
                <span className="text-xs font-semibold text-zinc-300">Canal de destino *</span>
                <ChannelDropdown channels={channels} value={draft.channelId || null} onChange={(channelId) => update({ channelId })} />
                {errors.channelId && <p className="text-[11px] text-red-300">{errors.channelId}</p>}
            </div>

            <label className="block space-y-1.5">
                <span className="flex items-baseline justify-between">
                    <span className="text-xs font-semibold text-zinc-300">Mensaje *</span>
                    <span className={`text-[10px] ${contentLength > CONTENT_MAX_LENGTH ? "text-red-400" : "text-zinc-500"}`}>
                        {contentLength}/{CONTENT_MAX_LENGTH}
                    </span>
                </span>
                <textarea
                    rows={4}
                    value={draft.content}
                    maxLength={CONTENT_MAX_LENGTH}
                    onChange={(event) => update({ content: event.target.value })}
                    placeholder="Recordatorio de la reunión."
                    className={`${inputClass} resize-y`}
                />
                {errors.content && <p className="text-[11px] text-red-300">{errors.content}</p>}
            </label>

            <ScheduleFields draft={draft} errors={errors} onChange={update} />

            {apiError && (
                <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{apiError}</div>
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
