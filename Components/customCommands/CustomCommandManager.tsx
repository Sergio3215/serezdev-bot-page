"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { botApiUrl } from "@/lib/botApi";
import { PLAN_LIMITS, PLANS } from "@/lib/plans";
import { useServerPlan } from "@/lib/useServerPlan";
import { effectiveRoleIds, normalizeCustomCommand, TRIGGER_TYPES } from "@/lib/customCommands";
import type { CustomCommand } from "@/types/CustomCommand";
import type { DiscordChannel, DiscordRole } from "@/types/DiscordTypes";
import { APPLIED_NOTICE, readJson, type Feedback } from "./feedback";

const CustomCommandEditor = dynamic(() => import("./CustomCommandEditor"), {
    loading: () => <p className="mt-6 text-center text-xs text-zinc-400">Cargando editor...</p>,
});

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
    const [target, setTarget] = useState<{ command: CustomCommand | null; key: number } | null>(null);
    const [pendingDelete, setPendingDelete] = useState<CustomCommand | null>(null);
    const [channels, setChannels] = useState<DiscordChannel[]>([]);
    const [serverRoles, setServerRoles] = useState<DiscordRole[] | null>(null);
    const [rolesError, setRolesError] = useState(false);
    const serverRoleIds = useMemo(() => serverRoles?.map((role) => role.id) ?? null, [serverRoles]);
    const lifetime = useRef<AbortController | null>(null);
    const channelsRequested = useRef(false);
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
            setCommands(Array.isArray(data.data) ? (data.data as Record<string, unknown>[]).map(normalizeCustomCommand) : []);
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
        lifetime.current = controller;
        channelsRequested.current = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadCommands(controller.signal);
        fetch(`/api/guilds/${idServer}/roles?includeManaged=1`, { signal: controller.signal })
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Error ${res.status}`))))
            .then((data: { roles?: DiscordRole[] }) => {
                if (!controller.signal.aborted) setServerRoles(data.roles ?? []);
            })
            .catch(() => {
                if (!controller.signal.aborted) setRolesError(true);
            });
        return () => controller.abort();
    }, [idServer, loadCommands]);

    useEffect(() => {
        if (!pendingDelete) return;
        const close = (event: KeyboardEvent) => {
            if (event.key === "Escape") setPendingDelete(null);
        };
        window.addEventListener("keydown", close);
        return () => window.removeEventListener("keydown", close);
    }, [pendingDelete]);

    const loadChannels = () => {
        const signal = lifetime.current?.signal;
        if (channelsRequested.current || !idServer || !signal) return;
        channelsRequested.current = true;
        fetch(`/api/guilds/${idServer}/channels`, { signal })
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Error ${res.status}`))))
            .then((data: { channels?: DiscordChannel[] }) => {
                if (!signal.aborted) setChannels(data.channels ?? []);
            })
            .catch(() => {
                if (!signal.aborted) channelsRequested.current = false;
            });
    };

    const openEditor = (command: CustomCommand | null) => {
        loadChannels();
        setTarget((current) => ({ command, key: (current?.key ?? 0) + 1 }));
        setEditing(true);
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
        setListNotice({ type: "success", text: APPLIED_NOTICE });
    };

    const remove = async (command: CustomCommand) => {
        setPendingDelete(null);
        const res = await fetch(botApiUrl(idServer, `customCommand/${command.id}`), { method: "DELETE" }).catch(() => null);
        if (!res?.ok) setListError("No se pudo borrar el comando.");
        else setListNotice({ type: "success", text: APPLIED_NOTICE });
        await loadCommands();
    };

    if (target && editing) {
        return (
            <CustomCommandEditor
                key={target.key}
                serverId={idServer}
                command={target.command}
                channels={channels}
                serverRoles={serverRoles}
                rolesError={rolesError}
                onSaved={() => loadCommands()}
            />
        );
    }

    return (
        <div className="mx-auto mt-6 max-w-4xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                    <p className="text-xs text-zinc-400">
                        El bot responde cuando un mensaje coincide con el comando según su tipo de trigger.{" "}
                        <a href="/docs/comandos" target="_blank" rel="noopener" className="text-[#aab1ff] underline underline-offset-2 hover:text-white">
                            Ver la guía de comandos
                        </a>
                    </p>
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
                    onClick={() => openEditor(null)}
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
                            <div className="min-w-0">
                                <span className="font-mono text-sm text-white">{command.command}</span>
                                {command.description && <p className="truncate text-[11px] text-zinc-400">{command.description}</p>}
                                <p className="text-[11px] text-zinc-500">
                                    {TRIGGER_TYPES.find((trigger) => trigger.id === command.triggerType)?.label}
                                    {" · "}
                                    {effectiveRoleIds(command.allowedRoleIds, serverRoleIds).length === 0
                                        ? "Todos pueden ejecutar"
                                        : `${effectiveRoleIds(command.allowedRoleIds, serverRoleIds).length} rol(es) permitidos`}
                                </p>
                            </div>
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
                                <button type="button" onClick={() => openEditor(command)} className="rounded-lg px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5 cursor-pointer">
                                    Editar
                                </button>
                                <button type="button" onClick={() => setPendingDelete(command)} className="rounded-lg px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 cursor-pointer">
                                    Borrar
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
                        aria-labelledby="delete-command-title"
                        className="w-full max-w-md space-y-5 rounded-2xl border border-white/10 bg-[#1e1f22] p-6 text-white shadow-2xl sm:p-7"
                    >
                        <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-2.5 text-xl text-red-400">🗑️</div>
                            <div>
                                <h3 id="delete-command-title" className="text-lg font-bold tracking-tight">Borrar comando</h3>
                                <p className="text-xs text-zinc-400">Esta acción no se puede deshacer</p>
                            </div>
                        </div>
                        <p className="text-sm leading-relaxed text-zinc-300">
                            ¿Seguro que querés borrar el comando &quot;<span className="font-mono font-semibold text-white">{pendingDelete.command}</span>&quot;? El bot no volverá a reconocerlo.
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
                                Borrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
