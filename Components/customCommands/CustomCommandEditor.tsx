"use client"

import { useDeferredValue, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { botApiUrl } from "@/lib/botApi";
import { generateSimpleSource, languageService, readSimpleSource, SimpleModelError, type SimpleAction } from "@/lib/custom-command-language";
import { buildCustomCommandPayload, effectiveRoleIds, TRIGGER_TYPES } from "@/lib/customCommands";
import type { CustomCommand, TriggerType } from "@/types/CustomCommand";
import type { DiscordChannel, DiscordRole } from "@/types/DiscordTypes";
import MultiSelectChips from "@/Components/shared/MultiSelectChips";
import type { CodeEditorHandle } from "./editor/CodeEditor";
import CommandPreview from "./CommandPreview";
import SimpleCommandForm, { canShowInSimpleMode, SIMPLE_FUNCTIONS, simpleDiagnosticMessage } from "./SimpleCommandForm";
import { APPLIED_NOTICE, readJson, type Feedback } from "./feedback";

const CodeEditor = dynamic(() => import("./editor/CodeEditor"), {
    loading: () => <div className="min-h-[220px] rounded-xl border border-white/10 bg-[#111214]" aria-hidden="true" />,
});

interface Draft {
    id: string | null;
    command: string;
    triggerType: TriggerType;
    code: string;
    description: string;
    allowedRoleIds: string[];
    mode: "simple" | "advanced";
    actions: SimpleAction[];
    /** Último código generado por el modo simple; si el texto cambió, volver al modo simple lo reemplaza. */
    generated: string;
}

const DESCRIPTION_MAX_LENGTH = 100;

const INITIAL_ACTIONS: SimpleAction[] = [{ functionName: SIMPLE_FUNCTIONS[0]?.name ?? "", values: {} }];

function generate(actions: SimpleAction[]): string {
    try {
        return generateSimpleSource(actions);
    } catch (error) {
        if (error instanceof SimpleModelError) return "";
        throw error;
    }
}

function initialDraft(command: CustomCommand | null): Draft {
    if (!command) {
        const code = generate(INITIAL_ACTIONS);
        return { id: null, command: "", triggerType: "include", code, description: "", allowedRoleIds: [], mode: "simple", actions: INITIAL_ACTIONS, generated: code };
    }
    const read = readSimpleSource(command.code);
    const actions = read && canShowInSimpleMode(read) ? read : null;
    const base = {
        id: command.id,
        command: command.command,
        triggerType: command.triggerType,
        code: command.code,
        description: command.description ?? "",
        allowedRoleIds: command.allowedRoleIds,
    };
    return actions
        ? { ...base, mode: "simple", actions, generated: command.code }
        : { ...base, mode: "advanced", actions: INITIAL_ACTIONS, generated: "" };
}

interface CustomCommandEditorProps {
    serverId: string;
    /** Null para crear un comando nuevo. */
    command: CustomCommand | null;
    channels: DiscordChannel[];
    /** Todos los roles del servidor, incluidos los administrados; null mientras cargan. */
    serverRoles: DiscordRole[] | null;
    rolesError: boolean;
    onSaved: () => Promise<void>;
}

export default function CustomCommandEditor({ serverId, command, channels, serverRoles, rolesError, onSaved }: CustomCommandEditorProps) {
    const [draft, setDraft] = useState<Draft>(() => initialDraft(command));
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState<Feedback>(null);
    const [confirmSimple, setConfirmSimple] = useState(false);
    const editorRef = useRef<CodeEditorHandle>(null);
    const serverRoleIds = useMemo(() => serverRoles?.map((role) => role.id) ?? null, [serverRoles]);
    const roles = useMemo(() => (serverRoles ?? []).filter((role) => !role.managed), [serverRoles]);

    const deferredCode = useDeferredValue(draft.code);
    const analysis = useMemo(() => languageService.analyze(deferredCode), [deferredCode]);

    const updateDraft = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

    const onActionsChange = (actions: SimpleAction[]) => {
        const code = generate(actions);
        updateDraft({ actions, code, generated: code });
    };

    const switchMode = (mode: Draft["mode"]) => {
        if (draft.mode === mode) return;
        if (mode === "simple" && draft.code !== draft.generated) {
            setConfirmSimple(true);
            return;
        }
        updateDraft({ mode });
    };

    const confirmSwitchToSimple = () => {
        const code = generate(draft.actions);
        updateDraft({ mode: "simple", code, generated: code });
        setConfirmSimple(false);
    };

    const formatCode = () => {
        const error = editorRef.current?.format() ?? null;
        setFeedback(error ? { type: "error", text: error } : null);
    };

    const save = async () => {
        const payload = buildCustomCommandPayload(draft, serverRoleIds, !draft.id);
        const trigger = payload.command;
        if (!trigger) return;
        const result = languageService.analyze(draft.code);
        if (!result.valid) {
            setFeedback({ type: "error", text: "Corregí los errores del código antes de guardar." });
            if (draft.mode === "advanced") editorRef.current?.goTo(result.diagnostics[0].loc.start.offset);
            return;
        }

        setSaving(true);
        setFeedback(null);
        try {
            const res = await fetch(botApiUrl(serverId, draft.id ? `customCommand/${draft.id}` : "customCommand"), {
                method: draft.id ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await readJson(res);
            if (!res.ok) {
                setFeedback({ type: "error", text: data.message || data.error || `Error ${res.status} al guardar.` });
                return;
            }
            const saved = data.data as CustomCommand | undefined;
            updateDraft({ id: saved?.id ?? draft.id, command: trigger, allowedRoleIds: payload.allowedRoleIds });
            const base = data.message || "Comando guardado.";
            setFeedback({ type: "success", text: `${base} ${draft.id ? APPLIED_NOTICE : "El bot lo toma en unos segundos."}` });
            await onSaved();
        } catch {
            setFeedback({ type: "error", text: "No se pudo conectar con el servidor." });
        } finally {
            setSaving(false);
        }
    };

    const diagnostics = analysis.diagnostics;
    return (
        <div className="mx-auto mt-6 max-w-4xl space-y-5">
            <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-[240px] flex-1 rounded-xl border border-white/10 bg-[#12141e] p-3">
                    <h3 className="mb-2 text-xs font-semibold text-zinc-300">
                        {diagnostics.length === 0 ? "Sin problemas" : `${diagnostics.length} problema${diagnostics.length === 1 ? "" : "s"}`}
                    </h3>
                    {diagnostics.length > 0 && (
                        <ul className="max-h-48 space-y-1 overflow-y-auto">
                            {diagnostics.map((diagnostic, index) => (
                                <li key={`${diagnostic.code}-${index}`}>
                                    <button
                                        type="button"
                                        disabled={draft.mode !== "advanced"}
                                        onClick={() => editorRef.current?.goTo(diagnostic.loc.start.offset)}
                                        className="w-full rounded-lg px-2 py-1 text-left text-xs text-red-300 hover:bg-white/5 disabled:cursor-default cursor-pointer"
                                    >
                                        {draft.mode === "advanced" && (
                                            <span className="font-mono text-zinc-500">{diagnostic.loc.start.line}:{diagnostic.loc.start.column + 1} </span>
                                        )}
                                        {draft.mode === "simple"
                                            ? simpleDiagnosticMessage(diagnostic, analysis.ast, draft.actions)
                                            : diagnostic.message}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="flex shrink-0 gap-2">
                    {draft.mode === "advanced" && (
                        <button type="button" onClick={formatCode} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-white/10 cursor-pointer">
                            Formatear
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={save}
                        disabled={saving || !draft.command.trim()}
                        className="rounded-xl bg-[#5865F2] px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#5865F2]/20 hover:bg-[#4752c4] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    >
                        {saving ? "Guardando..." : "Guardar"}
                    </button>
                </div>
            </div>

            {feedback && (
                <div
                    role="status"
                    className={`rounded-xl border p-3 text-xs ${feedback.type === "error" ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}
                >
                    {feedback.text}
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-zinc-300">Mensaje que activa el comando *</span>
                    <input
                        value={draft.command}
                        onChange={(event) => updateDraft({ command: event.target.value })}
                        placeholder="!hola"
                        className="w-full rounded-lg border border-white/10 bg-[#111214] px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-[#5865F2] focus:outline-none"
                    />
                </label>
                <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-zinc-300">Tipo de trigger</span>
                    <select
                        value={draft.triggerType}
                        onChange={(event) => updateDraft({ triggerType: event.target.value as TriggerType })}
                        className="w-full rounded-lg border border-white/10 bg-[#111214] px-3 py-2 text-sm text-white focus:border-[#5865F2] focus:outline-none"
                    >
                        {TRIGGER_TYPES.map((trigger) => (
                            <option key={trigger.id} value={trigger.id}>{trigger.label}</option>
                        ))}
                    </select>
                    <span className="block text-[11px] text-zinc-500">
                        {TRIGGER_TYPES.find((trigger) => trigger.id === draft.triggerType)?.description}
                    </span>
                </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                    <span className="flex items-baseline justify-between">
                        <span className="text-xs font-semibold text-zinc-300">Descripción</span>
                        <span className="text-[10px] text-zinc-500">{draft.description.length}/{DESCRIPTION_MAX_LENGTH}</span>
                    </span>
                    <input
                        value={draft.description}
                        maxLength={DESCRIPTION_MAX_LENGTH}
                        onChange={(event) => updateDraft({ description: event.target.value })}
                        placeholder="Describe brevemente qué hace este comando"
                        className="w-full rounded-lg border border-white/10 bg-[#111214] px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-[#5865F2] focus:outline-none"
                    />
                </label>
                <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-zinc-300">Roles permitidos</span>
                    <MultiSelectChips
                        items={(serverRoles ?? []).map((role) => ({ id: role.id, label: role.name, color: role.color }))}
                        selectedIds={effectiveRoleIds(draft.allowedRoleIds, serverRoleIds)}
                        onChange={(allowedRoleIds) => updateDraft({ allowedRoleIds })}
                        placeholder="+ Agregar rol"
                        emptyLabel={serverRoles === null && !rolesError ? "Cargando roles..." : "Todos pueden ejecutar"}
                        loading={serverRoles === null && !rolesError}
                        disabled={rolesError}
                    />
                    <span className="block text-[11px] text-zinc-500">
                        {rolesError
                            ? "No se pudieron cargar los roles; al guardar se conservan los permisos actuales."
                            : "Alcanza con tener uno de los roles. Sin roles, cualquiera puede ejecutarlo."}
                    </span>
                </div>
            </div>

            <div>
                <div className="flex gap-1 rounded-xl border border-white/10 bg-[#1e1f22] p-1" role="tablist" aria-label="Modo de edición">
                    {([["simple", "Modo simple"], ["advanced", "Modo avanzado"]] as const).map(([mode, label]) => (
                        <button
                            key={mode}
                            type="button"
                            role="tab"
                            aria-selected={draft.mode === mode}
                            onClick={() => switchMode(mode)}
                            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold cursor-pointer ${draft.mode === mode ? "bg-[#5865F2] text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {confirmSimple && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200" role="alertdialog">
                    <span>El código fue editado a mano. El modo simple lo va a reemplazar por lo que tengas en sus controles.</span>
                    <div className="flex gap-2">
                        <button type="button" onClick={confirmSwitchToSimple} className="rounded-lg bg-amber-500/20 px-3 py-1.5 font-semibold hover:bg-amber-500/30 cursor-pointer">Reemplazar</button>
                        <button type="button" onClick={() => setConfirmSimple(false)} className="rounded-lg px-3 py-1.5 hover:bg-white/10 cursor-pointer">Cancelar</button>
                    </div>
                </div>
            )}

            {draft.mode === "simple" ? (
                <SimpleCommandForm actions={draft.actions} onChange={onActionsChange} channels={channels} roles={roles} />
            ) : (
                <CodeEditor
                    ref={editorRef}
                    value={draft.code}
                    onChange={(code) => updateDraft({ code })}
                    onFormatError={(message) => setFeedback(message ? { type: "error", text: message } : null)}
                    ariaLabel="Código del comando personalizado"
                />
            )}

            {draft.mode === "advanced" && (
                <p className="text-[11px] text-zinc-500">
                    Formatear: botón o Shift+Alt+F en el editor. ¿Primera vez escribiendo código?{" "}
                    <a href="/docs/comandos" target="_blank" rel="noopener" className="text-[#aab1ff] underline underline-offset-2 hover:text-white">
                        Abrí la guía del modo avanzado
                    </a>
                    .
                </p>
            )}

            <CommandPreview serverId={serverId} code={draft.code} command={draft.command} channels={channels} roles={serverRoles ?? []} />
        </div>
    );
}
