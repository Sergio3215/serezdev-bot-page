"use client"

import { addGifsType } from "@/types/Elements";
import { useState } from "react"
import ButtonDiscord from "./ButtonDiscord";

export default function AddGifs({ interactions, idServer, goBack }: addGifsType) {

    const [url, setUrl] = useState<String>("");
    const [interactionValue, setInteractionValue] = useState<String>("0");

    const handlerSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const expression = /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
        const regex = new RegExp(expression);

        if (interactionValue == "0" || interactionValue == undefined) {
            return;
        }
        if (!(url.match(regex))) {
            return;
        }

        const body = {
            url: url,
            serverId: idServer,
            inter: interactionValue
        }

        const ftch = await fetch("https://server-serez-dev-bot-production.up.railway.app/api/v1/addGif", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        await ftch.json();

        goBack();

        // console.log(url, interactionValue)
    }

    return (
        <div className="flex justify-center mt-10">
            <form onSubmit={handlerSubmit} className="border-2 border-b-mist-100 px-20 py-8">
                <div>Agregar nuevo GIF</div>
                <div>
                    <input name="url" type="text" value={url.toString()} onChange={(e) => setUrl(e.target.value)} required className="border-blue-300 border-2 rounded-2xl px-2" placeholder="URL" />
                </div>
                <div className="my-5">
                    <select className="border-blue-300 border-2 rounded-2xl px-2" name="int" id="dropdown-interacciones" required onChange={(e) => setInteractionValue(e.target.value)} value={interactionValue?.toString()}>
                        <option className="text-black" selected value="0">Selecciona una interacción</option>
                        {
                            interactions.map((i, index) => {
                                return (
                                    <option className="text-black" value={i.id} key={index}>{i.name}</option>
                                )
                            })
                        }
                    </select>
                </div>
                <div>
                    <ButtonDiscord title="Agregar" onClick={() => { }} />
                    {/* <input type="submit" value="Agregar" /> */}
                </div>
            </form>
        </div>
    )
}