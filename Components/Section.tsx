import { SectionsType } from "../types/Elements"

export default function Section({ title, children }: SectionsType) {

    return (
        <div className="rounded-2xl border border-white/10 bg-[#12141e] p-7 shadow-xl max-w-lg mb-5">
            <div className="flex flex-row justify-between items-start">
                <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
                {children}
            </div>
        </div>
    )
} 