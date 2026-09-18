import { ButtonDiscordType } from "@/types/Elements";


export default function ButtonDiscord({ title, onClick }: ButtonDiscordType) {

    return (
        <button className="inline-flex items-center gap-2 rounded-xl bg-[#5865F2] shadow-[#5865F2]/20 hover:bg-[#4752c4] px-5 py-2.5 text-xs font-semibold text-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-2 cursor-pointer" onClick={onClick}>
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