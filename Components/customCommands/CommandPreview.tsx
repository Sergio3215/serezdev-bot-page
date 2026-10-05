"use client"

import { useState, type ReactNode } from "react";
import { botApiUrl } from "@/lib/botApi";
import type {
    CustomCommandPreview,
    CustomCommandPreviewAction,
    CustomCommandPreviewDiagnostic,
    CustomCommandPreviewEmbed,
    CustomCommandPreviewRequest,
} from "@/types/CustomCommand";
import type { DiscordChannel, DiscordRole } from "@/types/DiscordTypes";

interface CommandPreviewProps {
    serverId: string;
    code: string;
    command: string;
    channels: DiscordChannel[];
    roles: DiscordRole[];
}

const MENTION_PATTERN = /<@!?(\d{17,20})>/g;

function isPreview(value: unknown): value is CustomCommandPreview {
    if (!value || typeof value !== "object") return false;
    const preview = value as Partial<CustomCommandPreview>;
    return typeof preview.ok === "boolean" && Array.isArray(preview.actions) && Array.isArray(preview.diagnostics) && !!preview.context;
}

function memberNames(preview: CustomCommandPreview): Map<string, string> {
    const names = new Map(preview.context.mentionedMembers.map((member) => [member.id, member.displayName]));
    names.set(preview.context.author.id, preview.context.author.displayName);
    return names;
}

function MessageText({ text, names }: { text: string; names: Map<string, string> }) {
    const parts: ReactNode[] = [];
    let last = 0;
    for (const match of text.matchAll(MENTION_PATTERN)) {
        const index = match.index ?? 0;
        if (index > last) parts.push(text.slice(last, index));
        parts.push(
            <span key={index} className="rounded bg-[#5865F2]/30 px-0.5 text-[#c9cdfb]">
                @{names.get(match[1]) ?? match[1]}
            </span>
        );
        last = index + match[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return <p className="whitespace-pre-wrap break-words text-sm text-zinc-100">{parts}</p>;
}

function EmbedCard({ embed, names }: { embed: CustomCommandPreviewEmbed; names: Map<string, string> }) {
    return (
        <div className="max-w-md overflow-hidden rounded-md border-l-4 bg-[#2b2d31] p-3" style={{ borderLeftColor: embed.color ?? "#1e1f22" }}>
            {embed.author && (
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-white">
                    {embed.author.icon && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={embed.author.icon} alt="" className="h-5 w-5 rounded-full" />
                    )}
                    {embed.author.url ? <a href={embed.author.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{embed.author.name}</a> : embed.author.name}
                </div>
            )}
            {embed.title && (
                <p className="mb-1 text-sm font-semibold text-white">
                    {embed.url ? <a href={embed.url} target="_blank" rel="noopener noreferrer" className="text-[#00a8fc] hover:underline">{embed.title}</a> : embed.title}
                </p>
            )}
            {embed.description && <MessageText text={embed.description} names={names} />}
            {embed.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={embed.image} alt="" className="mt-2 max-h-64 rounded" />
            )}
            {embed.footer && (
                <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-400">
                    {embed.footer.icon && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={embed.footer.icon} alt="" className="h-4 w-4 rounded-full" />
                    )}
                    {embed.footer.text}
                </div>
            )}
        </div>
    );
}

function ActionItem({ action, preview, channels, roles }: { action: CustomCommandPreviewAction; preview: CustomCommandPreview; channels: DiscordChannel[]; roles: DiscordRole[] }) {
    const names = memberNames(preview);
    const channelName = (id: string) => (id === preview.context.channel.id
        ? `#${preview.context.channel.name} (el canal donde se escribió el comando)`
        : `#${channels.find((channel) => channel.id === id)?.name ?? id}`);

    if (action.type === "AddRole") {
        const role = roles.find((item) => item.id === action.roleId);
        return (
            <p className="text-sm text-zinc-200">
                Se agregaría el rol{" "}
                <span className="font-semibold" style={{ color: role?.color && role.color !== "#000000" ? role.color : undefined }}>@{role?.name ?? action.roleId}</span>
                {" "}a <span className="font-semibold">{action.memberName}</span>.
                {!role && <span className="block text-[11px] text-amber-300">Ese rol no existe en el servidor: en Discord la acción fallaría.</span>}
            </p>
        );
    }

    const header = action.type === "ReplyMessage" || action.type === "ReplyEmbed"
        ? "Respondería al mensaje del comando"
        : `Enviaría en ${channelName(action.channelId)}`;

    return (
        <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{header}</p>
            {action.message && <MessageText text={action.message} names={names} />}
            {(action.type === "ReplyEmbed" || action.type === "SendEmbed") && <EmbedCard embed={action.embed} names={names} />}
        </div>
    );
}

function DiagnosticList({ diagnostics }: { diagnostics: CustomCommandPreviewDiagnostic[] }) {
    return (
        <ul className="space-y-1">
            {diagnostics.map((diagnostic, index) => (
                <li key={`${diagnostic.code}-${index}`} className="text-xs text-red-300">
                    {diagnostic.line !== null && (
                        <span className="font-mono text-zinc-500">{diagnostic.line}:{(diagnostic.column ?? 0) + 1} </span>
                    )}
                    {diagnostic.message}
                </li>
            ))}
        </ul>
    );
}

export default function CommandPreview({ serverId, code, command, channels, roles }: CommandPreviewProps) {
    const [message, setMessage] = useState<string | null>(null);
    const [mention, setMention] = useState(false);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{ preview: CustomCommandPreview; code: string } | null>(null);
    const testMessage = message ?? command;

    const run = async () => {
        setRunning(true);
        setError(null);
        const request: CustomCommandPreviewRequest = { code, message: testMessage, mention };
        try {
            const res = await fetch(botApiUrl(serverId, "customCommand/preview"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(request),
            });
            const data: { data?: unknown; message?: string; error?: string } = await res.json().catch(() => ({}));
            if (!res.ok || !isPreview(data.data)) {
                setResult(null);
                setError(data.message || data.error || `Error ${res.status} al probar el comando.`);
                return;
            }
            setResult({ preview: data.data, code });
        } catch {
            setResult(null);
            setError("No se pudo conectar con el servidor.");
        } finally {
            setRunning(false);
        }
    };

    const preview = result?.preview;

    return (
        <section className="space-y-3 rounded-xl border border-white/10 bg-[#12141e] p-4" aria-labelledby="command-preview-title">
            <div>
                <h3 id="command-preview-title" className="text-sm font-semibold text-white">Probar comando</h3>
                <p className="text-[11px] text-zinc-500">
                    El bot ejecuta el código actual con un autor, un canal y menciones simulados. No envía mensajes ni cambia roles.
                </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
                <label className="block min-w-[220px] flex-1 space-y-1.5">
                    <span className="text-xs font-semibold text-zinc-300">Mensaje de prueba</span>
                    <input
                        value={testMessage}
                        maxLength={2000}
                        onChange={(event) => setMessage(event.target.value)}
                        placeholder="!hola"
                        className="w-full rounded-lg border border-white/10 bg-[#111214] px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-[#5865F2] focus:outline-none"
                    />
                </label>
                <label className="flex items-center gap-2 py-2 text-xs text-zinc-300 cursor-pointer">
                    <input type="checkbox" checked={mention} onChange={(event) => setMention(event.target.checked)} className="accent-[#5865F2]" />
                    Mencionar a un miembro
                </label>
                <button
                    type="button"
                    onClick={run}
                    disabled={running || !code.trim()}
                    className="rounded-xl border border-[#5865F2]/50 bg-[#5865F2]/15 px-5 py-2.5 text-xs font-semibold text-[#c9cdfb] hover:bg-[#5865F2]/25 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                    {running ? "Probando..." : "Probar"}
                </button>
            </div>

            {error && <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{error}</div>}

            {preview && (
                <div className="space-y-3" role="status">
                    {result.code !== code && (
                        <p className="text-[11px] text-amber-300">El código cambió desde esta prueba. Volvé a probar para ver el resultado actual.</p>
                    )}

                    {preview.stage === "compile" && (
                        <div className="space-y-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                            <p className="text-xs font-semibold text-red-200">El código tiene errores; no se ejecutó.</p>
                            <DiagnosticList diagnostics={preview.diagnostics} />
                        </div>
                    )}

                    {preview.stage !== "compile" && (
                        preview.actions.length === 0 ? (
                            preview.ok && <p className="text-xs text-zinc-400">El comando se ejecutó sin enviar mensajes ni hacer cambios.</p>
                        ) : (
                            <ol className="space-y-2">
                                {preview.actions.map((action, index) => (
                                    <li key={index} className="rounded-lg border border-white/10 bg-[#1e1f22] p-3">
                                        <ActionItem action={action} preview={preview} channels={channels} roles={roles} />
                                    </li>
                                ))}
                            </ol>
                        )
                    )}

                    {preview.stage === "runtime" && (
                        <div className="space-y-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                            <p className="text-xs font-semibold text-red-200">
                                {preview.actions.length > 0 ? "La ejecución se detuvo después de lo anterior por un error:" : "La ejecución se detuvo por un error:"}
                            </p>
                            <DiagnosticList diagnostics={preview.diagnostics} />
                        </div>
                    )}

                    <p className="text-[11px] text-zinc-500">
                        Contexto simulado: escribe {preview.context.author.displayName} en #{preview.context.channel.name}
                        {" · "}{preview.context.memberCount} miembros
                        {preview.context.mentionedMembers.length > 0 && ` · menciona a ${preview.context.mentionedMembers.map((member) => member.displayName).join(", ")}`}
                    </p>
                </div>
            )}
        </section>
    );
}
