"use client"
import { ManageSettingType } from "@/types/Elements";
import InteractionManage from "./InteractionManage";
import ButtonDiscord from "./ButtonDiscord";
import { useState } from "react";

export default function ManageSetting({ title, state, setState }: ManageSettingType) {
    const [newFlag, setNewFlag] = useState<boolean>(false);

    return (
        <>
            <div className="flex justify-between">
                <button className="cursor-pointer hover:underline underline-offset-4" onClick={() => !newFlag ? setState("") : setNewFlag(false)}> &larr; Atras</button>
                <h1 className="text-3xl font-bold">{title}</h1>
                <div>
                    {
                        state === "gif" && !newFlag && (
                            <ButtonDiscord title="+ Nuevo" onClick={() => {
                                setNewFlag(true);
                            }} />
                        )
                    }
                </div>
            </div>
            <div>
                {
                    state === "gif" && (
                        <>
                            <InteractionManage newFlag={newFlag} setNewFlag={setNewFlag} />
                        </>
                    )
                }
            </div>
        </>
    )
}