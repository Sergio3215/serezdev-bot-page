import type { LanguageContract } from "../contract/model";
import { tokenize } from "../tokenizer/tokenizer";

/** Categoría visual de un fragmento; `fn-*` usa la categoría de la función en el contrato. */
export type HighlightKind =
    | "keyword"
    | "literal"
    | "string"
    | "number"
    | "operator"
    | "comment"
    | "property"
    | "variable"
    | "invalid"
    | `fn-${string}`;

export interface HighlightRange {
    from: number;
    to: number;
    kind: HighlightKind;
}

/** Rangos a colorear, ordenados y sin solaparse, a partir de los tokens y comentarios. */
export function highlightRanges(contract: LanguageContract, source: string): HighlightRange[] {
    const keywordTypes = new Set(contract.lexical.keywords.values());
    const literalTypes = new Set(["true", "false", "null"].map((word) => contract.lexical.keywords.get(word)));
    const colon = contract.lexical.delimiters.get(":");
    const dot = contract.lexical.delimiters.get(".");
    const { tokens, trivia } = tokenize(source, contract);
    const significant = tokens.filter((token) => token.type !== "NEWLINE" && token.type !== "EOF");

    const ranges = significant.flatMap((token, index): HighlightRange[] => {
        let kind: HighlightKind | null = null;
        if (literalTypes.has(token.type)) kind = "literal";
        else if (keywordTypes.has(token.type)) kind = "keyword";
        else if (token.type === "STRING") kind = "string";
        else if (token.type === "NUMBER") kind = "number";
        else if (token.type === "OPERATOR") kind = "operator";
        else if (token.type === "UNSUPPORTED") kind = "invalid";
        else if (token.type === "IDENTIFIER") {
            const definition = contract.functionByName.get(token.raw);
            if (definition) kind = `fn-${definition.kind}`;
            else if (significant[index + 1]?.type === colon || significant[index - 1]?.type === dot) kind = "property";
            else kind = "variable";
        }
        return kind ? [{ from: token.loc.start.offset, to: token.loc.end.offset, kind }] : [];
    });
    for (const comment of trivia) ranges.push({ from: comment.loc.start.offset, to: comment.loc.end.offset, kind: "comment" });
    return ranges.filter((range) => range.to > range.from).sort((a, b) => a.from - b.from);
}
