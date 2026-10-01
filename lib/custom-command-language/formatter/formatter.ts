import type { LanguageContract } from "../contract/model";
import { DiagnosticBag, type Diagnostic } from "../diagnostics";
import type { BlockStatement, Expression, Node, Program, Statement } from "../parser/ast";
import { parse } from "../parser/parser";
import { tokenize, type Comment } from "../tokenizer/tokenizer";
import { printString } from "./stringPrinter";

export interface FormatResult {
    ok: boolean;
    code: string;
    diagnostics: Diagnostic[];
}

class CommentLoss extends Error {
    constructor(readonly comment: Comment) {
        super("comentario sin posición segura");
    }
}

interface Item {
    start: number;
    end: number;
    startLine: number;
    endLine: number;
    render: (indent: number) => string;
}

interface Range {
    start: number;
    end: number;
}

function itemOf(node: Node, render: (indent: number) => string): Item {
    return {
        start: node.loc.start.offset,
        end: node.loc.end.offset,
        startLine: node.loc.start.line,
        endLine: node.loc.end.line,
        render,
    };
}

const isMultiline = (text: string): boolean => text.includes("\n");

class Printer {
    private readonly used = new Set<Comment>();
    private readonly blankLine: boolean[];

    constructor(
        source: string,
        private readonly comments: Comment[],
        private readonly contract: LanguageContract
    ) {
        this.blankLine = [false, ...source.split(/\r\n|\r|\n/).map((line) => line.trim() === "")];
    }

    private get options() {
        return this.contract.formatter;
    }

    private indentation(level: number): string {
        return this.options.indent.repeat(level);
    }

    private get comma(): string {
        return this.options.spaceAfterComma ? ", " : ",";
    }

    private operator(op: string, spaced: boolean): string {
        return spaced ? ` ${op} ` : op;
    }

    print(program: Program): string {
        const range = { start: 0, end: program.loc.end.offset };
        const lines = this.renderList(program.body.map((statement) => this.statementItem(statement)), range, 0, "statement", false);
        const unused = this.comments.find((comment) => !this.used.has(comment));
        if (unused) throw new CommentLoss(unused);
        return lines.join("\n");
    }

    private gapComments(range: Range, items: Item[]): Comment[] {
        return this.comments.filter((comment) => {
            const start = comment.loc.start.offset;
            const end = comment.loc.end.offset;
            if (start < range.start || end > range.end) return false;
            return !items.some((item) => start >= item.start && end <= item.end);
        });
    }

    private countBlankLines(fromLine: number, toLine: number): number {
        let count = 0;
        for (let line = fromLine + 1; line < toLine; line++) if (this.blankLine[line]) count++;
        return Math.min(count, this.options.maxBlankLines);
    }

    /**
     * Imprime los elementos de un contenedor uno por línea, ubicando los comentarios de los huecos
     * como comentarios previos, finales de línea o sueltos al cierre.
     */
    private renderList(items: Item[], range: Range, indent: number, separator: "statement" | "comma", trailingComma: boolean): string[] {
        const leading = new Map<number, Comment[]>();
        const trailing = new Map<number, Comment[]>();
        const dangling: Comment[] = [];

        for (const comment of this.gapComments(range, items)) {
            this.used.add(comment);
            const start = comment.loc.start.offset;
            const previousIndex = items.reduce((found, item, index) => (item.end <= start ? index : found), -1);
            const previous = items[previousIndex];
            if (previous && !comment.ownLine && comment.loc.start.line === previous.endLine) {
                trailing.set(previousIndex, [...(trailing.get(previousIndex) ?? []), comment]);
                continue;
            }
            const nextIndex = items.findIndex((item) => item.start >= comment.loc.end.offset);
            if (nextIndex === -1) dangling.push(comment);
            else leading.set(nextIndex, [...(leading.get(nextIndex) ?? []), comment]);
        }

        const lines: string[] = [];
        const prefix = this.indentation(indent);
        let lastLine: number | null = null;
        const blankBefore = (line: number): void => {
            if (lastLine === null) return;
            for (let i = this.countBlankLines(lastLine, line); i > 0; i--) lines.push("");
        };

        items.forEach((item, index) => {
            for (const comment of leading.get(index) ?? []) {
                blankBefore(comment.loc.start.line);
                lines.push(prefix + comment.raw);
                lastLine = comment.loc.end.line;
            }
            blankBefore(item.startLine);
            let text = prefix + item.render(indent);
            if (separator === "comma" && (index < items.length - 1 || trailingComma)) text += ",";
            if (separator === "statement" && this.options.semicolons) text += ";";
            let endLine = item.endLine;
            for (const comment of trailing.get(index) ?? []) {
                text += ` ${comment.raw}`;
                endLine = comment.loc.end.line;
            }
            lines.push(text);
            lastLine = endLine;
        });
        for (const comment of dangling) {
            blankBefore(comment.loc.start.line);
            lines.push(prefix + comment.raw);
            lastLine = comment.loc.end.line;
        }
        return lines;
    }

    private statementItem(statement: Statement): Item {
        return itemOf(statement, (indent) => this.statement(statement, indent));
    }

    private block(block: BlockStatement, indent: number): string {
        const range = { start: block.loc.start.offset + 1, end: block.loc.end.offset - 1 };
        const lines = this.renderList(block.body.map((statement) => this.statementItem(statement)), range, indent + 1, "statement", false);
        return lines.length === 0 ? `{\n${this.indentation(indent)}}` : `{\n${lines.join("\n")}\n${this.indentation(indent)}}`;
    }

    private keyword(word: string): string {
        return this.options.spaceAfterKeyword ? `${word} (` : `${word}(`;
    }

    private statement(statement: Statement, indent: number): string {
        switch (statement.type) {
            case "BlockStatement":
                return this.block(statement, indent);
            case "ExpressionStatement":
                return this.expression(statement.expression, indent);
            case "VariableDeclaration": {
                const assign = this.operator("=", this.options.spaceAroundAssignment);
                const declarators = statement.declarations.map((declarator) =>
                    declarator.init ? `${declarator.id.name}${assign}${this.expression(declarator.init, indent)}` : declarator.id.name
                );
                return `${statement.kind} ${declarators.join(this.comma)}`;
            }
            case "IfStatement": {
                let text = `${this.keyword("if")}${this.expression(statement.test, indent)}) ${this.block(statement.consequent, indent)}`;
                if (statement.alternate) {
                    text += ` else ${statement.alternate.type === "IfStatement"
                        ? this.statement(statement.alternate, indent)
                        : this.block(statement.alternate, indent)}`;
                }
                return text;
            }
            case "ForOfStatement": {
                const declaration = statement.left;
                const header = `${declaration.kind} ${declaration.declarations[0].id.name} of ${this.expression(statement.right, indent)}`;
                return `${this.keyword("for")}${header}) ${this.block(statement.body, indent)}`;
            }
            case "BreakStatement":
                return "break";
            case "ContinueStatement":
                return "continue";
        }
    }

    private expression(node: Expression, indent: number): string {
        const parens = node.parens ?? 0;
        return "(".repeat(parens) + this.expressionInner(node, indent) + ")".repeat(parens);
    }

    private fits(indent: number, text: string): boolean {
        return !isMultiline(text) && this.indentation(indent).length + text.length <= this.options.printWidth;
    }

    private expressionInner(node: Expression, indent: number): string {
        const options = this.options;
        switch (node.type) {
            case "Identifier":
                return node.name;
            case "StringLiteral":
                return printString(node.value, options.quote);
            case "NumberLiteral":
                return node.raw;
            case "BooleanLiteral":
                return node.value ? "true" : "false";
            case "NullLiteral":
                return "null";
            case "BinaryExpression":
            case "LogicalExpression": {
                const spaced = node.type === "LogicalExpression" ? options.spaceAroundLogical : options.spaceAroundBinary;
                return this.expression(node.left, indent) + this.operator(node.operator, spaced) + this.expression(node.right, indent);
            }
            case "AssignmentExpression":
                return this.expression(node.left, indent) + this.operator(node.operator, options.spaceAroundAssignment) + this.expression(node.right, indent);
            case "UnaryExpression": {
                const argument = this.expression(node.argument, indent);
                const glued = (node.operator === "+" || node.operator === "-") && argument.startsWith(node.operator);
                return glued ? `${node.operator} ${argument}` : node.operator + argument;
            }
            case "UpdateExpression": {
                const argument = this.expression(node.argument, indent);
                return node.prefix ? node.operator + argument : argument + node.operator;
            }
            case "MemberExpression": {
                const object = this.expression(node.object, indent);
                if (node.computed) return `${object}[${this.expression(node.property, indent)}]`;
                return `${object}.${(node.property as { name: string }).name}`;
            }
            case "CallExpression":
                return this.call(node.callee.name, node.arguments, { start: node.callee.loc.end.offset, end: node.loc.end.offset - 1 }, indent);
            case "ObjectExpression": {
                const range = { start: node.loc.start.offset + 1, end: node.loc.end.offset - 1 };
                const items = node.properties.map((property) =>
                    itemOf(property, (level) => `${property.key.name}: ${this.expression(property.value, level)}`)
                );
                if (items.length === 0 && this.gapComments(range, items).length === 0) return "{}";
                const lines = this.renderList(items, range, indent + 1, "comma", options.objectTrailingComma);
                return `{\n${lines.join("\n")}\n${this.indentation(indent)}}`;
            }
            case "ArrayExpression": {
                const range = { start: node.loc.start.offset + 1, end: node.loc.end.offset - 1 };
                const items = node.elements.map((element) => itemOf(element, (level) => this.expression(element, level)));
                if (this.gapComments(range, items).length === 0) {
                    const flat = `[${node.elements.map((element) => this.expression(element, indent)).join(this.comma)}]`;
                    if (this.fits(indent, flat)) return flat;
                }
                const lines = this.renderList(items, range, indent + 1, "comma", options.arrayTrailingComma);
                return `[\n${lines.join("\n")}\n${this.indentation(indent)}]`;
            }
        }
    }

    private call(callee: string, args: Expression[], range: Range, indent: number): string {
        const items = args.map((argument) => itemOf(argument, (level) => this.expression(argument, level)));
        if (this.gapComments(range, items).length === 0) {
            const rendered = args.map((argument) => this.expression(argument, indent));
            const flat = `${callee}(${rendered.join(this.comma)})`;
            if (this.fits(indent, flat)) return flat;
            const last = args[args.length - 1];
            const lastText = rendered[rendered.length - 1];
            const huggable = last && !last.parens && (last.type === "ObjectExpression" || last.type === "ArrayExpression");
            if (huggable && isMultiline(lastText) && rendered.slice(0, -1).every((text) => !isMultiline(text))) {
                return flat;
            }
        }
        const lines = this.renderList(items, range, indent + 1, "comma", this.options.callTrailingComma);
        return `${callee}(\n${lines.join("\n")}\n${this.indentation(indent)})`;
    }
}

function syntaxOf(source: string, contract: LanguageContract) {
    const tokens = tokenize(source, contract);
    const parsed = parse(tokens.tokens, contract);
    return { ok: tokens.ok && parsed.ok, ast: parsed.ast, trivia: tokens.trivia, diagnostics: [...tokens.diagnostics, ...parsed.diagnostics] };
}

function astSignature(program: Program): string {
    return JSON.stringify(program, (key, value: unknown) => (key === "loc" || key === "raw" ? undefined : value));
}

function commentSignature(comments: Comment[]): string {
    return JSON.stringify(comments.map((comment) => comment.raw));
}

/**
 * Formatea sin cambiar el significado. Si el código no tiene un AST confiable, o si el resultado
 * no puede verificarse (mismo AST, mismos comentarios, idempotente), devuelve el texto original.
 */
export function format(source: string, contract: LanguageContract): FormatResult {
    const original = syntaxOf(source, contract);
    if (!original.ok) return { ok: false, code: source, diagnostics: original.diagnostics };

    const bag = new DiagnosticBag(contract.templates, "formatter");
    let output: string;
    try {
        output = new Printer(source, original.trivia, contract).print(original.ast);
    } catch (error) {
        if (!(error instanceof CommentLoss)) throw error;
        bag.report("COMMENTS_NOT_PRESERVED", error.comment.loc);
        return { ok: false, code: source, diagnostics: bag.items };
    }

    const formatted = syntaxOf(output, contract);
    let safe = formatted.ok
        && astSignature(formatted.ast) === astSignature(original.ast)
        && commentSignature(formatted.trivia) === commentSignature(original.trivia);
    if (safe) {
        try {
            safe = new Printer(output, formatted.trivia, contract).print(formatted.ast) === output;
        } catch {
            safe = false;
        }
    }
    if (!safe) {
        bag.report("FORMAT_UNSAFE", original.ast.loc);
        return { ok: false, code: source, diagnostics: bag.items };
    }
    return { ok: true, code: output, diagnostics: [] };
}
