import { ButtonDiscordType } from "@/types/Elements";


export default function ButtonDanger({ title, onClick }: ButtonDiscordType) {

    return (
        <button className="inline-flex items-center gap-2 rounded-xl bg-[#6e0a0a] px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#6e0a0a]/25 transition-all hover:bg-[#bd2e2e] disabled:opacity-50 disabled:cursor-not-allowed mb-2 cursor-pointer" onClick={onClick}>
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