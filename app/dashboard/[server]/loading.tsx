export default function Loading() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] text-white">
            <div className="flex flex-col items-center gap-4">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#5865F2] border-t-transparent"></div>
                <p className="text-sm text-zinc-400">Cargando servidor...</p>
            </div>
        </div>
    );
}
