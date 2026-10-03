"use client"

import { useEffect } from "react";

export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    const outdated = error.name === "ChunkLoadError" || /loading (css )?chunk/i.test(error.message);

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-4 text-white">
            <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-[#1e1f22] p-6 text-center shadow-2xl">
                <h2 className="text-lg font-bold">
                    {outdated ? "Hay una versión nueva del panel" : "Algo salió mal"}
                </h2>
                <p className="text-sm text-zinc-400">
                    {outdated
                        ? "Recargá la página para usar la última versión."
                        : "Recargá la página para seguir. Si vuelve a pasar, avisanos con el código de abajo."}
                </p>
                <div className="flex gap-2">
                    {!outdated && (
                        <button
                            type="button"
                            onClick={() => retry()}
                            className="flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-white/10 cursor-pointer"
                        >
                            Reintentar
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="flex-1 rounded-xl bg-[#5865F2] py-2.5 text-xs font-semibold text-white hover:bg-[#4752c4] cursor-pointer"
                    >
                        Recargar la página
                    </button>
                </div>
                {!outdated && (
                    <p className="break-all font-mono text-[10px] text-zinc-500">
                        {error.digest ?? error.message}
                    </p>
                )}
            </div>
        </div>
    );
}
