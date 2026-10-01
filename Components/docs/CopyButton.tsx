"use client"

import { useState } from "react";

export default function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    };

    return (
        <button
            type="button"
            onClick={copy}
            aria-label="Copiar código"
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-zinc-300 opacity-0 transition-opacity hover:bg-white/10 focus:opacity-100 group-hover:opacity-100 cursor-pointer"
        >
            {copied ? "Copiado" : "Copiar"}
        </button>
    );
}
