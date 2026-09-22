interface DiscordRefreshButtonProps {
    resource: "roles" | "canales";
    loading: boolean;
    disabled?: boolean;
    onRefresh: () => void;
}

export default function DiscordRefreshButton({
    resource,
    loading,
    disabled = false,
    onRefresh,
}: DiscordRefreshButtonProps) {
    return (
        <button
            type="button"
            onClick={onRefresh}
            disabled={disabled || loading}
            title={`Volver a consultar los ${resource} en Discord`}
            aria-label={`Actualizar ${resource} desde Discord`}
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#111214] px-3.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-[#5865F2]/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
            <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            >
                <path d="M20 6v5h-5" />
                <path d="M4 18v-5h5" />
                <path d="M6.1 9a7 7 0 0 1 11.4-2.6L20 9" />
                <path d="m4 15 2.5 2.6A7 7 0 0 0 17.9 15" />
            </svg>
            <span className="hidden sm:inline">{loading ? "Actualizando..." : "Actualizar"}</span>
        </button>
    );
}
