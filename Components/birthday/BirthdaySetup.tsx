"use client"

import { birthdayType } from "@/types/Elements";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import BirthdayCardEditor from "@/Components/birthday/BirthdayCardEditor";

export default function BirthdaySetup() {
    const params = useParams();
    const idServer = (params?.server as string) || "";

    const [tab, setTab] = useState<"message" | "image">("message");

    const [birthdayData, setBirthdayData] = useState<birthdayType | null>(null);
    const [message, setMessage] = useState<string>("");
    const [originalMessage, setOriginalMessage] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [statusFeedback, setStatusFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (!idServer) return;

        let isCancelled = false;

        fetch(`${process.env.NEXT_PUBLIC_URL || "https://server-serez-dev-bot-production.up.railway.app"}/api/v1/birthday/setup?serverId=${idServer}`)
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`Error ${res.status}`);
                }
                return res.json();
            })
            .then((dto) => {
                if (!isCancelled) {
                    const setup: birthdayType | undefined = dto.data?.[0];
                    if (setup) {
                        setBirthdayData(setup);
                        setMessage(setup.message || "");
                        setOriginalMessage(setup.message || "");
                    }
                }
            })
            .catch((err) => {
                if (!isCancelled) {
                    console.error("Error al obtener la configuración de cumpleaños:", err);
                    setStatusFeedback({
                        type: "error",
                        text: "No se pudo cargar la configuración de cumpleaños del servidor."
                    });
                }
            })
            .finally(() => {
                if (!isCancelled) {
                    setIsLoading(false);
                }
            });

        return () => {
            isCancelled = true;
        };
    }, [idServer]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!idServer) {
            setStatusFeedback({ type: "error", text: "ID de servidor no encontrado." });
            return;
        }

        if (!message.trim()) {
            setStatusFeedback({ type: "error", text: "El mensaje no puede estar vacío." });
            return;
        }

        setIsSaving(true);
        setStatusFeedback(null);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_URL || "https://server-serez-dev-bot-production.up.railway.app"}/api/v1/birthday/setup`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    serverId: idServer,
                    message: message
                })
            });

            const data = await res.json();

            if (res.ok) {
                setOriginalMessage(message);
                setStatusFeedback({
                    type: "success",
                    text: data.message || "¡Configuración de cumpleaños actualizada con éxito!"
                });
            } else {
                setStatusFeedback({
                    type: "error",
                    text: data.message || "Error al actualizar la configuración."
                });
            }
        } catch (err) {
            console.error("Error al actualizar la configuración:", err);
            setStatusFeedback({
                type: "error",
                text: "Ocurrió un error al intentar conectar con el servidor."
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleInsertVariable = (variable: string) => {
        if (!textareaRef.current) {
            setMessage((prev) => prev + variable);
            return;
        }

        const input = textareaRef.current;
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;

        const updated = message.substring(0, start) + variable + message.substring(end);
        setMessage(updated);

        // Restaurar cursor justo después de la variable insertada
        setTimeout(() => {
            input.focus();
            input.setSelectionRange(start + variable.length, start + variable.length);
        }, 0);
    };

    const hasChanges = message !== originalMessage;

    // Generar vista previa con reemplazo de variables
    const previewMessage = message
        ? message
            .replace(/\$nombre/g, "UsuarioEjemplo")
            .replace(/\$edad/g, "24")
        : "Escribe un mensaje para previsualizar...";

    // Las dos partes del saludo: el texto que manda el bot y la imagen que lo acompaña.
    const tabBar = (
        <div className="flex gap-1 rounded-xl border border-white/10 bg-[#1e1f22] p-1">
            {([
                { id: "message", label: "💬 Mensaje" },
                { id: "image", label: "🎂 Imagen de cumpleaños" },
            ] as const).map((item) => (
                <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`flex-1 rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${tab === item.id
                        ? "bg-[#5865F2] text-white shadow-lg shadow-[#5865F2]/20"
                        : "text-zinc-400 hover:text-white"}`}
                >
                    {item.label}
                </button>
            ))}
        </div>
    );

    if (isLoading) {
        return (
            <div className="max-w-3xl mx-auto my-6 space-y-4">
                {tabBar}
                <div className="flex flex-col items-center justify-center py-16 text-zinc-400 space-y-3">
                    <div className="w-8 h-8 border-4 border-[#5865F2] border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm font-medium">Cargando configuración de cumpleaños...</p>
                </div>
            </div>
        );
    }

    // El canal sale de acá, no del editor: la imagen viaja adjunta a este mismo mensaje.
    if (tab === "image") {
        return (
            <div className="my-6 space-y-4">
                {tabBar}
                <BirthdayCardEditor channelId={birthdayData?.channelId ?? null} />
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto my-6 space-y-6">
            {tabBar}
            {/* Encabezado y datos del servidor */}
            <div className="bg-[#1e1f22] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <span>🎂 Edición de Mensaje de Cumpleaños</span>
                        </h2>
                        <p className="text-xs text-zinc-400 mt-1">
                            Personaliza el mensaje automático que enviará el bot en los cumpleaños.
                        </p>
                    </div>
                    {birthdayData?.serverName && (
                        <div className="inline-flex items-center gap-2 bg-[#2b2d31] border border-white/10 px-3 py-1.5 rounded-lg text-xs text-zinc-300 self-start sm:self-auto">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            <span className="font-semibold text-white">{birthdayData.serverName}</span>
                        </div>
                    )}
                </div>

                {/* Feedback de estado */}
                {statusFeedback && (
                    <div
                        className={`p-3.5 rounded-xl text-sm flex items-center justify-between border ${statusFeedback.type === "success"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-red-500/10 text-red-400 border-red-500/20"
                            }`}
                    >
                        <span className="flex items-center gap-2">
                            {statusFeedback.type === "success" ? "✅" : "⚠️"} {statusFeedback.text}
                        </span>
                        <button
                            type="button"
                            onClick={() => setStatusFeedback(null)}
                            className="text-zinc-400 hover:text-white text-base leading-none px-1"
                        >
                            &times;
                        </button>
                    </div>
                )}

                {/* Formulario */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label htmlFor="birthday-message" className="text-xs font-semibold text-zinc-300">
                                Mensaje de felicitación <span className="text-red-400">*</span>
                            </label>
                            <span className="text-xs text-zinc-500">{message.length} caracteres</span>
                        </div>

                        <textarea
                            id="birthday-message"
                            ref={textareaRef}
                            rows={4}
                            value={message}
                            onChange={(e) => {
                                setMessage(e.target.value);
                                if (statusFeedback) setStatusFeedback(null);
                            }}
                            disabled={isSaving}
                            placeholder="Ej: 🎉$nombre Feliz Cumpleaños 🎉 ¡Felices $edad años! ¡Pasalo muy lindo en este día tan especial!!!🎉"
                            className="w-full bg-[#111214] border border-white/15 rounded-xl p-3.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#5865F2] focus:ring-1 focus:ring-[#5865F2] transition-colors resize-y min-h-[100px] disabled:opacity-50"
                        />
                    </div>

                    {/* Chips de variables disponibles */}
                    <div className="space-y-1.5">
                        <span className="text-xs font-medium text-zinc-400">Variables dinámicas (haz clic para insertar):</span>
                        <div className="flex flex-wrap gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => handleInsertVariable("$nombre")}
                                className="inline-flex items-center gap-1.5 bg-[#2b2d31] hover:bg-[#35373c] border border-white/10 px-2.5 py-1 rounded-lg text-xs text-[#5865F2] font-mono transition-colors cursor-pointer"
                                title="Insertar variable $nombre"
                            >
                                <span className="font-bold">$nombre</span>
                                <span className="text-zinc-400 text-[11px]">(Nombre del usuario)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleInsertVariable("$edad")}
                                className="inline-flex items-center gap-1.5 bg-[#2b2d31] hover:bg-[#35373c] border border-white/10 px-2.5 py-1 rounded-lg text-xs text-[#5865F2] font-mono transition-colors cursor-pointer"
                                title="Insertar variable $edad"
                            >
                                <span className="font-bold">$edad</span>
                                <span className="text-zinc-400 text-[11px]">(Edad calculada)</span>
                            </button>
                        </div>
                    </div>

                    {/* Botones de acción */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                        {hasChanges && (
                            <button
                                type="button"
                                onClick={() => {
                                    setMessage(originalMessage);
                                    if (statusFeedback) setStatusFeedback(null);
                                }}
                                disabled={isSaving}
                                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                            >
                                Descartar cambios
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={isSaving || !hasChanges}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#5865F2]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {isSaving ? (
                                <>
                                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    <span>Guardando...</span>
                                </>
                            ) : (
                                <span>Guardar Cambios</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Vista previa en tiempo real */}
            <div className="bg-[#1e1f22] border border-white/10 rounded-2xl p-6 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                        <span>👁️ Vista previa del mensaje</span>
                    </h3>
                    <span className="text-[11px] bg-[#2b2d31] text-zinc-400 px-2 py-0.5 rounded border border-white/5">
                        Ejemplo simulado
                    </span>
                </div>
                <div className="bg-[#111214] border border-white/10 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#5865F2] flex items-center justify-center text-white font-bold text-sm shrink-0">
                            🤖
                        </div>
                        <div className="space-y-1 overflow-hidden">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white">Bot Cumpleañero</span>
                                <span className="bg-[#5865F2] text-white text-[10px] font-bold px-1.5 py-0.2 rounded">BOT</span>
                                <span className="text-[11px] text-zinc-500">Hoy a las 00:00</span>
                            </div>
                            <p className="text-sm text-zinc-200 whitespace-pre-wrap break-words">
                                {previewMessage}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
