"use client"

import { gifButtons } from "@/types/Elements";
import ButtonDanger from "./ButtonDanger";
import ButtonDiscord from "./ButtonDiscord";
import { useState, useRef, useEffect } from "react";

export default function GifButtons({ gifsItem, gifsArray, index }: gifButtons) {
    const [edit, setEdit] = useState(false);
    const [deleteItem, setDeleteItem] = useState(false);

    const [id, setId] = useState("");
    const [url, setUrl] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleted, setIsDeleted] = useState(false);
    const [, setTick] = useState(0);

    const containerRef = useRef<HTMLDivElement>(null);

    // Escuchar si otro gif fue borrado para reevaluar si este elemento ahora es el último
    useEffect(() => {
        const handleGifDeleted = () => {
            setTick((prev) => prev + 1);
        };
        window.addEventListener("gif-deleted", handleGifDeleted);
        return () => {
            window.removeEventListener("gif-deleted", handleGifDeleted);
        };
    }, []);

    // Bloquear scroll de la página al abrir modal y permitir cerrar con Escape
    useEffect(() => {
        if (edit || deleteItem) {
            document.body.style.overflow = "hidden";
            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === "Escape") {
                    setEdit(false);
                    setDeleteItem(false);
                    setErrorMsg("");
                }
            };
            window.addEventListener("keydown", handleKeyDown);
            return () => {
                document.body.style.overflow = "unset";
                window.removeEventListener("keydown", handleKeyDown);
            };
        } else {
            document.body.style.overflow = "unset";
        }
    }, [edit, deleteItem]);

    const handlerEdit = async (idItem: string, urlItem: string) => {
        const trimmedUrl = urlItem.trim();
        if (!trimmedUrl) {
            setErrorMsg("La URL no puede estar vacía.");
            return;
        }

        const expression = /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
        const regex = new RegExp(expression);
        if (!trimmedUrl.match(regex)) {
            setErrorMsg("Por favor, ingresa una URL válida.");
            return;
        }

        setIsLoading(true);
        setErrorMsg("");

        try {
            const ftch = await fetch("https://server-serez-dev-bot-production.up.railway.app/api/v1/editGif", {
                method: "put",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    url: trimmedUrl,
                    id: idItem
                })
            });

            if (!ftch.ok) {
                throw new Error("No se pudo actualizar el GIF.");
            }

            await ftch.text();

            // Actualizar el objeto gifsItem en memoria
            setUrl(trimmedUrl);

            // Actualizar la imagen directamente en el DOM para reflejar el cambio en pantalla
            const parentCard = containerRef.current?.closest(".m-5") as HTMLElement | null;
            const img = parentCard?.querySelector("img");
            if (img) {
                img.src = trimmedUrl;
            }

            setEdit(false);
        } catch (err: any) {
            setErrorMsg(err.message || "Error al actualizar la URL.");
        } finally {
            setIsLoading(false);
        }
    };

    const handlerDelete = async (idItem: string) => {
        setIsLoading(true);
        setErrorMsg("");

        try {
            const ftch = await fetch("https://server-serez-dev-bot-production.up.railway.app/api/v1/deleteGif", {
                method: "delete",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    id: idItem
                })
            });

            if (!ftch.ok) {
                throw new Error("No se pudo eliminar el GIF.");
            }

            await ftch.text();

            // Eliminar del array en memoria si existe
            if (gifsArray && Array.isArray(gifsArray.gifs)) {
                const itemIndex = gifsArray.gifs.findIndex((g: any) => g.id === idItem);
                if (itemIndex !== -1) {
                    gifsArray.gifs.splice(itemIndex, 1);
                }
            }

            // Animación y borrado del elemento completo (.m-5) del DOM
            const parentCard = containerRef.current?.closest(".m-5") as HTMLElement | null;
            if (parentCard) {
                parentCard.style.transition = "all 0.25s ease-out";
                parentCard.style.opacity = "0";
                parentCard.style.transform = "scale(0.9)";
                setTimeout(() => {
                    parentCard.remove();
                }, 250);
            }

            // Notificar a otros elementos para que el nuevo último gif muestre su botón de borrar
            window.dispatchEvent(new CustomEvent("gif-deleted"));

            setDeleteItem(false);
            setIsDeleted(true);
        } catch (err: any) {
            setErrorMsg(err.message || "Error al eliminar el GIF.");
        } finally {
            setIsLoading(false);
        }
    };

    if (isDeleted) {
        return null;
    }

    const isLast = gifsArray?.gifs?.length === index + 1;

    return (
        <div ref={containerRef}>
            {
                !gifsItem.url.includes("git") && (
                    <div className="flex flex-row gap-2" key={index}>
                        <ButtonDiscord
                            title="Editar"
                            onClick={() => {
                                setId(gifsItem.id);
                                setUrl(gifsItem.url || "");
                                setErrorMsg("");
                                setEdit(true);
                            }}
                        />
                        {
                            isLast && (
                                <ButtonDanger
                                    title="Borrar"
                                    onClick={() => {
                                        setId(gifsItem.id);
                                        setErrorMsg("");
                                        setDeleteItem(true);
                                    }}
                                />
                            )
                        }
                    </div>
                )
            }

            {/* Modal de Edición de URL */}
            {
                edit && (
                    <div
                        className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                setEdit(false);
                                setErrorMsg("");
                            }
                        }}
                    >
                        <div className="bg-[#1e1f22] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl text-white space-y-4">
                            <div className="flex justify-between items-center pb-2 border-b border-white/10">
                                <h3 className="text-lg font-bold tracking-tight">Editar GIF #{gifsItem.order}</h3>
                                <button
                                    className="text-zinc-400 hover:text-white text-xl font-bold px-2 py-1 cursor-pointer transition-colors"
                                    onClick={() => {
                                        setEdit(false);
                                        setErrorMsg("");
                                    }}
                                >
                                    &times;
                                </button>
                            </div>

                            {/* Previsualización del GIF */}
                            <div className="flex flex-col items-center justify-center bg-[#111214] border border-white/10 rounded-xl p-3 min-h-[140px]">
                                {url ? (
                                    <img
                                        src={url}
                                        alt="Vista previa"
                                        className="max-h-36 max-w-full rounded-lg object-contain"
                                        onError={(e) => {
                                            (e.target as HTMLElement).style.display = "none";
                                        }}
                                        onLoad={(e) => {
                                            (e.target as HTMLElement).style.display = "block";
                                        }}
                                    />
                                ) : (
                                    <span className="text-xs text-zinc-500">Ingresa una URL para previsualizar</span>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-zinc-300">Nueva URL del GIF</label>
                                <input
                                    type="text"
                                    value={url}
                                    onChange={(e) => {
                                        setUrl(e.target.value);
                                        setErrorMsg("");
                                    }}
                                    placeholder="https://media.tenor.com/..."
                                    className="w-full bg-[#111214] border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#5865F2] focus:ring-1 focus:ring-[#5865F2] transition-colors"
                                    disabled={isLoading}
                                />
                            </div>

                            {errorMsg && (
                                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">
                                    {errorMsg}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                                <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={() => {
                                        setEdit(false);
                                        setErrorMsg("");
                                    }}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={() => handlerEdit(id || gifsItem.id, url)}
                                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#5865F2] hover:bg-[#4752c4] text-white shadow-lg shadow-[#5865F2]/25 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                            <span>Guardando...</span>
                                        </>
                                    ) : (
                                        <span>Guardar Cambios</span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal de Confirmación de Borrado */}
            {
                deleteItem && (
                    <div
                        className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                setDeleteItem(false);
                                setErrorMsg("");
                            }
                        }}
                    >
                        <div className="bg-[#1e1f22] border border-red-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl text-white space-y-4">
                            <div className="flex justify-between items-center pb-2 border-b border-white/10">
                                <h3 className="text-lg font-bold tracking-tight text-red-400 flex items-center gap-2">
                                    <span>Eliminar GIF #{gifsItem.order}</span>
                                </h3>
                                <button
                                    className="text-zinc-400 hover:text-white text-xl font-bold px-2 py-1 cursor-pointer transition-colors"
                                    onClick={() => {
                                        setDeleteItem(false);
                                        setErrorMsg("");
                                    }}
                                >
                                    &times;
                                </button>
                            </div>

                            <p className="text-sm text-zinc-300">
                                ¿Estás seguro de que deseas eliminar este GIF? Esta acción eliminará el elemento de forma permanente.
                            </p>

                            {/* Previsualización del GIF a borrar */}
                            <div className="flex flex-col items-center justify-center bg-[#111214] border border-white/10 rounded-xl p-3">
                                <img
                                    src={gifsItem.url}
                                    alt="GIF a eliminar"
                                    className="max-h-32 max-w-full rounded-lg object-contain"
                                />
                            </div>

                            {errorMsg && (
                                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">
                                    {errorMsg}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                                <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={() => {
                                        setDeleteItem(false);
                                        setErrorMsg("");
                                    }}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={() => handlerDelete(id)}
                                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#6e0a0a] hover:bg-[#bd2e2e] text-white shadow-lg shadow-[#6e0a0a]/25 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                            <span>Eliminando...</span>
                                        </>
                                    ) : (
                                        <span>Sí, Eliminar</span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}