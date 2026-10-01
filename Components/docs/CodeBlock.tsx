import { highlightRanges, languageService, type HighlightKind } from "@/lib/custom-command-language";
import CopyButton from "./CopyButton";

const KIND_CLASSES: Record<string, string> = {
    keyword: "text-[#c792ea]",
    literal: "text-[#f78c6c]",
    string: "text-[#c3e88d]",
    number: "text-[#f78c6c]",
    operator: "text-[#89ddff]",
    comment: "italic text-[#6a737d]",
    property: "text-[#f07178]",
    variable: "text-[#eeffff]",
    invalid: "text-[#f23f43] line-through",
    "fn-reference": "text-[#ffcb6b]",
    "fn-query": "text-[#82aaff]",
    "fn-action": "font-semibold text-[#8c96ff]",
};

function classFor(kind: HighlightKind): string {
    return KIND_CLASSES[kind] ?? "text-[#eeffff]";
}

function Highlighted({ code }: { code: string }) {
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    for (const range of highlightRanges(languageService.contract, code)) {
        if (range.from < cursor) continue;
        if (range.from > cursor) parts.push(code.slice(cursor, range.from));
        parts.push(<span key={range.from} className={classFor(range.kind)}>{code.slice(range.from, range.to)}</span>);
        cursor = range.to;
    }
    if (cursor < code.length) parts.push(code.slice(cursor));
    return <>{parts}</>;
}

interface CodeBlockProps {
    code: string;
    /**
     * `valid`: tiene que pasar el análisis; si un cambio del contrato lo rompe, el build falla.
     * `invalid`: es un ejemplo de error; muestra el mensaje real del editor.
     * `fragment`: un pedazo de código que no es un programa completo.
     */
    expect?: "valid" | "invalid" | "fragment";
    /** Código de diagnóstico que debe aparecer en un ejemplo `invalid`. */
    errorCode?: string;
    title?: string;
}

export default function CodeBlock({ code, expect = "valid", errorCode, title }: CodeBlockProps) {
    const source = code.trim();
    let errorMessage: string | null = null;

    if (expect !== "fragment") {
        const analysis = languageService.analyze(source);
        if (expect === "valid" && !analysis.valid) {
            const details = analysis.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`).join("; ");
            throw new Error(`Ejemplo de la guía de comandos que dejó de ser válido:\n${source}\n${details}`);
        }
        if (expect === "invalid") {
            const diagnostic = errorCode ? analysis.diagnostics.find((item) => item.code === errorCode) : analysis.diagnostics[0];
            if (!diagnostic) throw new Error(`Ejemplo de error de la guía que ya no marca ${errorCode ?? "ningún error"}:\n${source}`);
            errorMessage = diagnostic.message;
        }
    }

    const border = expect === "invalid" ? "border-red-500/30" : "border-white/10";
    return (
        <figure className="my-4">
            <div className={`group relative overflow-hidden rounded-xl border ${border} bg-[#111214]`}>
                <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5">
                    <span className={`text-[10px] font-semibold uppercase tracking-wide ${expect === "invalid" ? "text-red-300" : "text-zinc-500"}`}>
                        {title ?? (expect === "invalid" ? "Incorrecto" : "Código")}
                    </span>
                    <CopyButton text={source} />
                </div>
                <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-[#eeffff]">
                    <code><Highlighted code={source} /></code>
                </pre>
            </div>
            {errorMessage && (
                <figcaption className="mt-1.5 text-xs text-red-300">
                    El editor marca: <span className="font-medium">{errorMessage}</span>
                </figcaption>
            )}
        </figure>
    );
}

/** Bloque para texto que no es código del lenguaje, como un mensaje escrito en Discord. */
export function TextBlock({ text, title = "En Discord" }: { text: string; title?: string }) {
    return (
        <figure className="my-4 overflow-hidden rounded-xl border border-white/10 bg-[#111214]">
            <div className="border-b border-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{title}</div>
            <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-zinc-300">{text.trim()}</pre>
        </figure>
    );
}
