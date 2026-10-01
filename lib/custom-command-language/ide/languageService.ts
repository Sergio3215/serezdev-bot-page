import type { FunctionDefinition, LanguageContract, ObjectType, PropertyDefinition, Type } from "../contract/model";
import { sortDiagnostics, type Diagnostic } from "../diagnostics";
import { format, type FormatResult } from "../formatter/formatter";
import { childNodes, type Expression, type Identifier, type Node, type ObjectExpression, type Program } from "../parser/ast";
import { parse } from "../parser/parser";
import { validate, type Analysis } from "../rules/ruleEngine";
import { isNullable, withoutNull } from "../rules/typeSystem";
import { EOF, IDENTIFIER, NEWLINE, OPERATOR, STRING, tokenize, type Token } from "../tokenizer/tokenizer";

export interface AnalyzeResult {
    code: string;
    ast: Program;
    valid: boolean;
    diagnostics: Diagnostic[];
    languageVersion: string;
    /** Null cuando hay errores léxicos o sintácticos: las reglas solo corren sobre un AST confiable. */
    analysis: Analysis | null;
}

export type CompletionKind = "function" | "property" | "variable" | "keyword";

export interface CompletionItem {
    label: string;
    kind: CompletionKind;
    /** Categoría del contrato para funciones: reference, query o action. */
    category?: string;
    detail: string;
    documentation?: string;
    /** Texto a insertar. Los campos editables van como `${nombre}`. */
    insertText: string;
}

export interface CompletionResult {
    from: number;
    to: number;
    items: CompletionItem[];
}

export interface HoverResult {
    from: number;
    to: number;
    title: string;
    lines: string[];
}

export interface SignatureHelpResult {
    name: string;
    signature: string;
    description: string;
    parameters: { name: string; type: string; required: boolean }[];
    activeParameter: number;
}

const PLACEHOLDER = "__completion__";
const STATEMENT_KEYWORDS = ["let", "const", "if", "for", "break", "continue"];
const VALUE_KEYWORDS = ["true", "false", "null"];

function nodeAt(program: Program, offset: number): { node: Node; parents: Node[] } | null {
    let best: { node: Node; parents: Node[] } | null = null;
    const parents: Node[] = [];
    const visit = (node: Node): void => {
        if (offset < node.loc.start.offset || offset > node.loc.end.offset) return;
        best = { node, parents: [...parents] };
        parents.push(node);
        childNodes(node).forEach(visit);
        parents.pop();
    };
    visit(program);
    return best;
}

function findPlaceholder(program: Program): { node: Identifier; parent: Node | null; parents: Node[] } | null {
    let found: { node: Identifier; parent: Node | null; parents: Node[] } | null = null;
    const parents: Node[] = [];
    const visit = (node: Node): void => {
        if (found) return;
        if (node.type === "Identifier" && node.name === PLACEHOLDER) {
            found = { node, parent: parents[parents.length - 1] ?? null, parents: [...parents] };
            return;
        }
        parents.push(node);
        childNodes(node).forEach(visit);
        parents.pop();
    };
    visit(program);
    return found;
}

function describeType(type: Type): string {
    return type.name;
}

function propertyDocumentation(property: PropertyDefinition): string {
    const parts = [property.required ? "Obligatoria" : "Opcional"];
    if (property.readOnly) parts.push("solo lectura");
    if (property.minLength !== undefined || property.maxLength !== undefined) {
        parts.push(`${property.minLength ?? 0} a ${property.maxLength ?? "∞"} caracteres`);
    }
    if (property.format) parts.push(`formato ${property.format}`);
    return parts.join(" · ");
}

export function createLanguageService(contract: LanguageContract) {
    const analyze = (source: string): AnalyzeResult => {
        const tokens = tokenize(source, contract);
        const parsed = parse(tokens.tokens, contract);
        const syntaxDiagnostics = [...tokens.diagnostics, ...parsed.diagnostics];
        const result = syntaxDiagnostics.length === 0 ? validate(parsed.ast, contract) : null;
        const diagnostics = sortDiagnostics([...syntaxDiagnostics, ...(result?.diagnostics ?? [])]);
        return {
            code: source,
            ast: parsed.ast,
            valid: diagnostics.length === 0,
            diagnostics,
            languageVersion: contract.languageVersion,
            analysis: result?.analysis ?? null,
        };
    };

    const isIdentifierPart = (char: string | undefined): boolean => char !== undefined && contract.lexical.identifierPart.test(char);

    const functionSnippet = (definition: FunctionDefinition): string => {
        const args = definition.parameters.map((parameter) => {
            if (parameter.type.kind === "object" && !parameter.type.readOnly) {
                const required = [...parameter.type.properties.values()].filter((property) => property.required);
                if (required.length === 0) return "{}";
                const indent = contract.formatter.indent;
                const lines = required.map((property) => `${indent}${property.name}: ${valueSnippet(property.type, property.name)},`);
                return `{\n${lines.join("\n")}\n}`;
            }
            return valueSnippet(parameter.type, parameter.name);
        });
        return `${definition.name}(${args.join(", ")})`;
    };

    const valueSnippet = (type: Type, name: string): string =>
        type.name === "String" ? `${contract.formatter.quote}\${${name}}${contract.formatter.quote}` : `\${${name}}`;

    const functionItems = (): CompletionItem[] =>
        [...contract.functionByName.values()].map((definition) => ({
            label: definition.name,
            kind: "function",
            category: definition.kind,
            detail: definition.signatures[0] ?? definition.name,
            documentation: definition.description,
            insertText: functionSnippet(definition),
        }));

    const propertyItems = (type: ObjectType, exclude: Set<string>, asKey: boolean): CompletionItem[] =>
        [...type.properties.values()]
            .filter((property) => !exclude.has(property.name))
            .map((property) => ({
                label: property.name,
                kind: "property",
                detail: `${property.name}: ${describeType(property.type)}`,
                documentation: propertyDocumentation(property),
                insertText: asKey ? `${property.name}: ` : property.name,
            }));

    /** Tipo de configuración que se espera para un objeto literal según dónde está escrito. */
    const expectedObjectType = (object: ObjectExpression, parents: Node[]): ObjectType | null => {
        const parent = parents[parents.length - 1];
        if (parent?.type === "CallExpression") {
            const index = parent.arguments.indexOf(object);
            const type = contract.functionByName.get(parent.callee.name)?.parameters[index]?.type;
            return type?.kind === "object" ? type : null;
        }
        if (parent?.type === "Property") {
            const owner = parents[parents.length - 2];
            if (owner?.type !== "ObjectExpression") return null;
            const ownerType = expectedObjectType(owner, parents.slice(0, -2));
            const type = ownerType?.properties.get(parent.key.name)?.type;
            return type?.kind === "object" ? type : null;
        }
        return null;
    };

    const significantBefore = (tokens: Token[], offset: number): Token[] =>
        tokens.filter((token) => token.loc.end.offset <= offset && token.type !== NEWLINE && token.type !== EOF);

    /** Determina si el cursor está donde va el nombre de una propiedad de un objeto literal. */
    const inObjectKeyPosition = (tokens: Token[], from: number): boolean => {
        const before = significantBefore(tokens, from);
        const last = before[before.length - 1];
        const comma = contract.lexical.delimiters.get(",");
        const open = contract.lexical.delimiters.get("{");
        if (!last || (last.type !== comma && last.type !== open)) return false;
        const closes: Record<string, string> = {};
        for (const [char, type] of contract.lexical.delimiters) {
            if (char === ")") closes[type] = contract.lexical.delimiters.get("(") ?? "";
            if (char === "]") closes[type] = contract.lexical.delimiters.get("[") ?? "";
            if (char === "}") closes[type] = open ?? "";
        }
        const opens = new Set([contract.lexical.delimiters.get("("), contract.lexical.delimiters.get("["), open]);
        const stack: number[] = [];
        before.forEach((token, index) => {
            if (opens.has(token.type)) stack.push(index);
            else if (token.type in closes) stack.pop();
        });
        const innermost = stack[stack.length - 1];
        if (innermost === undefined || before[innermost].type !== open) return false;
        const previous = before[innermost - 1];
        if (!previous) return false;
        const objectContexts = new Set(["(", "[", ",", ":"].map((char) => contract.lexical.delimiters.get(char)));
        return objectContexts.has(previous.type) || (previous.type === OPERATOR && previous.value === "=");
    };

    const complete = (source: string, offset: number): CompletionResult => {
        let from = offset;
        while (from > 0 && isIdentifierPart(source[from - 1])) from--;
        let to = offset;
        while (isIdentifierPart(source[to])) to++;
        const prefix = source.slice(from, offset).toLowerCase();
        const empty = { from, to, items: [] };

        const tokens = tokenize(source, contract);
        const insideText = tokens.tokens.some((token) => token.type === STRING && token.loc.start.offset < offset && offset < token.loc.end.offset)
            || tokens.trivia.some((comment) => comment.loc.start.offset < offset && offset <= comment.loc.end.offset);
        if (insideText) return empty;

        const rest = source.slice(to);
        let insertion = PLACEHOLDER;
        if (inObjectKeyPosition(tokens.tokens, from)) {
            const next = rest.trimStart()[0];
            if (next !== ":") insertion += next === "," || next === "}" ? ": null" : ": null,";
        }
        const probe = analyze(source.slice(0, from) + insertion + rest);
        const filter = (items: CompletionItem[]): CompletionItem[] =>
            items.filter((item) => item.label.toLowerCase().startsWith(prefix) && item.label !== PLACEHOLDER);

        const found = probe.analysis ? findPlaceholder(probe.ast) : null;
        if (!probe.analysis || !found) {
            const fallback = [...functionItems(), ...VALUE_KEYWORDS.map((word) => keywordItem(word))];
            return { from, to, items: filter(fallback) };
        }
        const { node, parent, parents } = found;
        const analysis = probe.analysis;

        if (parent?.type === "MemberExpression" && parent.property === node && !parent.computed) {
            let owner = analysis.expressionTypes.get(parent.object);
            if (owner && isNullable(owner)) owner = withoutNull(owner);
            if (owner?.kind === "object") return { from, to, items: filter(propertyItems(owner, new Set(), false)) };
            if (owner?.kind === "literal-object") {
                return {
                    from,
                    to,
                    items: filter([...owner.properties.entries()].map(([name, property]) => ({
                        label: name,
                        kind: "property" as const,
                        detail: `${name}: ${describeType(property.type)}`,
                        insertText: name,
                    }))),
                };
            }
            return empty;
        }

        if (parent?.type === "Property" && parent.key === node) {
            const object = parents[parents.length - 2];
            if (object?.type !== "ObjectExpression") return empty;
            const expected = expectedObjectType(object, parents.slice(0, -2));
            if (!expected) return empty;
            const present = new Set(object.properties.map((property) => property.key.name));
            return { from, to, items: filter(propertyItems(expected, present, true)) };
        }

        const scope = analysis.scopes.get(node);
        const variables: CompletionItem[] = (scope?.visibleBindings() ?? [])
            .filter((binding) => binding.name !== PLACEHOLDER)
            .map((binding) => ({
                label: binding.name,
                kind: "variable",
                detail: `${binding.declarationKind} ${binding.name}: ${describeType(binding.type)}`,
                insertText: binding.name,
            }));
        const atStatementStart = parent?.type === "ExpressionStatement";
        const keywords = [...VALUE_KEYWORDS, ...(atStatementStart ? STATEMENT_KEYWORDS : [])].map((word) => keywordItem(word));
        return { from, to, items: filter([...variables, ...functionItems(), ...keywords]) };
    };

    const keywordItem = (word: string): CompletionItem => ({ label: word, kind: "keyword", detail: "palabra reservada", insertText: word });

    const functionHover = (definition: FunctionDefinition): Pick<HoverResult, "title" | "lines"> => ({
        title: definition.signatures[0] ?? definition.name,
        lines: [
            `${contract.functionCategories.get(definition.kind) ?? definition.kind}`,
            definition.description,
            ...(definition.nullable ? ["Puede devolver null: descartalo antes de usar el resultado."] : []),
        ],
    });

    const hover = (source: string, offset: number): HoverResult | null => {
        const tokens = tokenize(source, contract).tokens;
        const token = tokens.find((candidate) => candidate.type === IDENTIFIER && candidate.loc.start.offset <= offset && offset <= candidate.loc.end.offset);
        if (!token) return null;
        const range = { from: token.loc.start.offset, to: token.loc.end.offset };
        const result = analyze(source);
        const definition = contract.functionByName.get(token.raw);

        if (!result.analysis) return definition ? { ...range, ...functionHover(definition) } : null;
        const located = nodeAt(result.ast, token.loc.start.offset);
        if (!located || located.node.type !== "Identifier") return definition ? { ...range, ...functionHover(definition) } : null;
        const node = located.node;
        const parent = located.parents[located.parents.length - 1];

        if (parent?.type === "CallExpression" && parent.callee === node && definition) return { ...range, ...functionHover(definition) };

        if (parent?.type === "MemberExpression" && parent.property === node && !parent.computed) {
            let owner = result.analysis.expressionTypes.get(parent.object);
            if (owner && isNullable(owner)) owner = withoutNull(owner);
            const property = owner?.kind === "object" ? owner.properties.get(node.name) : undefined;
            if (property) return { ...range, title: `${owner?.name}.${property.name}: ${describeType(property.type)}`, lines: [propertyDocumentation(property)] };
            return null;
        }

        if (parent?.type === "Property" && parent.key === node) {
            const object = located.parents[located.parents.length - 2];
            if (object?.type !== "ObjectExpression") return null;
            const expected = expectedObjectType(object, located.parents.slice(0, -2));
            const property = expected?.properties.get(node.name);
            if (!expected || !property) return null;
            return { ...range, title: `${expected.name}.${property.name}: ${describeType(property.type)}`, lines: [propertyDocumentation(property)] };
        }

        const binding = result.analysis.bindings.get(node);
        if (!binding) return null;
        const type = result.analysis.expressionTypes.get(node as Expression) ?? binding.type;
        return { ...range, title: `${binding.declarationKind} ${binding.name}: ${describeType(type)}`, lines: [] };
    };

    const signatureHelp = (source: string, offset: number): SignatureHelpResult | null => {
        const tokens = significantBefore(tokenize(source, contract).tokens, offset);
        const delimiter = (char: string): string | undefined => contract.lexical.delimiters.get(char);
        const frames: { name: string | null; commas: number; call: boolean }[] = [];
        tokens.forEach((token, index) => {
            if (token.type === delimiter("(")) {
                const previous = tokens[index - 1];
                frames.push({ name: previous?.type === IDENTIFIER ? previous.raw : null, commas: 0, call: true });
            } else if (token.type === delimiter("[") || token.type === delimiter("{")) {
                frames.push({ name: null, commas: 0, call: false });
            } else if (token.type === delimiter(")") || token.type === delimiter("]") || token.type === delimiter("}")) {
                frames.pop();
            } else if (token.type === delimiter(",") && frames.length > 0) {
                frames[frames.length - 1].commas++;
            }
        });
        for (let i = frames.length - 1; i >= 0; i--) {
            const frame = frames[i];
            const definition = frame.call && frame.name ? contract.functionByName.get(frame.name) : undefined;
            if (!definition) continue;
            return {
                name: definition.name,
                signature: definition.signatures[0] ?? definition.name,
                description: definition.description,
                parameters: definition.parameters.map((parameter) => ({
                    name: parameter.name,
                    type: describeType(parameter.type),
                    required: parameter.required,
                })),
                activeParameter: Math.min(frame.commas, Math.max(definition.parameters.length - 1, 0)),
            };
        }
        return null;
    };

    return {
        contract,
        languageVersion: contract.languageVersion,
        tokenize: (source: string) => tokenize(source, contract),
        parse: (source: string) => parse(tokenize(source, contract).tokens, contract),
        analyze,
        format: (source: string): FormatResult => format(source, contract),
        complete,
        hover,
        signatureHelp,
    };
}

export type LanguageService = ReturnType<typeof createLanguageService>;
