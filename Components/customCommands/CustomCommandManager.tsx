"use client"

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { botApiUrl } from "@/lib/botApi";
import { PLAN_LIMITS, PLANS } from "@/lib/plans";
import { useServerPlan } from "@/lib/useServerPlan";
import { generateSimpleSource, languageService, readSimpleSource, SimpleModelError, type SimpleAction } from "@/lib/custom-command-language";
import type { DiscordChannel, DiscordRole } from "@/types/DiscordTypes";
import CodeEditor, { type CodeEditorHandle } from "./editor/CodeEditor";
import SimpleCommandForm, { canShowInSimpleMode, SIMPLE_FUNCTIONS, simpleDiagnosticMessage } from "./SimpleCommandForm";

interface CustomCommand {
    id: string;
    command: string;
    code: string;
    enabled: boolean;
}

interface Draft {
    id: string | null;
    command: string;
    code: string;
    mode: "simple" | "advanced";
    actions: SimpleAction[];
    /** Último código generado por el modo simple; si el texto cambió, volver al modo simple lo reemplaza. */
    generated: string;
}

type Feedback = { type: "success" | "error"; text: string } | null;

const INITIAL_ACTIONS: SimpleAction[] = [{ functionName: SIMPLE_FUNCTIONS[0]?.name ?? "", values: {} }];

function generate(actions: SimpleAction[]): string {
    try {
        return generateSimpleSource(actions);
    } catch (error) {
        if (error instanceof SimpleModelError) return "";
        throw error;
    }
}

/** Mensaje según el reinicio que hizo el proxy tras editar, activar o borrar un comando. */
function restartNotice(res: Response): Feedback {
    return res.headers.get("X-Bot-Restart") === "scheduled"
        ? { type: "success", text: "El bot se reiniciará en 30 segundos para aplicar el cambio." }
        : { type: "success", text: "El bot aplica el cambio en unos segundos." };
}

async function readJson(res: Response): Promise<{ message?: string; error?: string; data?: unknown }> {
    return res.json().catch(() => ({}));
}

interface CustomCommandManagerProps {
    /** Lo controla el "Atrás" del encabezado: al pasar a false se vuelve a la lista. */
    editing: boolean;
    setEditing: (editing: boolean) => void;
}

export default function CustomCommandManager({ editing, setEditing }: CustomCommandManagerProps) {
    const params = useParams();
    const idServer = (params?.server as string) || "";

    const [commands, setCommands] = useState<CustomCommand[]>([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);
    const [listNotice, setListNotice] = useState<Feedback>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState<Feedback>(null);
    const [confirmSimple, setConfirmSimple] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<CustomCommand | null>(null);
    const [channels, setChannels] = useState<DiscordChannel[]>([]);
    const [roles, setRoles] = useState<DiscordRole[]>([]);
    const editorRef = useRef<CodeEditorHandle>(null);
    const plan = useServerPlan();
    const commandLimit = plan ? PLAN_LIMITS[plan].customCommands : null;
    const atLimit = commandLimit !== null && commands.length >= commandLimit;
    const activeCount = commands.filter((command) => command.enabled).length;
    const activeAtLimit = commandLimit !== null && activeCount >= commandLimit;

    const loadCommands = useCallback(async (signal?: AbortSignal) => {
        try {
            const res = await fetch(botApiUrl(idServer, "customCommand"), { signal, cache: "no-store" });
            const data = await readJson(res);
            if (!res.ok) throw new Error(data.message || data.error || `Error ${res.status}`);
            setCommands(Array.isArray(data.data) ? (data.data as CustomCommand[]) : []);
            setListError(null);
        } catch (error) {
            if (signal?.aborted) return;
            setListError(error instanceof Error ? error.message : "No se pudieron cargar los comandos.");
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [idServer]);

    useEffect(() => {
        if (!idServer) return;
        const controller = new AbortController();
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadCommands(controller.signal);
        const fetchList = <T,>(resource: "channels" | "roles", set: (items: T[]) => void) =>
            fetch(`/api/guilds/${idServer}/${resource}`, { signal: controller.signal })
                .then((res) => (res.ok ? res.json() : null))
                .then((data) => {
                    if (data && !controller.signal.aborted) set(data[resource] ?? []);
                })
                .catch(() => undefined);
        fetchList<DiscordChannel>("channels", setChannels);
        fetchList<DiscordRole>("roles", setRoles);
        return () => controller.abort();
    }, [idServer, loadCommands]);

    const deferredCode = useDeferredValue(draft?.code ?? "");
    const analysis = useMemo(() => (draft ? languageService.analyze(deferredCode) : null), [draft, deferredCode]);

    const openNew = () => {
        const code = generate(INITIAL_ACTIONS);
        setDraft({ id: null, command: "", code, mode: "simple", actions: INITIAL_ACTIONS, generated: code });
        setFeedback(null);
        setEditing(true);
    };

    const openExisting = (command: CustomCommand) => {
        const read = readSimpleSource(command.code);
        const actions = read && canShowInSimpleMode(read) ? read : null;
        setDraft(actions
            ? { id: command.id, command: command.command, code: command.code, mode: "simple", actions, generated: command.code }
            : { id: command.id, command: command.command, code: command.code, mode: "advanced", actions: INITIAL_ACTIONS, generated: "" });
        setFeedback(null);
        setConfirmSimple(false);
        setEditing(true);
    };

    const updateDraft = (patch: Partial<Draft>) => setDraft((current) => (current ? { ...current, ...patch } : current));

    const onActionsChange = (actions: SimpleAction[]) => {
        const code = generate(actions);
        updateDraft({ actions, code, generated: code });
    };

    const switchMode = (mode: Draft["mode"]) => {
        if (!draft || draft.mode === mode) return;
        if (mode === "simple" && draft.code !== draft.generated) {
            setConfirmSimple(true);
            return;
        }
        updateDraft({ mode });
    };

    const confirmSwitchToSimple = () => {
        if (!draft) return;
        const code = generate(draft.actions);
        updateDraft({ mode: "simple", code, generated: code });
        setConfirmSimple(false);
    };

    const formatCode = () => {
        const error = editorRef.current?.format() ?? null;
        setFeedback(error ? { type: "error", text: error } : null);
    };

    const save = async () => {
        if (!draft) return;
        const command = draft.command.trim();
        if (!command) return;
        const result = languageService.analyze(draft.code);
        if (!result.valid) {
            setFeedback({ type: "error", text: "Corregí los errores del código antes de guardar." });
            if (draft.mode === "advanced") editorRef.current?.goTo(result.diagnostics[0].loc.start.offset);
            return;
        }

        setSaving(true);
        setFeedback(null);
        try {
            const res = await fetch(botApiUrl(idServer, draft.id ? `customCommand/${draft.id}` : "customCommand"), {
                method: draft.id ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(draft.id ? { command, code: draft.code } : { command, code: draft.code, enabled: true }),
            });
            const data = await readJson(res);
            if (!res.ok) {
                setFeedback({ type: "error", text: data.message || data.error || `Error ${res.status} al guardar.` });
                return;
            }
            const saved = data.data as CustomCommand | undefined;
            updateDraft({ id: saved?.id ?? draft.id, command });
            const notice = restartNotice(res);
            const base = data.message || "Comando guardado.";
            setFeedback(draft.id
                ? { type: notice?.type ?? "success", text: notice ? `${base} ${notice.text}` : base }
                : { type: "success", text: `${base} El bot lo toma en unos segundos.` });
            await loadCommands();
        } catch {
            setFeedback({ type: "error", text: "No se pudo conectar con el servidor." });
        } finally {
            setSaving(false);
        }
    };

    const toggle = async (command: CustomCommand) => {
        setCommands((list) => list.map((item) => (item.id === command.id ? { ...item, enabled: !command.enabled } : item)));
        const res = await fetch(botApiUrl(idServer, `customCommand/${command.id}/status`), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled: !command.enabled }),
        }).catch(() => null);
        if (!res?.ok) {
            const data = res ? await readJson(res) : {};
            setListError(data.error || data.message || "No se pudo cambiar el estado del comando.");
            await loadCommands();
            return;
        }
        setListNotice(restartNotice(res));
    };

    const remove = async (command: CustomCommand) => {
        setPendingDelete(null);
        const res = await fetch(botApiUrl(idServer, `customCommand/${command.id}`), { method: "DELETE" }).catch(() => null);
        if (!res?.ok) setListError("No se pudo borrar el comando.");
        else setListNotice(restartNotice(res));
        await loadCommands();
    };

    if (draft && editing) {
        const diagnostics = analysis?.diagnostics ?? [];
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
                                            {draft.mode === "simple" && analysis
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

                <div className="flex flex-wrap items-end gap-4">
                    <label className="flex-1 space-y-1.5">
                        <span className="text-xs font-semibold text-zinc-300">Mensaje que activa el comando *</span>
                        <input
                            value={draft.command}
                            onChange={(event) => updateDraft({ command: event.target.value })}
                            placeholder="!hola"
                            className="w-full rounded-lg border border-white/10 bg-[#111214] px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-[#5865F2] focus:outline-none"
                        />
                    </label>
                    <div className="flex gap-1 rounded-xl border border-white/10 bg-[#1e1f22] p-1" role="tablist" aria-label="Modo de edición">
                        {([["simple", "Modo simple"], ["advanced", "Modo avanzado"]] as const).map(([mode, label]) => (
                            <button
                                key={mode}
                                type="button"
                                role="tab"
                                aria-selected={draft.mode === mode}
                                onClick={() => switchMode(mode)}
                                className={`rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer ${draft.mode === mode ? "bg-[#5865F2] text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}
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
                        Formatear: botón o Shift+Alt+F en el editor.
                    </p>
                )}
            </div>
        );
    }

    return (
        <div className="mx-auto mt-6 max-w-4xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                    <p className="text-xs text-zinc-400">El bot responde cuando un mensaje coincide exactamente con el texto del comando.</p>
                    {plan && (
                        <p className={`text-[11px] ${atLimit ? "text-amber-300" : "text-zinc-500"}`}>
                            {commandLimit === null
                                ? `${commands.length} comandos · Plan ${PLANS[plan].name}: sin límite`
                                : `${commands.length} de ${commandLimit} comandos · ${activeCount} activos · Plan ${PLANS[plan].name}`}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={openNew}
                    disabled={atLimit}
                    title={atLimit ? `Tu plan permite hasta ${commandLimit} comandos personalizados.` : undefined}
                    className="rounded-xl bg-[#5865F2] px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#5865F2]/20 hover:bg-[#4752c4] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                    + Nuevo comando
                </button>
            </div>
            {atLimit && (
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                    Llegaste al máximo de comandos de tu plan. Podés editar, activar o borrar los que ya tenés; para crear otro, borrá uno o mejorá el plan.
                </p>
            )}

            {listError && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{listError}</div>}
            {listNotice && (
                <div
                    role="status"
                    className={`rounded-xl border p-3 text-xs ${listNotice.type === "error" ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}
                >
                    {listNotice.text}
                </div>
            )}

            {loading ? (
                <p className="text-xs text-zinc-400">Cargando comandos...</p>
            ) : commands.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-xs text-zinc-400">Todavía no hay comandos personalizados.</p>
            ) : (
                <ul className="divide-y divide-white/5 rounded-xl border border-white/10 bg-[#12141e]">
                    {commands.map((command) => (
                        <li key={command.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                            <span className="font-mono text-sm text-white">{command.command}</span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={command.enabled}
                                    aria-label={`Activar ${command.command}`}
                                    title={!command.enabled && activeAtLimit
                                        ? `Tu plan permite hasta ${commandLimit} comandos activos. Desactivá otro para activar este.`
                                        : command.enabled ? "Activo" : "Inactivo"}
                                    disabled={!command.enabled && activeAtLimit}
                                    onClick={() => toggle(command)}
                                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] ${command.enabled ? "bg-[#23a55a]" : "bg-[#4e5058]"}`}
                                >
                                    <span
                                        aria-hidden="true"
                                        className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${command.enabled ? "translate-x-[23px]" : "translate-x-[3px]"}`}
                                    />
                                </button>
                                <button type="button" onClick={() => openExisting(command)} className="rounded-lg px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5 cursor-pointer">
                                    Editar
                                </button>
                                {pendingDelete?.id === command.id ? (
                                    <>
                                        <button type="button" onClick={() => remove(command)} className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/25 cursor-pointer">
                                            Confirmar
                                        </button>
                                        <button type="button" onClick={() => setPendingDelete(null)} className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/5 cursor-pointer">
                                            Cancelar
                                        </button>
                                    </>
                                ) : (
                                    <button type="button" onClick={() => setPendingDelete(command)} className="rounded-lg px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 cursor-pointer">
                                        Borrar
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
