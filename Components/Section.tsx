import { SectionsType } from "../types/Elements"

export default function Section({ title, children }: SectionsType) {

    return (
        <div className="rounded-2xl border border-white/10 bg-[#12141e] px-15 py-4 shadow-xl max-w-lg w-full h-35">
            <div className="flex lg:flex-row sm:flex-col justify-between items-start">
                <h2 className="text-lg font-semibold text-white mb-4 mr-4">{title}</h2>
            </div>
            <div>
                {children}
            </div>
        </div>
    )
} 