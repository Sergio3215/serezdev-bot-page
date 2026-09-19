"use client"

import { InteractionDataType, interactionManage, InteractionName } from "@/types/Elements";
import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import AddGifs from "./AddGifs";
import GifButtons from "./GifsButtons";


export default function InteractionManage({ newFlag, setNewFlag }: interactionManage) {
    const params = useParams();
    const idServer = (params?.server as string) || "";

    const [interactions, setInteractions] = useState<InteractionName[]>();
    const [gifsItems, setGifsItems] = useState<InteractionDataType[]>();
    const [selectedInteraction, setSelectedInteraction] = useState<string>();

    useEffect(() => {
        let isCancelled = false;
        fetch("https://server-serez-dev-bot-production.up.railway.app/api/v1/gif/getInteractions")
            .then(res => res.json())
            .then(res => {
                if (!isCancelled) {
                    setInteractions(res.data);
                    if (res.data && res.data.length > 0) {
                        setSelectedInteraction(prev => prev || res.data[0].name);
                    }
                }
            })
            .catch(console.error);

        return () => {
            isCancelled = true;
        };
    }, []);

    const getGifs = useCallback(() => {
        if (!selectedInteraction) return;
        fetch(`https://server-serez-dev-bot-production.up.railway.app/api/v1/gif/getInteractionByName?name=${selectedInteraction}&serverId=${idServer}`)
            .then(res => res.json())
            .then(res => {
                setGifsItems(res.data);
            })
            .catch(console.error);
    }, [selectedInteraction, idServer]);

    useEffect(() => {
        if (selectedInteraction && !newFlag) {
            getGifs();
        }
    }, [selectedInteraction, newFlag, getGifs]);

    const goBack = () => {
        setNewFlag(false);
    };


    return (
        <>
            <div className="flex flex-wrap gap-2 my-4">
                {interactions?.map(i => {
                    if (!i) return null;
                    return (
                        <span
                            key={i.id}
                            onClick={() => setSelectedInteraction(i.name)}
                            className={`capitalize px-3 py-1.5 rounded-lg text-sm cursor-pointer border transition-colors ${selectedInteraction === i.name
                                ? "bg-indigo-600 border-indigo-500 text-white"
                                : "bg-white/5 border-white/10 hover:bg-white/10 text-gray-300"
                                }`}
                        >
                            {i.name.replaceAll("chocar5", "Chocar los 5").replaceAll("FelizCumple", "feliz cumple").replaceAll("-", " en ")}
                        </span>
                    );
                })}
            </div>
            <div className="mt-6 space-y-8">
                {
                    gifsItems?.map(g => {
                        const formattedName = g.name
                            .replaceAll("chocar5", "Chocar los 5")
                            .replaceAll("FelizCumple", "feliz cumple")
                            .replaceAll("-", " en ");

                        return (
                            <div key={g.id} className="space-y-4">
                                {/* Encabezado de la interacción */}
                                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-2xl font-bold tracking-tight text-white capitalize">
                                            {formattedName}
                                        </h3>
                                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                            {g.gifs.length} {g.gifs.length === 1 ? "GIF" : "GIFs"}
                                        </span>
                                    </div>
                                </div>

                                {/* Lista de GIFs */}
                                {g.gifs.length > 0 ? (
                                    <div className="flex flex-wrap gap-4 my-4">
                                        {
                                            g.gifs.map((gg, index) => {
                                                const isDefault = gg.url.includes("git");
                                                return (
                                                    <div
                                                        key={gg.id || index}
                                                        className="m-5 w-48 sm:w-52 group relative flex flex-col bg-[#1e1f22] border border-white/10 hover:border-indigo-500/40 rounded-2xl p-3.5 shadow-xl transition-all duration-200 hover:-translate-y-1 hover:shadow-indigo-500/10"
                                                    >
                                                        {/* Barra superior de la tarjeta */}
                                                        <div className="flex items-center justify-between w-full mb-2.5 px-0.5">
                                                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-zinc-300">
                                                                #{gg.order}
                                                            </span>
                                                            {isDefault ? (
                                                                <span className="text-[10px] font-medium text-zinc-500 bg-zinc-800/80 px-2 py-0.5 rounded">
                                                                    Default
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] font-medium text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                                                    Personalizado
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Contenedor del GIF */}
                                                        <div className="w-full h-36 rounded-xl overflow-hidden bg-[#111214] border border-white/5 flex items-center justify-center p-2 group-hover:border-white/10 transition-colors">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img
                                                                src={gg.url}
                                                                alt={`GIF ${gg.order} de ${formattedName}`}
                                                                className="max-h-full max-w-full object-contain rounded-lg transition-transform duration-300 group-hover:scale-105"
                                                            />
                                                        </div>

                                                        {/* Botones de acción */}
                                                        <div className="w-full flex justify-center mt-3 pt-2.5 border-t border-white/5">
                                                            <GifButtons
                                                                gifsItem={gg}
                                                                gifsArray={g}
                                                                index={index}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        }
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 px-4 bg-[#1e1f22]/50 border border-dashed border-white/10 rounded-2xl text-center my-4">
                                        <p className="text-sm text-zinc-400">No hay GIFs para esta interacción todavía.</p>
                                    </div>
                                )}
                            </div>
                        );
                    })
                }
            </div>
            {
                newFlag && (
                    <AddGifs
                        interactions={interactions || []}
                        idServer={idServer}
                        goBack={goBack}
                        defaultInteraction={interactions?.find(i => i.name === selectedInteraction)?.id}
                    />
                )
            }
        </>
    )
}