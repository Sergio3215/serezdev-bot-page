"use client"

import { serverSelect } from "@/types/DiscordTypes";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import Section from "./Section";
import ManageSetting from "./ManageSettings";
import ButtonDiscord from "./ButtonDiscord";

export default function ServerDashboard({ filteredGuilds }: serverSelect) {
    const params = useParams();
    const idServer = (params?.server as string) || "";

    const [isResetting, setIsResetting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

    const [state, setState] = useState("");
    const [title, setTitle] = useState("");

    const [showBirthdayModal, setShowBirthdayModal] = useState<boolean>(false);

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

    const comprobateBirthdaySetup = async () => {
        try {
            const ftch = await fetch(`https://server-serez-dev-bot-production.up.railway.app/api/v1/birthday/setup?serverId=${idServer}`);
            const dto = await ftch.json();

            if (dto.data && dto.data.length !== 0) {
                setState("birthday");
                setTitle("Administrá el Recordatorio");
            } else {
                setShowBirthdayModal(true);
            }
        } catch (err) {
            console.error("Error al comprobar cumpleaños:", err);
            setShowBirthdayModal(true);
        }
    };

    // console.log(filteredGuilds);

    return (
        <>
            {
                idServer !== "" && (
                    <div>
                        {
                            state == "" && (
                                <Link href="/dashboard" className="cursor-pointer hover:underline underline-offset-4 relative bottom-3.5"> &larr; Atras</Link>
                            )
                        }
                        {filteredGuilds.map((ser) => {
                            if (ser.id !== idServer) return null;
                            return (
                                <div key={ser.id} className="space-y-6">
                                    <div>
                                        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">{ser.name}</h1>
                                        <hr className="mt-4 border-white/10" />
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex flex-row flex-wrap gap-6 justify-center items-center">
                                            {
                                                state == "" && (
                                                    <>
                                                        <Section title="Administrá el Recordatorio de Cumpleaños">
                                                            <ButtonDiscord onClick={() => {
                                                                comprobateBirthdaySetup();
                                                            }} title={`Administrar &rarr;`} />
                                                        </Section>
                                                        <Section title="Bienvenida al Servidor">
                                                            <ButtonDiscord onClick={() => {
                                                                setState("joinServer");
                                                                setTitle("Administrá la Bienvenida")
                                                            }} title={`Administrar &rarr;`} />
                                                        </Section>
                                                        <Section title="Administración de Interacciones">
                                                            <ButtonDiscord onClick={() => {
                                                                setState("gif");
                                                                setTitle("Administrador de Interacciones")
                                                            }} title={`Administrar &rarr;`} />
                                                        </Section>
                                                        <Section title="Reiniciar el Bot">
                                                            <button
                                                                onClick={resetBot}
                                                                disabled={isResetting}
                                                                className="inline-flex items-center gap-2 rounded-xl bg-[#6e0a0a] shadow-[#bd2e2e]/20 hover:bg-[#bd2e2e] px-6 py-4 text-xs font-semibold text-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-2 cursor-pointer"
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
                                                    </>
                                                )
                                            }
                                        </div>

                                        {
                                            state != "" && (
                                                <ManageSetting
                                                    state={state}
                                                    setState={setState}
                                                    title={title} />
                                            )
                                        }
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            }

            {/* Modal emergente cuando el recordatorio no está configurado */}
            {showBirthdayModal && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 transition-all"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowBirthdayModal(false);
                        }
                    }}
                >
                    <div className="bg-[#1e1f22] border border-white/10 rounded-2xl p-6 sm:p-7 w-full max-w-md shadow-2xl text-white space-y-5">
                        {/* Cabecera del Pop-up */}
                        <div className="flex justify-between items-center pb-3 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xl">
                                    🎂
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold tracking-tight text-white">Recordatorio no configurado</h3>
                                    <p className="text-xs text-zinc-400">Configuración requerida en Discord</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="text-zinc-400 hover:text-white text-2xl font-bold px-2 py-1 cursor-pointer transition-colors leading-none"
                                onClick={() => setShowBirthdayModal(false)}
                            >
                                &times;
                            </button>
                        </div>

                        {/* Cuerpo del Pop-up */}
                        <div className="space-y-3 text-xs text-zinc-300">
                            <p className="leading-relaxed">
                                Este servidor aún no tiene configurado el recordatorio de cumpleaños en la base de datos. Para activarlo, ejecuta el siguiente comando en cualquier canal de tu servidor de Discord:
                            </p>
                            <div className="bg-[#111214] border border-white/10 rounded-xl p-3.5 flex items-center justify-between">
                                <code className="text-[#5865F2] font-mono font-bold text-sm select-all">/setup-birthday</code>
                                <span className="text-[10px] bg-[#2b2d31] text-zinc-400 px-2 py-0.5 rounded border border-white/5 font-semibold">Comando Discord</span>
                            </div>
                            <p className="text-[11px] text-zinc-400 leading-relaxed">
                                Una vez que lo configures con el bot, vuelve a hacer clic en <strong>Administrar Recordatorio</strong> para personalizar el mensaje.
                            </p>
                        </div>

                        {/* Botón de acción */}
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={() => setShowBirthdayModal(false)}
                                className="w-full bg-[#5865F2] hover:bg-[#4752c4] py-2.5 rounded-xl text-xs font-semibold text-white shadow-lg shadow-[#5865F2]/20 transition-all cursor-pointer"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}