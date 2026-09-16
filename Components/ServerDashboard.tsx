"use client"

import { serverSelect } from "@/types/DiscordTypes";
import { useParams } from "next/navigation";
import { useState } from "react";
import Section from "./Section";

export default function ServerDashboard({ filteredGuilds }: serverSelect) {
    const params = useParams();
    const idServer = (params?.server as string) || "";

    const [isResetting, setIsResetting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

    const resetBot = async () => {
        setIsResetting(true);
        setStatusMessage(null);
        try {
            const res = await fetch("/api/bot/restart", {
                method: "POST",
            });
            const data = await res.json();
            if (res.ok) {
                setStatusMessage({ text: "¡Bot reiniciado con éxito!", isError: false });
            } else {
                setStatusMessage({ text: data.error || "Error al reiniciar el bot.", isError: true });
            }
        } catch (err) {
            console.error("Error al reiniciar bot:", err);
            setStatusMessage({ text: "Error de conexión al solicitar el reinicio.", isError: true });
        } finally {
            setIsResetting(false);
        }
    };

    console.log(filteredGuilds);

    return (
        <>
            {
                idServer !== "" && (
                    <div>
                        {filteredGuilds.map((ser) => {
                            if (ser.id !== idServer) return null;
                            return (
                                <div key={ser.id} className="space-y-6">
                                    <div>
                                        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">{ser.name}</h1>
                                        <hr className="mt-4 border-white/10" />
                                    </div>
                                    <div className="flex flex-col">
                                        <Section title="Administración de Interacciones">
                                            <button className="inline-flex items-center gap-2 rounded-xl bg-[#5865F2] shadow-[#5865F2]/20 hover:bg-[#4752c4] px-5 py-2.5 text-xs font-semibold text-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-2 cursor-pointer">
                                                Administrar
                                            </button>
                                        </Section>
                                        <Section title="Reiniciar el Bot">
                                            <button
                                                onClick={resetBot}
                                                disabled={isResetting}
                                                className="inline-flex items-center gap-2 rounded-xl bg-[#6e0a0a] px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#6e0a0a]/25 transition-all hover:bg-[#bd2e2e] disabled:opacity-50 disabled:cursor-not-allowed mb-2 cursor-pointer"
                                            >
                                                {isResetting ? (
                                                    <>
                                                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                                        <span>Reiniciando bot...</span>
                                                    </>
                                                ) : (
                                                    <span>Reiniciar Bot</span>
                                                )}
                                            </button>
                                        </Section>

                                        {statusMessage && (
                                            <div
                                                className={`mt-4 rounded-xl p-3 text-xs border ${statusMessage.isError
                                                    ? "border-red-500/30 bg-red-500/10 text-red-300"
                                                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                                    }`}
                                            >
                                                {statusMessage.text}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            }
        </>
    )
}