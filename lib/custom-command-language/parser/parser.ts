import type { LanguageContract } from "../contract/model";
import { DiagnosticBag, type Diagnostic, type Loc } from "../diagnostics";
import { EOF, IDENTIFIER, NEWLINE, NUMBER, OPERATOR, STRING, UNSUPPORTED, type Token } from "../tokenizer/tokenizer";
import type {
    BlockStatement,
    Expression,
    ForOfStatement,
    Identifier,
    IfStatement,
    ObjectExpression,
    ArrayExpression,
    Program,
    Property,
    Statement,
    VariableDeclaration,
    VariableDeclarator,
} from "./ast";

export interface ParseResult {
    ok: boolean;
    ast: Program;
    diagnostics: Diagnostic[];
}

/** Palabras de JavaScript que el lenguaje no admite, con la construcción de `unsupportedConstructs` que representan. */
const UNSUPPORTED_WORDS: Record<string, string> = {
    var: "var",
    function: "functionDeclaration",
    return: "return",
    async: "async",
    await: "await",
    class: "class",
    new: "new",
    this: "this",
    import: "import",
    export: "export",
    require: "require",
    try: "tryCatch",
    catch: "tryCatch",
    throw: "throw",
    switch: "switch",
    while: "while",
    do: "doWhile",
};

const CONSTRUCT_LABELS: Record<string, string> = {
    classicFor: "El for clásico",
    forIn: "for...in",
    destructuring: "La desestructuración",
    spread: "El spread (...)",
    optionalChaining: "El optional chaining (?.)",
    arrowFunction: "La función flecha (=>)",
};

class SyntaxFailure extends Error {}

const STATEMENT_START_KEYWORDS = ["let", "const", "if", "for", "break", "continue"];

class Parser {
    private index = 0;
    private previous: Token;
    /** Cima verdadera: los saltos de línea separan instrucciones. Falsa: dentro de paréntesis, objetos, arrays y argumentos. */
    private readonly newlineSignificant: boolean[] = [true];
    private readonly keywordType: Map<string, string>;
    private readonly statementStartTypes: Set<string>;

    constructor(
        private readonly tokens: Token[],
        private readonly contract: LanguageContract,
        private readonly bag: DiagnosticBag
    ) {
        this.previous = tokens[0];
        this.keywordType = contract.lexical.keywords;
        this.statementStartTypes = new Set(
            STATEMENT_START_KEYWORDS.map((word) => this.keywordType.get(word)).filter((type): type is string => type !== undefined)
        );
    }

    parseProgram(): Program {
        const body = this.parseStatementList(false);
        const eof = this.tokens[this.tokens.length - 1];
        return { type: "Program", body, loc: { start: { line: 1, column: 0, offset: 0 }, end: eof.loc.end } };
    }

    private kw(word: string): string {
        return this.keywordType.get(word) ?? `#${word}`;
    }

    private delimiter(char: string): string {
        return this.contract.lexical.delimiters.get(char) ?? `#${char}`;
    }

    private skipIgnoredNewlines(): void {
        if (this.newlineSignificant[this.newlineSignificant.length - 1]) return;
        while (this.tokens[this.index].type === NEWLINE) this.index++;
    }

    private current(): Token {
        this.skipIgnoredNewlines();
        return this.tokens[this.index];
    }

    private advance(): Token {
        const token = this.current();
        if (token.type !== EOF) this.index++;
        this.previous = token;
        return token;
    }

    private check(type: string, value?: string): boolean {
        const token = this.current();
        return token.type === type && (value === undefined || token.value === value);
    }

    private match(type: string, value?: string): boolean {
        if (!this.check(type, value)) return false;
        this.advance();
        return true;
    }

    private withNewlines<T>(significant: boolean, run: () => T): T {
        this.newlineSignificant.push(significant);
        try {
            return run();
        } finally {
            this.newlineSignificant.pop();
        }
    }

    private span(start: Token | Loc): Loc {
        const startLoc = "loc" in start ? start.loc : start;
        return { start: startLoc.start, end: this.previous.loc.end };
    }

    private describe(token: Token): string {
        if (token.type === EOF) return "el final del código";
        if (token.type === NEWLINE) return "un salto de línea";
        return `"${token.raw}"`;
    }

    private failAt(token: Token, code: string, params: Record<string, string | number> = {}): never {
        this.bag.report(code, token.loc, params);
        throw new SyntaxFailure();
    }

    private expect(type: string, expected: string): Token {
        if (this.check(type)) return this.advance();
        const token = this.current();
        if (token.type === EOF || token.type === NEWLINE) this.failAt(token, "EXPECTED_TOKEN", { expected });
        this.bag.report("EXPECTED_TOKEN", token.loc, { expected });
        throw new SyntaxFailure();
    }

    private unsupported(token: Token, construct: string): never {
        this.failAt(token, "UNSUPPORTED_CONSTRUCT", { construct: CONSTRUCT_LABELS[construct] ?? token.raw });
    }

    private unsupportedWord(token: Token, expressionPosition: boolean): string | null {
        if (token.type !== IDENTIFIER) return null;
        let construct = UNSUPPORTED_WORDS[String(token.value)];
        if (construct === "functionDeclaration" && expressionPosition) construct = "functionExpression";
        return construct && this.contract.grammar.unsupportedConstructs.has(construct) ? construct : null;
    }

    private skipRawNewlines(): void {
        while (this.tokens[this.index].type === NEWLINE) this.index++;
    }

    private parseStatementList(insideBlock: boolean): Statement[] {
        const body: Statement[] = [];
        const closing = this.delimiter("}");
        for (;;) {
            while (this.tokens[this.index].type === NEWLINE || this.tokens[this.index].type === this.delimiter(";")) this.index++;
            const token = this.tokens[this.index];
            if (token.type === EOF || (insideBlock && token.type === closing)) break;
            const startIndex = this.index;
            try {
                const statement = this.parseStatement();
                body.push(statement);
                if (this.needsTerminator(statement)) this.expectTerminator(insideBlock);
            } catch (error) {
                if (!(error instanceof SyntaxFailure)) throw error;
                this.synchronize(startIndex, insideBlock);
            }
        }
        return body;
    }

    private needsTerminator(statement: Statement): boolean {
        return statement.type !== "BlockStatement" && statement.type !== "IfStatement" && statement.type !== "ForOfStatement";
    }

    private expectTerminator(insideBlock: boolean): void {
        const token = this.tokens[this.index];
        if (token.type === NEWLINE || token.type === this.delimiter(";") || token.type === EOF) return;
        if (insideBlock && token.type === this.delimiter("}")) return;
        if (!insideBlock && token.type === this.delimiter("}")) this.failAt(token, "UNEXPECTED_TOKEN", { token: this.describe(token) });
        this.failAt(token, "EXPECTED_TOKEN", { expected: "un salto de línea o ;" });
    }

    /** Descarta tokens hasta un punto seguro sin quedar nunca en el mismo lugar. */
    private synchronize(startIndex: number, insideBlock: boolean): void {
        const opens = new Set([this.delimiter("("), this.delimiter("["), this.delimiter("{")]);
        const closes = new Set([this.delimiter(")"), this.delimiter("]"), this.delimiter("}")]);
        let depth = 0;
        for (let i = startIndex; i < this.index; i++) {
            if (opens.has(this.tokens[i].type)) depth++;
            else if (closes.has(this.tokens[i].type)) depth--;
        }
        if (this.index === startIndex) {
            const first = this.tokens[this.index];
            if (first.type === EOF) return;
            if (opens.has(first.type)) depth++;
            if (closes.has(first.type)) depth--;
            this.index++;
        }
        for (;;) {
            const token = this.tokens[this.index];
            if (token.type === EOF) return;
            if (depth <= 0) {
                if (token.type === NEWLINE || token.type === this.delimiter(";")) return;
                if (this.statementStartTypes.has(token.type)) return;
                if (token.type === this.delimiter("}")) {
                    if (insideBlock) return;
                    this.index++;
                    continue;
                }
            }
            if (opens.has(token.type)) depth++;
            else if (closes.has(token.type)) depth--;
            this.index++;
        }
    }

    private parseStatement(): Statement {
        const token = this.current();
        const grammar = this.contract.grammar;
        if (token.type === this.delimiter("{")) {
            if (!grammar.statements.has("BlockStatement")) this.unsupported(token, "block");
            return this.parseBlock();
        }
        if (token.type === this.kw("let") || token.type === this.kw("const")) {
            if (!grammar.statements.has("VariableDeclaration") || !grammar.variableKinds.has(token.raw)) this.unsupported(token, token.raw);
            return this.parseVariableDeclaration();
        }
        if (token.type === this.kw("if")) {
            if (!grammar.statements.has("IfStatement")) this.unsupported(token, "if");
            return this.parseIf();
        }
        if (token.type === this.kw("for")) {
            if (!grammar.statements.has("ForOfStatement")) this.unsupported(token, "for");
            return this.parseForOf();
        }
        if (token.type === this.kw("break") || token.type === this.kw("continue")) {
            const name = token.type === this.kw("break") ? "BreakStatement" : "ContinueStatement";
            if (!grammar.statements.has(name)) this.unsupported(token, token.raw);
            return this.parseLoopControl(name);
        }
        if (token.type === this.kw("else") || token.type === this.kw("of")) {
            this.failAt(token, "UNEXPECTED_TOKEN", { token: this.describe(token) });
        }
        const construct = this.unsupportedWord(token, false);
        if (construct) this.unsupported(token, construct);
        if (!grammar.statements.has("ExpressionStatement")) this.unsupported(token, "expression");
        const expression = this.parseExpression();
        return { type: "ExpressionStatement", expression, loc: this.span(token) };
    }

    private parseBlock(): BlockStatement {
        return this.withNewlines(true, () => {
            const open = this.expect(this.delimiter("{"), "{");
            const body = this.parseStatementList(true);
            this.expect(this.delimiter("}"), "}");
            return { type: "BlockStatement", body, loc: this.span(open) };
        });
    }

    private parseRequiredBlock(): BlockStatement {
        this.skipRawNewlines();
        const token = this.current();
        if (token.type !== this.delimiter("{")) this.failAt(token, "EXPECTED_TOKEN", { expected: "un bloque con llaves" });
        return this.parseBlock();
    }

    private parseIdentifier(expected: string): Identifier {
        const token = this.current();
        if (token.type !== IDENTIFIER) this.failAt(token, "EXPECTED_TOKEN", { expected });
        const construct = this.unsupportedWord(token, true);
        if (construct) this.unsupported(token, construct);
        this.advance();
        return { type: "Identifier", name: String(token.value), loc: token.loc };
    }

    private parseVariableDeclaration(): VariableDeclaration {
        const keyword = this.advance();
        const declarations: VariableDeclarator[] = [];
        do {
            const token = this.current();
            if (token.type === this.delimiter("{") || token.type === this.delimiter("[")) this.unsupported(token, "destructuring");
            const id = this.parseIdentifier("el nombre de la variable");
            let init: Expression | null = null;
            if (this.match(OPERATOR, "=")) init = this.parseAssignment();
            declarations.push({ type: "VariableDeclarator", id, init, loc: this.span(id.loc) });
        } while (this.contract.grammar.multipleDeclarators && this.match(this.delimiter(",")));
        return { type: "VariableDeclaration", kind: keyword.raw, declarations, loc: this.span(keyword) };
    }

    private parseParenthesized<T>(run: () => T): T {
        this.expect(this.delimiter("("), "(");
        return this.withNewlines(false, () => {
            const result = run();
            this.expect(this.delimiter(")"), ")");
            return result;
        });
    }

    private parseIf(): IfStatement {
        const keyword = this.advance();
        const test = this.parseParenthesized(() => this.parseExpression());
        const consequent = this.parseRequiredBlock();

        let alternate: IfStatement | BlockStatement | null = null;
        let lookahead = this.index;
        while (this.tokens[lookahead].type === NEWLINE) lookahead++;
        if (this.tokens[lookahead].type === this.kw("else")) {
            this.index = lookahead;
            const elseToken = this.advance();
            if (!this.contract.grammar.else) this.unsupported(elseToken, "else");
            this.skipRawNewlines();
            if (this.check(this.kw("if"))) {
                if (!this.contract.grammar.elseIf) this.unsupported(this.current(), "else if");
                alternate = this.parseIf();
            } else {
                alternate = this.parseRequiredBlock();
            }
        }
        return { type: "IfStatement", test, consequent, alternate, loc: this.span(keyword) };
    }

    private parseForOf(): ForOfStatement {
        const keyword = this.advance();
        const { left, right } = this.parseParenthesized(() => {
            const declarationToken = this.current();
            if (declarationToken.type === this.delimiter(";")) this.unsupported(declarationToken, "classicFor");
            const isDeclaration = declarationToken.type === this.kw("let") || declarationToken.type === this.kw("const");
            if (!isDeclaration || !this.contract.grammar.forOfKinds.has(declarationToken.raw)) {
                this.failAt(declarationToken, "INVALID_FOR_OF_DECLARATION");
            }
            this.advance();
            const target = this.current();
            if (target.type === this.delimiter("{") || target.type === this.delimiter("[")) this.unsupported(target, "destructuring");
            const id = this.parseIdentifier("el nombre de la variable");
            const after = this.current();
            if (after.type === OPERATOR && after.value === "=") {
                this.failAt(after, this.statementContains(this.delimiter(";")) ? "UNSUPPORTED_CONSTRUCT" : "INVALID_FOR_OF_DECLARATION",
                    { construct: CONSTRUCT_LABELS.classicFor });
            }
            if (after.type === this.delimiter(",")) this.failAt(after, "INVALID_FOR_OF_DECLARATION");
            if (after.type === IDENTIFIER && after.value === "in") this.unsupported(after, "forIn");
            this.expect(this.kw("of"), "of");
            const declaration: VariableDeclaration = {
                type: "VariableDeclaration",
                kind: declarationToken.raw,
                declarations: [{ type: "VariableDeclarator", id, init: null, loc: id.loc }],
                loc: { start: declarationToken.loc.start, end: id.loc.end },
            };
            return { left: declaration, right: this.parseExpression() };
        });
        const body = this.parseRequiredBlock();
        return { type: "ForOfStatement", left, right, body, loc: this.span(keyword) };
    }

    private statementContains(type: string): boolean {
        let depth = 0;
        for (let i = this.index; i < this.tokens.length; i++) {
            const token = this.tokens[i];
            if (token.type === this.delimiter("(")) depth++;
            if (token.type === this.delimiter(")")) {
                if (depth === 0) return false;
                depth--;
            }
            if (token.type === type && depth === 0) return true;
            if (token.type === EOF) return false;
        }
        return false;
    }

    private parseLoopControl(name: "BreakStatement" | "ContinueStatement"): Statement {
        const keyword = this.advance();
        const next = this.current();
        if (next.type === IDENTIFIER && !this.contract.grammar.loopControlLabels) {
            this.failAt(next, "UNEXPECTED_TOKEN", { token: this.describe(next) });
        }
        return { type: name, loc: keyword.loc };
    }

    private parseExpression(): Expression {
        return this.parseAssignment();
    }

    private isAssignable(expression: Expression): boolean {
        return expression.type === "Identifier" || expression.type === "MemberExpression";
    }

    private parseAssignment(): Expression {
        const start = this.current();
        const left = this.parseBinary(0);
        const token = this.current();
        if (token.type === OPERATOR && this.contract.grammar.assignmentOperators.has(String(token.value))) {
            if (!this.contract.grammar.expressions.has("AssignmentExpression")) this.unsupported(token, String(token.value));
            this.advance();
            if (!this.isAssignable(left)) this.bag.report("INVALID_ASSIGNMENT_TARGET", left.loc);
            const right = this.parseAssignment();
            return { type: "AssignmentExpression", operator: String(token.value), left, right, loc: this.span(start) };
        }
        return left;
    }

    private binaryOperator(token: Token, level: number): string | null {
        if (token.type !== OPERATOR) return null;
        let operator = String(token.value);
        const hint = this.contract.lexical.unsupportedOperators.get(operator);
        if (hint !== undefined) {
            const replacement = `${operator}=`;
            if (!this.contract.grammar.binaryLevels[level].operators.has(replacement)) return null;
            this.bag.report("UNSUPPORTED_OPERATOR", token.loc, { operator, hint });
            operator = replacement;
        }
        return this.contract.grammar.binaryLevels[level].operators.has(operator) ? operator : null;
    }

    private parseBinary(level: number): Expression {
        const levels = this.contract.grammar.binaryLevels;
        if (level >= levels.length) return this.parseUnary();
        const start = this.current();
        let left = this.parseBinary(level + 1);
        for (;;) {
            const token = this.current();
            const operator = this.binaryOperator(token, level);
            if (operator === null) return left;
            const nodeType = levels[level].logical ? "LogicalExpression" : "BinaryExpression";
            if (!this.contract.grammar.expressions.has(nodeType)) this.unsupported(token, operator);
            this.advance();
            const right = levels[level].rightAssociative ? this.parseBinary(level) : this.parseBinary(level + 1);
            left = { type: nodeType, operator, left, right, loc: this.span(start) };
        }
    }

    private parseUnary(): Expression {
        const token = this.current();
        const grammar = this.contract.grammar;
        if (token.type === OPERATOR) {
            const operator = String(token.value);
            if (grammar.unaryOperators.has(operator)) {
                if (!grammar.expressions.has("UnaryExpression")) this.unsupported(token, operator);
                this.advance();
                const argument = this.parseUnary();
                return { type: "UnaryExpression", operator, argument, loc: this.span(token) };
            }
            if ((operator === "++" || operator === "--") && grammar.updatePrefix && grammar.expressions.has("UpdateExpression")) {
                this.advance();
                const argument = this.parseUnary();
                if (!this.isAssignable(argument)) this.bag.report("INVALID_ASSIGNMENT_TARGET", argument.loc);
                return { type: "UpdateExpression", operator, argument, prefix: true, loc: this.span(token) };
            }
        }
        return this.parsePostfix();
    }

    private parseArguments(): Expression[] {
        return this.withNewlines(false, () => {
            const args: Expression[] = [];
            while (!this.check(this.delimiter(")"))) {
                args.push(this.parseAssignment());
                const comma = this.current();
                if (!this.match(this.delimiter(","))) break;
                if (this.check(this.delimiter(")")) && !this.contract.grammar.callTrailingComma) {
                    this.bag.report("UNEXPECTED_TOKEN", comma.loc, { token: this.describe(comma) });
                }
            }
            this.expect(this.delimiter(")"), ")");
            return args;
        });
    }

    private parsePostfix(): Expression {
        const start = this.current();
        const grammar = this.contract.grammar;
        let expression = this.parsePrimary();
        for (;;) {
            const token = this.current();
            if (token.type === this.delimiter(".")) {
                if (!grammar.memberDot || !grammar.expressions.has("MemberExpression")) this.unsupported(token, ".");
                this.advance();
                const name = this.current();
                if (name.type !== IDENTIFIER && !this.isKeywordToken(name)) {
                    this.failAt(name, "EXPECTED_TOKEN", { expected: "el nombre de una propiedad" });
                }
                this.advance();
                const property: Identifier = { type: "Identifier", name: name.raw, loc: name.loc };
                expression = { type: "MemberExpression", object: expression, property, computed: false, loc: this.span(start) };
            } else if (token.type === this.delimiter("[")) {
                if (!grammar.memberComputed || !grammar.expressions.has("MemberExpression")) this.unsupported(token, "[]");
                this.advance();
                const property = this.withNewlines(false, () => {
                    const inner = this.parseExpression();
                    this.expect(this.delimiter("]"), "]");
                    return inner;
                });
                expression = { type: "MemberExpression", object: expression, property, computed: true, loc: this.span(start) };
            } else if (token.type === this.delimiter("(")) {
                this.advance();
                const args = this.parseArguments();
                if (expression.type === "Identifier" && !expression.parens) {
                    if (!grammar.expressions.has("CallExpression")) this.unsupported(token, "()");
                    expression = { type: "CallExpression", callee: expression, arguments: args, loc: this.span(start) };
                } else {
                    this.bag.report(expression.type === "MemberExpression" ? "METHOD_CALL_NOT_SUPPORTED" : "INVALID_CALLEE", this.span(start));
                }
            } else if (token.type === OPERATOR && (token.value === "++" || token.value === "--") && grammar.updatePostfix
                && grammar.expressions.has("UpdateExpression")) {
                this.advance();
                if (!this.isAssignable(expression)) this.bag.report("INVALID_ASSIGNMENT_TARGET", expression.loc);
                expression = { type: "UpdateExpression", operator: String(token.value), argument: expression, prefix: false, loc: this.span(start) };
            } else if (token.type === UNSUPPORTED) {
                this.unsupported(token, String(token.value));
            } else {
                return expression;
            }
        }
    }

    /** Primer token significativo después del paréntesis que cierra el actual; detecta `(a) => …`. */
    private tokenAfterClosingParen(): Token | null {
        let depth = 0;
        for (let i = this.index; i < this.tokens.length; i++) {
            const type = this.tokens[i].type;
            if (type === this.delimiter("(")) depth++;
            else if (type === this.delimiter(")") && --depth === 0) {
                let next = i + 1;
                while (this.tokens[next].type === NEWLINE) next++;
                return this.tokens[next];
            } else if (type === EOF) return null;
        }
        return null;
    }

    private isKeywordToken(token: Token): boolean {
        return this.contract.lexical.keywords.get(token.raw) === token.type;
    }

    private parsePrimary(): Expression {
        const token = this.current();
        const grammar = this.contract.grammar;
        const require = (name: string): void => {
            if (!grammar.expressions.has(name)) this.unsupported(token, token.raw);
        };
        switch (token.type) {
            case STRING:
                require("StringLiteral");
                this.advance();
                return { type: "StringLiteral", value: String(token.value), raw: token.raw, loc: token.loc };
            case NUMBER:
                require("NumberLiteral");
                this.advance();
                return { type: "NumberLiteral", value: Number(token.value), raw: token.raw, loc: token.loc };
            case IDENTIFIER: {
                const construct = this.unsupportedWord(token, true);
                if (construct) this.unsupported(token, construct);
                require("Identifier");
                this.advance();
                return { type: "Identifier", name: String(token.value), loc: token.loc };
            }
            case UNSUPPORTED:
                this.unsupported(token, String(token.value));
        }
        if (token.type === this.kw("true") || token.type === this.kw("false")) {
            require("BooleanLiteral");
            this.advance();
            return { type: "BooleanLiteral", value: token.type === this.kw("true"), loc: token.loc };
        }
        if (token.type === this.kw("null")) {
            require("NullLiteral");
            this.advance();
            return { type: "NullLiteral", loc: token.loc };
        }
        if (token.type === this.delimiter("(")) {
            require("ParenthesizedExpression");
            const arrow = this.tokenAfterClosingParen();
            if (arrow?.type === UNSUPPORTED) this.unsupported(arrow, String(arrow.value));
            this.advance();
            return this.withNewlines(false, () => {
                const inner = this.parseExpression();
                this.expect(this.delimiter(")"), ")");
                inner.parens = (inner.parens ?? 0) + 1;
                return inner;
            });
        }
        if (token.type === this.delimiter("{")) {
            require("ObjectExpression");
            return this.parseObject();
        }
        if (token.type === this.delimiter("[")) {
            require("ArrayExpression");
            return this.parseArray();
        }
        if (token.type === EOF || token.type === NEWLINE) this.failAt(token, "EXPECTED_TOKEN", { expected: "una expresión" });
        this.failAt(token, "UNEXPECTED_TOKEN", { token: this.describe(token) });
    }

    private parseObject(): ObjectExpression {
        const open = this.advance();
        return this.withNewlines(false, () => {
            const properties: Property[] = [];
            while (!this.check(this.delimiter("}"))) {
                const keyToken = this.current();
                let key: Identifier;
                if (keyToken.type === IDENTIFIER) {
                    this.advance();
                    key = { type: "Identifier", name: String(keyToken.value), loc: keyToken.loc };
                } else if (keyToken.type === STRING) {
                    this.advance();
                    if (!this.contract.grammar.quotedKeys) this.bag.report("QUOTED_OBJECT_KEY", keyToken.loc, { name: String(keyToken.value) });
                    key = { type: "Identifier", name: String(keyToken.value), loc: keyToken.loc };
                } else if (keyToken.type === UNSUPPORTED) {
                    this.unsupported(keyToken, String(keyToken.value));
                } else {
                    this.failAt(keyToken, "EXPECTED_TOKEN", { expected: "el nombre de una propiedad" });
                }
                this.expect(this.delimiter(":"), ":");
                const value = this.parseAssignment();
                properties.push({ type: "Property", key, value, loc: this.span(key.loc) });
                const comma = this.current();
                if (!this.match(this.delimiter(","))) break;
                if (this.check(this.delimiter("}")) && !this.contract.grammar.objectTrailingComma) {
                    this.bag.report("UNEXPECTED_TOKEN", comma.loc, { token: this.describe(comma) });
                }
            }
            this.expect(this.delimiter("}"), "}");
            return { type: "ObjectExpression", properties, loc: this.span(open) };
        });
    }

    private parseArray(): ArrayExpression {
        const open = this.advance();
        return this.withNewlines(false, () => {
            const elements: Expression[] = [];
            while (!this.check(this.delimiter("]"))) {
                const token = this.current();
                if (token.type === this.delimiter(",")) this.failAt(token, "UNEXPECTED_TOKEN", { token: this.describe(token) });
                elements.push(this.parseAssignment());
                const comma = this.current();
                if (!this.match(this.delimiter(","))) break;
                if (this.check(this.delimiter("]")) && !this.contract.grammar.arrayTrailingComma) {
                    this.bag.report("UNEXPECTED_TOKEN", comma.loc, { token: this.describe(comma) });
                }
            }
            this.expect(this.delimiter("]"), "]");
            return { type: "ArrayExpression", elements, loc: this.span(open) };
        });
    }
}

export function parse(tokens: Token[], contract: LanguageContract): ParseResult {
    const bag = new DiagnosticBag(contract.templates, "parser");
    const ast = new Parser(tokens, contract, bag).parseProgram();
    return { ok: !bag.hasErrors, ast, diagnostics: bag.items };
}
