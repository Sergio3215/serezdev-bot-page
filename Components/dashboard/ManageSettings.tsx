"use client"
import { ManageSettingType } from "@/types/Elements";
import ButtonDiscord from "@/Components/ui/ButtonDiscord";
import dynamic from "next/dynamic";
import { useState } from "react";

function FeatureLoading() {
    return <p className="mt-6 text-center text-xs text-zinc-400">Cargando...</p>;
}

const InteractionManage = dynamic(() => import("@/Components/gifs/InteractionManage"), { loading: FeatureLoading });
const BirthdaySetup = dynamic(() => import("@/Components/birthday/BirthdaySetup"), { loading: FeatureLoading });
const JoinServerSetup = dynamic(() => import("@/Components/welcome/JoinServerSetup"), { loading: FeatureLoading });
const PricingPlans = dynamic(() => import("@/Components/billing/PricingPlans"), { loading: FeatureLoading });
const CustomCommandManager = dynamic(() => import("@/Components/customCommands/CustomCommandManager"), { loading: FeatureLoading });
const ChannelRuleManager = dynamic(() => import("@/Components/channelRules/ChannelRuleManager"), { loading: FeatureLoading });
const ScheduledTaskManager = dynamic(() => import("@/Components/scheduledTasks/ScheduledTaskManager"), { loading: FeatureLoading });

export default function ManageSetting({ title, state, setState, birthdaySetup }: ManageSettingType) {
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
                {
                    state === "birthday" && (
                        <>
                            <BirthdaySetup initialSetup={birthdaySetup} />
                        </>
                    )
                }
                {
                    state === "joinServer" && (
                        <>
                            <JoinServerSetup />
                        </>
                    )
                }
                {
                    state === "customCommand" && (
                        <>
                            <CustomCommandManager editing={newFlag} setEditing={setNewFlag} />
                        </>
                    )
                }
                {
                    state === "channelRule" && (
                        <ChannelRuleManager editing={newFlag} setEditing={setNewFlag} />
                    )
                }
                {
                    state === "scheduledTask" && (
                        <ScheduledTaskManager editing={newFlag} setEditing={setNewFlag} />
                    )
                }
                {
                    state === "billing" && (
                        <>
                            <PricingPlans />
                        </>
                    )
                }
            </div>
        </>
    )
}