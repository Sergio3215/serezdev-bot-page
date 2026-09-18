"use client"

import { InteractionDataType, interactionManage, InteractionName } from "@/types/Elements";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react"
import AddGifs from "./AddGifs";
import GifButtons from "./GifsButtons";


export default function InteractionManage({ newFlag, setNewFlag }: interactionManage) {
    const params = useParams();
    const idServer = (params?.server as string) || "";

    const [interactions, setInteractions] = useState<InteractionName[]>();
    const [gifsItems, setGifsItems] = useState<InteractionDataType[]>();
    const [selectedInteraction, setSelectedInteraction] = useState<string>();

    const getCategory = async () => {
        const ftch = await fetch("https://server-serez-dev-bot-production.up.railway.app/api/v1/getInteractions");

        const res = await ftch.json();

        setInteractions(res.data);
        if (res.data && res.data.length > 0) {
            setSelectedInteraction(res.data[0].name);
        }
    }

    const getGifs = async () => {
        if (!selectedInteraction) return;
        const ftch = await fetch(`https://server-serez-dev-bot-production.up.railway.app/api/v1/getInteractionByName?name=${selectedInteraction}&serverId=${idServer}`);

        const res = await ftch.json();

        setGifsItems(res.data);
    }

    useEffect(() => {
        getCategory();
    }, []);

    useEffect(() => {
        if (selectedInteraction) {
            getGifs();
        }
    }, [selectedInteraction, idServer]);

    useEffect(() => {
        if (!newFlag) {
            getGifs();
        }
    }, [newFlag])

    const goBack = () => {
        setNewFlag(false);
    }


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
            <div>
                {
                    gifsItems?.map(g => {
                        return (
                            <div key={g.id}>
                                <div className="text-center text-3xl capitalize underline">
                                    {g.name.replaceAll("chocar5", "Chocar los 5").replaceAll("FelizCumple", "feliz cumple").replaceAll("-", " en ")}
                                </div>
                                <div className="flex flex-wrap gap-1 my-4">
                                    {
                                        g.gifs.map((gg, index) => {
                                            return (
                                                <div key={gg.id || index} className="m-5">
                                                    <div className="text-center">{gg.order}</div>
                                                    <div className="border-2 border-b-gray-400 rounded-xl flex flex-col justify-center items-center w-fit h-30 overflow-hidden mb-5">
                                                        <div>
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img width={150} src={gg.url} alt={`GIF ${gg.order}`} />
                                                        </div>
                                                    </div>
                                                    <GifButtons
                                                        gifsItem={gg}
                                                        gifsArray={g}
                                                        index={index} />
                                                </div>
                                            )
                                        })
                                    }
                                </div>
                            </div>
                        )
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