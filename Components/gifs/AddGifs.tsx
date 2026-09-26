"use client"

import { addGifsType, InteractionDataType } from "@/types/Elements";
import { useState, useEffect } from "react";
import { avisoParaFuente, normalizeImageUrl } from "@/lib/imageUrl";
import { useServerPlan } from "@/lib/useServerPlan";
import { PLAN_LIMITS, PLANS } from "@/lib/plans";

const API_URL = process.env.NEXT_PUBLIC_URL || "https://server-serez-dev-bot-production.up.railway.app";

async function countCustomGifs(interactionNames: string[], serverId: string): Promise<number> {
    const results = await Promise.all(
        interactionNames.map((name) =>
            fetch(`${API_URL}/api/v1/gif/getInteractionByName?name=${name}&serverId=${serverId}`)
                .then((res) => res.json())
                .then((res) => (res.data ?? []) as InteractionDataType[])
        )
    );
    return results.flat().reduce((total, item) => total + item.gifs.filter((g) => g.type === "custom").length, 0);
}

export default function AddGifs({ interactions, idServer, goBack, defaultInteraction }: addGifsType) {
    const [url, setUrl] = useState<string>("");
    const [interactionValue, setInteractionValue] = useState<string>(defaultInteraction || "0");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const plan = useServerPlan();
    const [customCount, setCustomCount] = useState<number | null>(null);

    const avisoUrl = url.trim() ? avisoParaFuente(normalizeImageUrl(url).source) : null;

    const gifLimit = plan ? PLAN_LIMITS[plan].customGifs : null;
    const limited = gifLimit !== null;
    const limitReached = limited && customCount !== null && customCount >= gifLimit;
    const checkingLimit = plan === null || (limited && customCount === null);

    useEffect(() => {
        if (gifLimit === null) return;
        let cancelled = false;
        countCustomGifs(interactions.map((i) => i.name), idServer)
            .then((count) => {
                if (!cancelled) setCustomCount(count);
            })
            .catch(() => {
                if (!cancelled) setCustomCount(gifLimit);
            });
        return () => { cancelled = true; };
    }, [gifLimit, interactions, idServer]);

    // Bloquear scroll de la página mientras el modal esté abierto y cerrar con Escape
    useEffect(() => {
        document.body.style.overflow = "hidden";
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                goBack();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            document.body.style.overflow = "unset";
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [goBack]);

    const handlerSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const expression = /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
        const regex = new RegExp(expression);

        if (checkingLimit || limitReached) return;
        if (interactionValue === "0" || interactionValue === undefined) {
            setErrorMsg("Por favor, selecciona una interacción.");
            return;
        }
        if (!url.match(regex)) {
            setErrorMsg("Por favor, ingresa una URL de GIF válida.");
            return;
        }

        setErrorMsg("");
        setIsSubmitting(true);

        const body = {
            url: url,
            serverId: idServer,
            inter: interactionValue
        };

        try {
            const ftch = await fetch(`${process.env.NEXT_PUBLIC_URL || "https://server-serez-dev-bot-production.up.railway.app"}/api/v1/gif/addGif`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            await ftch.json();
            goBack();
        } catch {
            setErrorMsg("Error al agregar el GIF. Inténtalo de nuevo.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    goBack();
                }
            }}
        >
            <div className="bg-[#1e1f22] border border-white/10 rounded-2xl p-6 sm:p-8 w-full max-w-lg shadow-2xl text-white space-y-6 max-h-[90vh] overflow-y-auto">
                {/* Cabecera */}
                <div className="flex justify-between items-center pb-4 border-b border-white/10">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                            <span>Agregar nuevo GIF</span>
                        </h2>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            Añade un nuevo GIF personalizado a una interacción
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={goBack}
                        className="text-zinc-400 hover:text-white text-xl font-bold px-2 py-1 cursor-pointer transition-colors"
                        title="Cerrar"
                    >
                        &times;
                    </button>
                </div>

                {/* Previsualización del GIF */}
                <div className="flex flex-col items-center justify-center bg-[#111214] border border-white/10 rounded-xl p-3 min-h-[160px]">
                    {url.trim() ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                            src={url.trim()}
                            alt="Vista previa del nuevo GIF"
                            className="max-h-40 max-w-full rounded-lg object-contain"
                            onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                            }}
                            onLoad={(e) => {
                                (e.target as HTMLElement).style.display = "block";
                            }}
                        />
                    ) : (
                        <div className="flex flex-col items-center gap-2 text-zinc-500 text-xs">
                            <svg className="w-8 h-8 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>Ingresa una URL para previsualizar el GIF</span>
                        </div>
                    )}
                </div>

                {/* Formulario */}
                <form onSubmit={handlerSubmit} className="space-y-4">
                    {/* Campo URL */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-300">
                            URL del GIF <span className="text-red-400">*</span>
                        </label>
                        <input
                            name="url"
                            type="text"
                            value={url}
                            onChange={(e) => {
                                setUrl(e.target.value);
                                if (errorMsg) setErrorMsg("");
                            }}
                            // Al salir del campo convertimos los links de Drive/OneDrive
                            // a su URL directa; en onChange le reescribiríamos el texto
                            // mientras todavía está tipeando.
                            onBlur={(e) => {
                                const { url: convertida, changed } = normalizeImageUrl(e.target.value);
                                if (changed) setUrl(convertida);
                            }}
                            required
                            placeholder="https://media.tenor.com/..."
                            disabled={isSubmitting}
                            className="w-full bg-[#111214] border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#5865F2] focus:ring-1 focus:ring-[#5865F2] transition-colors disabled:opacity-50"
                        />

                        {avisoUrl ? (
                            <p className="text-[10px] leading-relaxed text-amber-400">{avisoUrl}</p>
                        ) : (
                            <p className="text-[10px] leading-relaxed text-zinc-500">
                                Los links de Google Drive y OneDrive se convierten solos, pero el archivo tiene que
                                estar compartido con <strong className="text-zinc-400">cualquier persona con el enlace</strong>.
                            </p>
                        )}
                    </div>

                    {/* Selector de Interacción */}
                    <div className="space-y-1.5">
                        <label htmlFor="dropdown-interacciones" className="text-xs font-semibold text-zinc-300">
                            Interacción <span className="text-red-400">*</span>
                        </label>
                        <select
                            id="dropdown-interacciones"
                            name="int"
                            required
                            disabled={isSubmitting}
                            value={interactionValue}
                            onChange={(e) => {
                                setInteractionValue(e.target.value);
                                if (errorMsg) setErrorMsg("");
                            }}
                            className="w-full bg-[#111214] border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#5865F2] focus:ring-1 focus:ring-[#5865F2] transition-colors cursor-pointer disabled:opacity-50"
                        >
                            <option className="bg-[#1e1f22] text-zinc-400" value="0">
                                Selecciona una interacción
                            </option>
                            {interactions.map((i, index) => (
                                <option className="bg-[#1e1f22] text-white capitalize" value={i.id} key={i.id || index}>
                                    {i.name.replaceAll("chocar5", "Chocar los 5").replaceAll("FelizCumple", "feliz cumple").replaceAll("-", " en ")}
                                </option>
                            ))}
                        </select>
                    </div>

                    {limited && plan && customCount !== null && (
                        <div className={`text-xs rounded-lg p-2.5 border ${limitReached
                            ? "text-amber-300 bg-amber-500/10 border-amber-500/30"
                            : "text-zinc-400 bg-white/5 border-white/10"
                            }`}>
                            {limitReached
                                ? `Llegaste al límite de ${gifLimit} GIFs personalizados del plan ${PLANS[plan].name}. Mejorá tu plan para agregar más.`
                                : `Plan ${PLANS[plan].name}: ${customCount} de ${gifLimit} GIFs personalizados usados.`}
                        </div>
                    )}

                    {/* Mensaje de Error */}
                    {errorMsg && (
                        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">
                            {errorMsg}
                        </div>
                    )}

                    {/* Botones de acción */}
                    <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                        <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={goBack}
                            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || checkingLimit || limitReached}
                            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#5865F2] hover:bg-[#4752c4] text-white shadow-lg shadow-[#5865F2]/25 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    <span>Agregando...</span>
                                </>
                            ) : (
                                <span>+ Agregar GIF</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}