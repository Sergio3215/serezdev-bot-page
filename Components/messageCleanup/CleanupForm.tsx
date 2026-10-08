"use client"

import { useState } from "react";
import ChannelDropdown from "@/Components/ui/ChannelDropdown";
import { botApiUrl } from "@/lib/botApi";
import {
    CLEANUP_KINDS,
    PINNED_MESSAGES_NOTE,
    TIME_ERRORS,
    changeDraftUnit,
    channelConflict,
    cleanupErrorMessage,
    prepareCleanupSave,
    type ApiErrorBody,
    type CleanupDraftErrors,
    type CleanupLists,
} from "@/lib/messageCleanup";
import type { DiscordChannel } from "@/types/DiscordTypes";
import type { CleanupDraft, CleanupKind } from "@/types/MessageCleanup";
import CleanupTimeInput from "./CleanupTimeInput";
import StatusSwitch from "./StatusSwitch";

interface CleanupFormProps {
    kind: CleanupKind;
    idServer: string;
    initialDraft: CleanupDraft;
    channels: DiscordChannel[];
    channelsLoading: boolean;
    lists: CleanupLists;
    onSaved: (message: string) => void;
}

/** Formulario de Auto Clean o Ghost: valida localmente, guarda por el proxy y conserva lo escrito si la API falla. */
export default function CleanupForm({ kind, idServer, initialDraft, channels, channelsLoading, lists, onSaved }: CleanupFormProps) {
    const config = CLEANUP_KINDS[kind];
    const [draft, setDraft] = useState(initialDraft);
    const [submitErrors, setSubmitErrors] = useState<CleanupDraftErrors>({});
    const [apiError, setApiError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const update = (next: CleanupDraft) => {
        setDraft(next);
        setSubmitErrors({});
    };

    // Avisos en vivo: el conflicto de canal apenas se elige, y el tiempo inválido apenas se escribe o se cambia la unidad.
    const prepared = prepareCleanupSave(kind, draft, lists);
    const liveErrors = prepared.ok ? {} : prepared.errors;
    const channelError = submitErrors.channelId ?? channelConflict(kind, draft.channelId, lists, draft.id) ?? undefined;
    const valueError = submitErrors.value ?? (draft.value.trim() !== "" && liveErrors.value !== TIME_ERRORS.empty ? liveErrors.value : undefined);

    const save = async () => {
        if (saving) return;
        if (!prepared.ok) {
            setSubmitErrors(prepared.errors);
            return;
        }
        setSaving(true);
        setApiError(null);
        try {
            const res = await fetch(botApiUrl(idServer, draft.id ? `${config.endpoint}/${draft.id}` : config.endpoint), {
                method: draft.id ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(prepared.payload),
            });
            const data: ApiErrorBody = await res.json().catch(() => ({}));
            if (!res.ok) {
                setApiError(cleanupErrorMessage(kind, res.status, data, "No se pudo guardar la configuración."));
                return;
            }
            onSaved(config.saved);
        } catch {
            setApiError(cleanupErrorMessage(kind, 0, {}, ""));
        } finally {
            setSaving(false);
        }
    };

    const timeId = `cleanup-${kind}-time`;

    return (
        <div className="mx-auto mt-6 max-w-xl space-y-5">
            <div>
                <h2 className="text-lg font-semibold text-white">{draft.id ? "Editar configuración" : "Nueva configuración"}</h2>
                <p className="mt-1 text-xs text-zinc-400">{config.intro}</p>
            </div>

            <div className="space-y-1.5">
                <span className="text-xs font-semibold text-zinc-300">Canal *</span>
                <ChannelDropdown
                    channels={channels}
                    loading={channelsLoading}
                    value={draft.channelId || null}
                    onChange={(channelId) => update({ ...draft, channelId })}
                />
                {channelError && <p role="alert" className="text-[11px] text-red-300">{channelError}</p>}
            </div>

            <CleanupTimeInput
                id={timeId}
                label={config.timeLabel}
                value={draft.value}
                unit={draft.unit}
                error={valueError}
                onValueChange={(value) => update({ ...draft, value })}
                onUnitChange={(unit) => update(changeDraftUnit(draft, unit))}
            />

            <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-zinc-300">Estado</span>
                <StatusSwitch
                    checked={draft.enabled}
                    label={draft.enabled ? "Desactivar al guardar" : "Activar al guardar"}
                    onChange={() => update({ ...draft, enabled: !draft.enabled })}
                />
                <span className="text-xs text-zinc-400">{draft.enabled ? "Activo" : "Inactivo"}</span>
            </div>

            <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-zinc-300">📌 {PINNED_MESSAGES_NOTE}</p>

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
