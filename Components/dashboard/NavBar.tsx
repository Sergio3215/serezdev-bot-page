import Image from "next/image";
import { currentUser } from "@/types/DiscordTypes";

export default function NavBar({ user, displayName, handleLogout, loggingOut, getAvatarUrl }: currentUser) {
    return (
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0e1017]/80 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5865F2] shadow-lg shadow-[#5865F2]/25">
                        <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                        </svg>
                    </div>
                    <div>
                        <span className="font-bold text-lg text-white">Serez Dev Bot</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 rounded-full bg-white/5 border border-white/10 px-3 py-1.5">
                        <div className="relative h-7 w-7 overflow-hidden rounded-full ring-2 ring-[#5865F2]/50">
                            <Image
                                src={getAvatarUrl(user)}
                                alt={displayName}
                                width={28}
                                height={28}
                                className="h-full w-full object-cover"
                                unoptimized
                            />
                        </div>
                        <span className="hidden sm:inline-block text-xs font-medium text-zinc-200">
                            {displayName}
                        </span>
                    </div>

                    <button
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="flex items-center gap-1.5 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-all hover:bg-red-500 hover:text-white disabled:opacity-50 cursor-pointer"
                    >
                        <span>{loggingOut ? "Saliendo..." : "Cerrar Sesión"}</span>
                    </button>
                </div>
            </div>
        </header>
    )
}