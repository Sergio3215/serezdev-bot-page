import { SectionsType } from "../types/Elements"

export default function Section({ title, children }: SectionsType) {

    return (
        <div className="rounded-2xl border border-white/10 bg-[#12141e] px-15 py-4 shadow-xl max-w-lg w-full lg:h-35 mb:h-48">
            <div className="flex flex-row justify-between items-start">
                <h2 className="text-lg font-semibold text-white mb-4 mr-4">{title}</h2>
            </div>
            <div>
                {children}
            </div>
        </div>
    )
} 