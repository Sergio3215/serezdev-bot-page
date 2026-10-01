import type { LanguageContract } from "../contract/model";
import { DiagnosticBag, type Diagnostic, type Loc, type Position } from "../diagnostics";

export const IDENTIFIER = "IDENTIFIER";
export const STRING = "STRING";
export const NUMBER = "NUMBER";
export const OPERATOR = "OPERATOR";
export const NEWLINE = "NEWLINE";
export const UNSUPPORTED = "UNSUPPORTED";
export const EOF = "EOF";

export interface Token {
    /** Categoría: las fijas de arriba, o el tipo que el contrato asigna a keywords y delimitadores. */
    type: string;
    value: string | number | null;
    raw: string;
    loc: Loc;
}

export interface Comment {
    kind: "line" | "block";
    raw: string;
    loc: Loc;
    /** Solo había espacios antes del comentario en su línea. */
    ownLine: boolean;
}

export interface TokenizeResult {
    ok: boolean;
    tokens: Token[];
    trivia: Comment[];
    diagnostics: Diagnostic[];
}

const isDigit = (char: string | undefined): boolean => char !== undefined && char >= "0" && char <= "9";
const isHex = (char: string | undefined): boolean => char !== undefined && /^[0-9A-Fa-f]$/.test(char);

export function tokenize(source: string, contract: LanguageContract): TokenizeResult {
    const lexical = contract.lexical;
    const bag = new DiagnosticBag(contract.templates, "tokenizer");
    const tokens: Token[] = [];
    const trivia: Comment[] = [];

    let offset = 0;
    let line = 1;
    let column = 0;
    let lineHasContent = false;

    const position = (): Position => ({ line, column, offset });
    const positionAt = (target: number): Position => ({ line, column: column + (target - offset), offset: target });

    /** Avanza hasta `target` actualizando línea y columna, incluso a través de saltos de línea. */
    const moveTo = (target: number): void => {
        while (offset < target) {
            const char = source[offset];
            if (char === "\r" && source[offset + 1] === "\n" && offset + 1 < target) {
                offset += 2;
                line++;
                column = 0;
            } else if (char === "\n" || char === "\r") {
                offset++;
                line++;
                column = 0;
            } else {
                offset++;
                column++;
            }
        }
    };

    const push = (type: string, value: string | number | null, end: number): void => {
        const start = position();
        const raw = source.slice(offset, end);
        moveTo(end);
        tokens.push({ type, value, raw, loc: { start, end: position() } });
        lineHasContent = true;
    };

    const readString = (quote: string): void => {
        let index = offset + 1;
        let value = "";
        let terminated = false;
        while (index < source.length) {
            const char = source[index];
            if (char === quote) {
                terminated = true;
                index++;
                break;
            }
            if (char === "\n" || char === "\r") break;
            if (char !== "\\") {
                value += char;
                index++;
                continue;
            }
            const next = source[index + 1];
            if (next === undefined || next === "\n" || next === "\r") {
                bag.report("INVALID_ESCAPE_SEQUENCE", { start: positionAt(index), end: positionAt(index + 1) }, { sequence: "\\" });
                index++;
                continue;
            }
            if (next === "u" && lexical.unicodeEscape) {
                let digits = 0;
                while (digits < 4 && isHex(source[index + 2 + digits])) digits++;
                if (digits === 4) {
                    value += String.fromCharCode(parseInt(source.slice(index + 2, index + 6), 16));
                } else {
                    bag.report("INVALID_UNICODE_ESCAPE", { start: positionAt(index), end: positionAt(index + 2 + digits) });
                }
                index += 2 + digits;
                continue;
            }
            const escaped = lexical.escapes.get(next);
            if (escaped === undefined) {
                bag.report("INVALID_ESCAPE_SEQUENCE", { start: positionAt(index), end: positionAt(index + 2) }, { sequence: `\\${next}` });
                value += next;
            } else {
                value += escaped;
            }
            index += 2;
        }
        if (!terminated) {
            bag.report("UNTERMINATED_STRING", { start: position(), end: positionAt(index) });
        }
        push(STRING, value, index);
    };

    const readNumber = (): void => {
        let index = offset;
        while (isDigit(source[index])) index++;
        let invalid = false;
        if (source[index] === ".") {
            if (isDigit(source[index + 1]) && lexical.decimalNumbers) {
                index++;
                while (isDigit(source[index])) index++;
            } else {
                index++;
                invalid = true;
            }
        }
        while (index < source.length && lexical.identifierPart.test(source[index])) {
            index++;
            invalid = true;
        }
        const raw = source.slice(offset, index);
        if (invalid) {
            bag.report("INVALID_NUMBER", { start: position(), end: positionAt(index) }, { raw });
        }
        push(NUMBER, invalid ? 0 : Number(raw), index);
    };

    const startsWithAt = (lexeme: string): boolean => source.startsWith(lexeme, offset);

    while (offset < source.length) {
        const char = source[offset];

        if (lexical.ignoredWhitespace.has(char)) {
            moveTo(offset + 1);
            continue;
        }

        if (char === "\n" || char === "\r") {
            const length = char === "\r" && source[offset + 1] === "\n" ? 2 : 1;
            push(NEWLINE, null, offset + length);
            lineHasContent = false;
            continue;
        }

        if (startsWithAt(lexical.lineComment)) {
            let end = offset;
            while (end < source.length && source[end] !== "\n" && source[end] !== "\r") end++;
            const start = position();
            const ownLine = !lineHasContent;
            const raw = source.slice(offset, end);
            moveTo(end);
            trivia.push({ kind: "line", raw, loc: { start, end: position() }, ownLine });
            continue;
        }

        if (startsWithAt(lexical.blockCommentOpen)) {
            const close = source.indexOf(lexical.blockCommentClose, offset + lexical.blockCommentOpen.length);
            const end = close === -1 ? source.length : close + lexical.blockCommentClose.length;
            const start = position();
            const ownLine = !lineHasContent;
            const raw = source.slice(offset, end);
            moveTo(end);
            const loc = { start, end: position() };
            if (close === -1) bag.report("UNTERMINATED_BLOCK_COMMENT", loc);
            trivia.push({ kind: "block", raw, loc, ownLine });
            continue;
        }

        if (lexical.quotes.has(char)) {
            readString(char);
            continue;
        }

        if (char === "`" && !lexical.templateStrings) {
            const close = source.indexOf("`", offset + 1);
            const end = close === -1 ? source.length : close + 1;
            const start = position();
            const raw = source.slice(offset, end);
            moveTo(end);
            const loc = { start, end: position() };
            bag.report("TEMPLATE_STRING_NOT_SUPPORTED", loc);
            tokens.push({ type: STRING, value: raw.slice(1, close === -1 ? undefined : -1), raw, loc });
            lineHasContent = true;
            continue;
        }

        if (isDigit(char)) {
            readNumber();
            continue;
        }

        if (char === "." && isDigit(source[offset + 1])) {
            let end = offset + 1;
            while (end < source.length && lexical.identifierPart.test(source[end])) end++;
            const raw = source.slice(offset, end);
            bag.report("INVALID_NUMBER", { start: position(), end: positionAt(end) }, { raw });
            push(NUMBER, 0, end);
            continue;
        }

        if (lexical.identifierStart.test(char)) {
            let end = offset + 1;
            while (end < source.length && lexical.identifierPart.test(source[end])) end++;
            const word = source.slice(offset, end);
            const keyword = lexical.keywords.get(word);
            push(keyword ?? IDENTIFIER, word, end);
            continue;
        }

        const unsupported = [...lexical.unsupportedLexemes.keys()].find(startsWithAt);
        if (unsupported) {
            push(UNSUPPORTED, lexical.unsupportedLexemes.get(unsupported) ?? null, offset + unsupported.length);
            continue;
        }

        const delimiter = lexical.delimiters.get(char);
        if (delimiter) {
            push(delimiter, char, offset + 1);
            continue;
        }

        const operator = lexical.operators.find(startsWithAt);
        if (operator) {
            push(OPERATOR, operator, offset + operator.length);
            continue;
        }

        const codePoint = source.codePointAt(offset) ?? 0;
        const width = codePoint > 0xffff ? 2 : 1;
        bag.report("INVALID_CHARACTER", { start: position(), end: positionAt(offset + width) }, { character: source.slice(offset, offset + width) });
        moveTo(offset + width);
        lineHasContent = true;
    }

    const end = position();
    tokens.push({ type: EOF, value: null, raw: "", loc: { start: end, end } });

    return { ok: !bag.hasErrors, tokens, trivia, diagnostics: bag.items };
}
