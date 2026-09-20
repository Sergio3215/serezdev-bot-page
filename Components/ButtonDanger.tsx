import { ButtonDiscordType } from "@/types/Elements";


export default function ButtonDanger({ title, onClick }: ButtonDiscordType) {

    return (
        <button className="inline-flex items-center gap-2 rounded-xl bg-[#6e0a0a] shadow-[#bd2e2e]/20 hover:bg-[#bd2e2e] px-6 py-4 text-xs font-semibold text-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-2 cursor-pointer" onClick={onClick}>
            {title.replaceAll("&rarr;", "").replaceAll("&larr;", "")}
            {
                title.includes("&rarr;") && <>
                    &rarr;
                </>
            }
            {
                title.includes("&larr;") && <>
                    &larr;
                </>
            }
        </button>
    )
}