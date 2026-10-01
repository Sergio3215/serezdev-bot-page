const CONTROL_ESCAPES: Record<string, string> = {
    "\n": "\\n",
    "\r": "\\r",
    "\t": "\\t",
    "\b": "\\b",
    "\f": "\\f",
    "\v": "\\v",
    "\0": "\\0",
};

/** Imprime el valor de un string como literal válido; nunca cambia su contenido. */
export function printString(value: string, quote: "\"" | "'"): string {
    let output = quote;
    for (const char of value) {
        if (char === "\\") {
            output += "\\\\";
        } else if (char === quote) {
            output += `\\${quote}`;
        } else if (char in CONTROL_ESCAPES) {
            output += CONTROL_ESCAPES[char];
        } else {
            const code = char.codePointAt(0) ?? 0;
            output += code < 0x20 || code === 0x7f || code === 0x2028 || code === 0x2029
                ? `\\u${code.toString(16).toUpperCase().padStart(4, "0")}`
                : char;
        }
    }
    return output + quote;
}
