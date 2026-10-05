"use client"

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { botApiUrl } from "@/lib/botApi";
import { browserTimezone, describeSchedule, draftFromTask, emptyDraft } from "@/lib/scheduledTasks";
import type { DiscordChannel } from "@/types/DiscordTypes";
import type { ScheduledTask, ScheduledTaskDraft } from "@/types/ScheduledTask";
import ScheduledTaskForm from "./ScheduledTaskForm";

async function readJson(res: Response): Promise<{ message?: string; error?: string; data?: unknown }> {
    return res.json().catch(() => ({}));
}

interface ScheduledTaskManagerProps {
    /** Lo controla el "Atrás" del encabezado: al pasar a false se vuelve al listado. */
    editing: boolean;
    setEditing: (editing: boolean) => void;
}

export default function ScheduledTaskManager({ editing, setEditing }: ScheduledTaskManagerProps) {
    const params = useParams();
    const idServer = (params?.server as string) || "";

    const [tasks, setTasks] = useState<ScheduledTask[]>([]);
    const [channels, setChannels] = useState<DiscordChannel[]>([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [formDraft, setFormDraft] = useState<ScheduledTaskDraft | null>(null);
    const [pendingDelete, setPendingDelete] = useState<ScheduledTask | null>(null);

    const loadTasks = useCallback(async (signal?: AbortSignal) => {
        try {
            const res = await fetch(botApiUrl(idServer, "scheduledTask"), { signal, cache: "no-store" });
            const data = await readJson(res);
            if (!res.ok) throw new Error(data.message || data.error || `Error ${res.status}`);
            setTasks(Array.isArray(data.data) ? (data.data as ScheduledTask[]) : []);
            setListError(null);
        } catch (error) {
            if (signal?.aborted) return;
            setListError(error instanceof Error ? error.message : "No se pudieron cargar las tareas.");
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [idServer]);

    useEffect(() => {
        if (!idServer) return;
        const controller = new AbortController();
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadTasks(controller.signal);
        fetch(`/api/guilds/${idServer}/channels`, { signal: controller.signal })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data && !controller.signal.aborted) setChannels(data.channels ?? []);
            })
            .catch(() => undefined);
        return () => controller.abort();
    }, [idServer, loadTasks]);

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

    const openForm = (task: ScheduledTask | null) => {
        setFormDraft(task ? draftFromTask(task) : emptyDraft(browserTimezone()));
        setNotice(null);
        setEditing(true);
    };

    const onSaved = async (message: string) => {
        setNotice(message);
        await loadTasks();
        setEditing(false);
    };

    const toggle = async (task: ScheduledTask) => {
        setTasks((list) => list.map((item) => (item.id === task.id ? { ...item, enabled: !task.enabled } : item)));
        const res = await fetch(botApiUrl(idServer, `scheduledTask/${task.id}/status`), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled: !task.enabled }),
        }).catch(() => null);
        if (!res?.ok) {
            const data = res ? await readJson(res) : {};
            setListError(data.message || data.error || "No se pudo cambiar el estado de la tarea.");
            await loadTasks();
        }
    };

    const remove = async (task: ScheduledTask) => {
        setPendingDelete(null);
        const res = await fetch(botApiUrl(idServer, `scheduledTask/${task.id}`), { method: "DELETE" }).catch(() => null);
        if (!res?.ok) {
            const data = res ? await readJson(res) : {};
            setListError(data.message || data.error || "No se pudo eliminar la tarea.");
        } else {
            setNotice("Tarea eliminada.");
        }
        await loadTasks();
    };

    if (editing && formDraft) {
        return <ScheduledTaskForm key={formDraft.id ?? "new"} idServer={idServer} initialDraft={formDraft} channels={channels} onSaved={onSaved} />;
    }

    return (
        <div className="mx-auto mt-6 max-w-4xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-zinc-400">Mensajes que el bot envía solo, todos los días o algunos días de la semana.</p>
                <button
                    type="button"
                    onClick={() => openForm(null)}
                    className="rounded-xl bg-[#5865F2] px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#5865F2]/20 hover:bg-[#4752c4] cursor-pointer"
                >
                    + Nueva tarea
                </button>
            </div>

            {listError && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{listError}</div>}
            {notice && <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">{notice}</div>}

            {loading ? (
                <p className="text-xs text-zinc-400">Cargando tareas...</p>
            ) : tasks.length === 0 ? (
                <div className="space-y-3 rounded-xl border border-dashed border-white/15 p-6 text-center">
                    <p className="text-xs text-zinc-400">Todavía no hay tareas programadas.</p>
                    <button
                        type="button"
                        onClick={() => openForm(null)}
                        className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10 cursor-pointer"
                    >
                        Crear la primera tarea
                    </button>
                </div>
            ) : (
                <ul className="divide-y divide-white/5 rounded-xl border border-white/10 bg-[#12141e]">
                    {tasks.map((task) => (
                        <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                            <div className="min-w-0 space-y-0.5">
                                <p className="text-sm font-semibold text-white">{task.name}</p>
                                <p className="text-[11px] text-zinc-400">
                                    {channelName(task.channelId)} · {describeSchedule(task)} ({task.timezone})
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={task.enabled}
                                    aria-label={`Activar ${task.name}`}
                                    title={task.enabled ? "Activa" : "Inactiva"}
                                    onClick={() => toggle(task)}
                                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${task.enabled ? "bg-[#23a55a]" : "bg-[#4e5058]"}`}
                                >
                                    <span
                                        aria-hidden="true"
                                        className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${task.enabled ? "translate-x-[23px]" : "translate-x-[3px]"}`}
                                    />
                                </button>
                                <button type="button" onClick={() => openForm(task)} className="rounded-lg px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5 cursor-pointer">
                                    Editar
                                </button>
                                <button type="button" onClick={() => setPendingDelete(task)} className="rounded-lg px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 cursor-pointer">
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
                        aria-labelledby="delete-task-title"
                        className="w-full max-w-md space-y-5 rounded-2xl border border-white/10 bg-[#1e1f22] p-6 text-white shadow-2xl sm:p-7"
                    >
                        <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-2.5 text-xl text-red-400">🗑️</div>
                            <div>
                                <h3 id="delete-task-title" className="text-lg font-bold tracking-tight">Eliminar tarea</h3>
                                <p className="text-xs text-zinc-400">Esta acción no se puede deshacer</p>
                            </div>
                        </div>
                        <p className="text-sm leading-relaxed text-zinc-300">
                            ¿Seguro que querés eliminar la tarea &quot;<span className="font-semibold text-white">{pendingDelete.name}</span>&quot;? El bot dejará de enviar ese mensaje.
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
