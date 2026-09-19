"use client"

import { joinServerType } from "@/types/Elements";
import { DiscordRole } from "@/types/DiscordTypes";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import RoleDropdown from "./RoleDropdown";

const API_URL = "https://server-serez-dev-bot-production.up.railway.app/api/v1/joinServer/setup";

export default function JoinServerSetup() {
    const params = useParams();
    const idServer = (params?.server as string) || "";

    const [setup, setSetup] = useState<joinServerType | null>(null);
    const [selectedRole, setSelectedRole] = useState<string>("");
    const [originalRole, setOriginalRole] = useState<string>("");

    const [isConfiguring, setIsConfiguring] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const [roles, setRoles] = useState<DiscordRole[]>([]);
    const [loadingRoles, setLoadingRoles] = useState<boolean>(true);
    const [rolesError, setRolesError] = useState<string | null>(null);


    const loadSetup = useCallback(async (signal: AbortSignal) => {
        try {
            const res = await fetch(`${API_URL}?serverId=${idServer}`, { signal });
            if (!res.ok) throw new Error(`Error ${res.status}`);

            const dto = await res.json();
            const data: joinServerType | undefined = dto.data?.[0];

            if (data) {
                setSetup(data);
                setSelectedRole(data.setRole);
                setOriginalRole(data.setRole);
            }
        } catch (err) {
            if (signal.aborted) return;
            console.error("Error al obtener la configuración de bienvenida:", err);
            setFeedback({ type: "error", text: "No se pudo cargar la configuración de bienvenida." });
        } finally {
            if (!signal.aborted) setIsLoading(false);
        }
    }, [idServer]);

    const loadRoles = useCallback(async (signal: AbortSignal) => {
        try {
            const res = await fetch(`/api/guilds/${idServer}/roles`, { signal });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

            setRoles(data.roles || []);
        } catch (err) {
            if (signal.aborted) return;
            console.error("Error al obtener los roles:", err);
            setRolesError("No se pudieron cargar los roles del servidor.");
        } finally {
            if (!signal.aborted) setLoadingRoles(false);
        }
    }, [idServer]);


    useEffect(() => {
        if (!idServer) return;

        const controller = new AbortController();
        const { signal } = controller;

        // Los setState de estas dos ocurren después del await, nunca de forma sincrónica,
        // así que no provocan los renders en cascada que la regla busca evitar.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadSetup(signal);
        loadRoles(signal);

        return () => controller.abort();
    }, [idServer, loadSetup, loadRoles]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedRole) {
            setFeedback({ type: "error", text: "Elegí un rol antes de guardar." });
            return;
        }

        setIsSaving(true);
        setFeedback(null);

        const isUpdate = setup !== null;

        try {
            const res = await fetch(API_URL, {
                method: isUpdate ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                    isUpdate
                        ? { id: setup.id, serverId: idServer, roleId: selectedRole }
                        : { serverId: idServer, roleId: selectedRole }
                )
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                setFeedback({ type: "error", text: data.message || "Error al guardar la configuración." });
                return;
            }

            setOriginalRole(selectedRole);
            setFeedback({
                type: "success",
                text: data.message || (isUpdate ? "¡Rol de bienvenida actualizado!" : "¡Bienvenida configurada con éxito!")
            });

            // Tras crear, releemos para quedarnos con el id que necesita el PUT
            if (!isUpdate) {
                const dto = await fetch(`${API_URL}?serverId=${idServer}`).then(r => r.json()).catch(() => null);
                setSetup(dto?.data?.[0] ?? { id: "", serverId: idServer, roleId: selectedRole });
                setIsConfiguring(false);
            }
        } catch (err) {
            console.error("Error al guardar la configuración:", err);
            setFeedback({ type: "error", text: "Ocurrió un error al intentar conectar con el servidor." });
        } finally {
            setIsSaving(false);
        }
    };

    const hasChanges = selectedRole !== originalRole;
    const currentRole = roles.find(r => r.id === selectedRole);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-400 space-y-3">
                <div className="w-8 h-8 border-4 border-[#5865F2] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-medium">Cargando configuración de bienvenida...</p>
            </div>
        );
    }

    if (!setup && !isConfiguring) {
        return (
            <div className="max-w-3xl mx-auto my-6">
                <div className="bg-[#1e1f22] border border-white/10 rounded-2xl p-10 shadow-xl text-center space-y-5">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-[#5865F2]/10 border border-[#5865F2]/20 flex items-center justify-center text-3xl">
                        👋
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-xl font-bold text-white">Dale la bienvenida a cada miembro nuevo</h2>
                        <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                            Elegí un rol y el bot se lo va a asignar automáticamente a todo el que entre al servidor.
                        </p>
                    </div>

                    {feedback?.type === "error" && <p className="text-xs text-red-400">{feedback.text}</p>}

                    <button
                        type="button"
                        onClick={() => { setIsConfiguring(true); setFeedback(null); }}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] px-6 py-3 text-xs font-semibold text-white shadow-lg shadow-[#5865F2]/20 transition-all cursor-pointer"
                    >
                        Empezar a configurar &rarr;
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto my-6">
            <div className="bg-[#1e1f22] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="border-b border-white/10 pb-4">
                    <h2 className="text-xl font-bold text-white">👋 Bienvenida al Servidor</h2>
                    <p className="text-xs text-zinc-400 mt-1">
                        Elegí el rol que recibe automáticamente cada miembro nuevo al entrar.
                    </p>
                </div>

                {feedback && (
                    <div className={`p-3.5 rounded-xl text-sm border ${feedback.type === "success"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                        {feedback.type === "success" ? "✅" : "⚠️"} {feedback.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-zinc-300">
                            Rol de bienvenida <span className="text-red-400">*</span>
                        </label>

                        <RoleDropdown
                            roles={roles}
                            value={selectedRole}
                            onChange={(roleId) => { setSelectedRole(roleId); setFeedback(null); }}
                            disabled={isSaving}
                            loading={loadingRoles}
                            error={rolesError}
                        />
                    </div>

                    <div className="bg-[#111214] border border-white/10 rounded-xl p-4 text-sm text-zinc-200">
                        {currentRole ? (
                            <>
                                Cuando alguien entre al servidor, el bot le va a dar el rol{" "}
                                <span
                                    className="font-semibold px-1.5 py-0.5 rounded"
                                    style={{ color: currentRole.color, backgroundColor: `${currentRole.color}1a` }}
                                >
                                    @{currentRole.name}
                                </span>{" "}
                                automáticamente.
                            </>
                        ) : (
                            <span className="text-zinc-500">Elegí un rol para ver la vista previa...</span>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                        {hasChanges && setup && (
                            <button
                                type="button"
                                onClick={() => { setSelectedRole(originalRole); setFeedback(null); }}
                                disabled={isSaving}
                                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                            >
                                Descartar cambios
                            </button>
                        )}

                        <button
                            type="submit"
                            disabled={isSaving || !selectedRole || (setup !== null && !hasChanges)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#5865F2]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {isSaving ? (
                                <>
                                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    <span>Guardando...</span>
                                </>
                            ) : (
                                <span>{setup ? "Guardar Cambios" : "Guardar Configuración"}</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
