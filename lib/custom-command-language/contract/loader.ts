import type {
    AggregateConstraint,
    BindingRule,
    BinaryLevel,
    DynamicResource,
    FormatDefinition,
    FormatterModel,
    FunctionDefinition,
    GrammarModel,
    LanguageContract,
    LexicalModel,
    ObjectType,
    OperatorRule,
    PropertyDefinition,
    RulesModel,
    ScalarName,
    Type,
} from "./model";

export class ContractError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ContractError";
    }
}

export interface ContractBundle {
    manifest: unknown;
    /** Contratos por la ruta relativa que declara `manifest.contracts`. */
    files: Record<string, unknown>;
}

type JsonObject = Record<string, unknown>;

const SUPPORTED_SCHEMA_VERSIONS = [1];
const REQUIRED_CONTRACTS = ["syntax", "rules", "types", "functions", "formatter"] as const;
const DEFAULT_PRINT_WIDTH = 80;

const WHITESPACE_BY_NAME: Record<string, string> = {
    space: " ",
    tab: "\t",
    formFeed: "\f",
    verticalTab: "\v",
};

const ESCAPE_VALUES: Record<string, string> = {
    "\\": "\\",
    "\"": "\"",
    "'": "'",
    n: "\n",
    r: "\r",
    t: "\t",
    b: "\b",
    f: "\f",
    v: "\v",
    "0": "\0",
};

const STATEMENT_NAMES = [
    "BlockStatement",
    "VariableDeclaration",
    "IfStatement",
    "ForOfStatement",
    "BreakStatement",
    "ContinueStatement",
    "ExpressionStatement",
];

const EXPRESSION_NAMES = [
    "Identifier",
    "StringLiteral",
    "NumberLiteral",
    "BooleanLiteral",
    "NullLiteral",
    "CallExpression",
    "ObjectExpression",
    "ArrayExpression",
    "MemberExpression",
    "BinaryExpression",
    "LogicalExpression",
    "UnaryExpression",
    "AssignmentExpression",
    "UpdateExpression",
    "ParenthesizedExpression",
];

const BINARY_GROUPS: Record<string, boolean> = {
    multiplicative: false,
    additive: false,
    comparison: false,
    equality: false,
    logicalAnd: true,
    logicalOr: true,
};

const NARROWING_PATTERN = /^(identifier|null) (===|!==) (identifier|null)$/;

function fail(path: string, message: string): never {
    throw new ContractError(`Contrato inválido en ${path}: ${message}`);
}

function asObject(value: unknown, path: string): JsonObject {
    if (typeof value !== "object" || value === null || Array.isArray(value)) fail(path, "se esperaba un objeto");
    return value as JsonObject;
}

function obj(o: JsonObject, key: string, path: string): JsonObject {
    return asObject(o[key], `${path}.${key}`);
}

function str(o: JsonObject, key: string, path: string): string {
    const value = o[key];
    if (typeof value !== "string") fail(`${path}.${key}`, "se esperaba un string");
    return value;
}

function bool(o: JsonObject, key: string, path: string): boolean {
    const value = o[key];
    if (typeof value !== "boolean") fail(`${path}.${key}`, "se esperaba un booleano");
    return value;
}

function int(o: JsonObject, key: string, path: string): number {
    const value = o[key];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
        fail(`${path}.${key}`, "se esperaba un entero no negativo");
    }
    return value;
}

function strArray(o: JsonObject, key: string, path: string): string[] {
    const value = o[key];
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
        fail(`${path}.${key}`, "se esperaba una lista de strings");
    }
    return value as string[];
}

function strRecord(o: JsonObject, key: string, path: string): Record<string, string> {
    const record = obj(o, key, path);
    for (const [k, v] of Object.entries(record)) {
        if (typeof v !== "string") fail(`${path}.${key}.${k}`, "se esperaba un string");
    }
    return record as Record<string, string>;
}

function expectValue<T>(actual: unknown, expected: T, path: string): void {
    if (actual !== expected) fail(path, `el frontend solo implementa ${JSON.stringify(expected)}`);
}

function oneOf<T extends string>(value: string, allowed: readonly T[], path: string): T {
    if (!(allowed as readonly string[]).includes(value)) fail(path, `valor sin handler: ${value}`);
    return value as T;
}

function onlyKeys(o: JsonObject, allowed: readonly string[], path: string): void {
    for (const key of Object.keys(o)) {
        if (!allowed.includes(key)) fail(`${path}.${key}`, "categoría sin handler en el frontend");
    }
}

function checkVersions(contract: JsonObject, name: string, languageVersion: string): void {
    const schemaVersion = contract.schemaVersion;
    if (typeof schemaVersion !== "number" || !SUPPORTED_SCHEMA_VERSIONS.includes(schemaVersion)) {
        fail(`${name}.schemaVersion`, `versión de esquema no soportada: ${String(schemaVersion)}`);
    }
    const version = str(contract, "languageVersion", name);
    if (version !== languageVersion) {
        fail(`${name}.languageVersion`, `${version} no coincide con ${languageVersion} del manifest`);
    }
}

function loadLexical(syntax: JsonObject): LexicalModel {
    const path = "syntax.lexical";
    const lexical = obj(syntax, "lexical", "syntax");

    const identifier = obj(lexical, "identifier", path);
    const startPattern = str(identifier, "startPattern", `${path}.identifier`);
    const partPattern = str(identifier, "partPattern", `${path}.identifier`);

    const whitespace = obj(lexical, "whitespace", path);
    const ignoredWhitespace = new Set<string>();
    for (const name of strArray(whitespace, "ignored", `${path}.whitespace`)) {
        const char = WHITESPACE_BY_NAME[name];
        if (!char) fail(`${path}.whitespace.ignored`, `espacio sin handler: ${name}`);
        ignoredWhitespace.add(char);
    }
    for (const name of strArray(whitespace, "newlines", `${path}.whitespace`)) {
        oneOf(name, ["LF", "CRLF", "CR"], `${path}.whitespace.newlines`);
    }
    expectValue(bool(whitespace, "newlinesAreTokens", `${path}.whitespace`), true, `${path}.whitespace.newlinesAreTokens`);

    const comments = obj(lexical, "comments", path);
    const line = obj(comments, "line", `${path}.comments`);
    expectValue(str(line, "endsAt", `${path}.comments.line`), "newline", `${path}.comments.line.endsAt`);
    const block = obj(comments, "block", `${path}.comments`);
    expectValue(bool(block, "nested", `${path}.comments.block`), false, `${path}.comments.block.nested`);
    expectValue(bool(comments, "preserveAsTrivia", `${path}.comments`), true, `${path}.comments.preserveAsTrivia`);

    const strings = obj(lexical, "strings", path);
    expectValue(bool(strings, "multiline", `${path}.strings`), false, `${path}.strings.multiline`);
    const escapes = new Map<string, string>();
    let unicodeEscape = false;
    for (const escape of strArray(strings, "escapes", `${path}.strings`)) {
        if (escape === "\\uFFFF") {
            unicodeEscape = true;
            continue;
        }
        const char = escape.length === 2 && escape[0] === "\\" ? escape[1] : undefined;
        if (!char || !(char in ESCAPE_VALUES)) fail(`${path}.strings.escapes`, `escape sin handler: ${escape}`);
        escapes.set(char, ESCAPE_VALUES[char]);
    }

    const numbers = obj(lexical, "numbers", path);
    expectValue(bool(numbers, "integer", `${path}.numbers`), true, `${path}.numbers.integer`);
    expectValue(bool(numbers, "leadingDecimalPoint", `${path}.numbers`), false, `${path}.numbers.leadingDecimalPoint`);
    expectValue(bool(numbers, "trailingDecimalPoint", `${path}.numbers`), false, `${path}.numbers.trailingDecimalPoint`);
    expectValue(bool(numbers, "exponent", `${path}.numbers`), false, `${path}.numbers.exponent`);
    expectValue(bool(numbers, "signIsUnaryOperator", `${path}.numbers`), true, `${path}.numbers.signIsUnaryOperator`);

    const operators = obj(syntax, "operators", "syntax");
    const supported = strArray(operators, "supported", "syntax.operators");
    const unsupportedOperators = new Map(Object.entries(strRecord(operators, "explicitlyUnsupported", "syntax.operators")));
    const identifierPattern = new RegExp(`^${startPattern}${partPattern}*$`);
    const unsupportedWords = new Map<string, string>();
    const unsupportedLexemes = new Map<string, string>();
    const constructLabels = new Map<string, string>();
    for (const [construct, value] of Object.entries(obj(syntax, "unsupportedConstructs", "syntax"))) {
        const constructPath = `syntax.unsupportedConstructs.${construct}`;
        const definition = asObject(value, constructPath);
        onlyKeys(definition, ["label", "keywords", "lexemes"], constructPath);
        if (definition.label !== undefined) constructLabels.set(construct, str(definition, "label", constructPath));
        for (const word of definition.keywords === undefined ? [] : strArray(definition, "keywords", constructPath)) {
            if (!identifierPattern.test(word)) fail(`${constructPath}.keywords`, `no es un identificador: ${word}`);
            if (unsupportedWords.has(word)) fail(`${constructPath}.keywords`, `${word} ya pertenece a ${unsupportedWords.get(word)}`);
            unsupportedWords.set(word, construct);
        }
        for (const lexeme of definition.lexemes === undefined ? [] : strArray(definition, "lexemes", constructPath)) {
            if (unsupportedLexemes.has(lexeme)) fail(`${constructPath}.lexemes`, `${lexeme} ya pertenece a ${unsupportedLexemes.get(lexeme)}`);
            unsupportedLexemes.set(lexeme, construct);
        }
    }

    return {
        identifierStart: new RegExp(`^${startPattern}$`),
        identifierPart: new RegExp(`^${partPattern}$`),
        ignoredWhitespace,
        keywords: new Map(Object.entries(strRecord(lexical, "keywords", path))),
        delimiters: new Map(Object.entries(strRecord(lexical, "delimiters", path))),
        operators: [...new Set([...supported, ...unsupportedOperators.keys()])].sort((a, b) => b.length - a.length),
        unsupportedOperators,
        unsupportedLexemes,
        unsupportedWords,
        constructLabels,
        quotes: new Set(strArray(strings, "quotes", `${path}.strings`)),
        escapes,
        unicodeEscape,
        lineComment: str(line, "open", `${path}.comments.line`),
        blockCommentOpen: str(block, "open", `${path}.comments.block`),
        blockCommentClose: str(block, "close", `${path}.comments.block`),
        templateStrings: bool(strings, "templateStrings", `${path}.strings`),
        decimalNumbers: bool(numbers, "decimal", `${path}.numbers`),
    };
}

function loadGrammar(syntax: JsonObject): GrammarModel {
    const program = obj(syntax, "program", "syntax");
    for (const separator of strArray(program, "statementSeparators", "syntax.program")) {
        oneOf(separator, ["newline", "semicolon", "rightBrace", "eof"], "syntax.program.statementSeparators");
    }
    expectValue(bool(program, "semicolonOptional", "syntax.program"), true, "syntax.program.semicolonOptional");
    const ignoredInside = strArray(program, "newlinesIgnoredInside", "syntax.program");
    for (const place of ["parentheses", "objects", "arrays", "argumentLists"]) {
        if (!ignoredInside.includes(place)) fail("syntax.program.newlinesIgnoredInside", `falta ${place}`);
    }

    const statementsJson = obj(syntax, "statements", "syntax");
    onlyKeys(statementsJson, STATEMENT_NAMES, "syntax.statements");
    const statements = new Set<string>();
    const statement = (name: string): JsonObject => {
        const value = obj(statementsJson, name, "syntax.statements");
        if (bool(value, "enabled", `syntax.statements.${name}`)) statements.add(name);
        return value;
    };
    for (const name of ["BlockStatement", "ExpressionStatement"]) statement(name);

    const variable = statement("VariableDeclaration");
    const ifStatement = statement("IfStatement");
    expectValue(ifStatement.conditionParenthesesRequired, true, "syntax.statements.IfStatement.conditionParenthesesRequired");
    expectValue(ifStatement.bodyBlockRequired, true, "syntax.statements.IfStatement.bodyBlockRequired");
    const forOf = statement("ForOfStatement");
    expectValue(forOf.headerParenthesesRequired, true, "syntax.statements.ForOfStatement.headerParenthesesRequired");
    expectValue(forOf.bodyBlockRequired, true, "syntax.statements.ForOfStatement.bodyBlockRequired");
    expectValue(forOf.exactlyOneDeclarator, true, "syntax.statements.ForOfStatement.exactlyOneDeclarator");
    expectValue(forOf.initializerProvidedByLoop, true, "syntax.statements.ForOfStatement.initializerProvidedByLoop");
    let loopControlLabels = false;
    for (const name of ["BreakStatement", "ContinueStatement"]) {
        const control = statement(name);
        expectValue(str(control, "onlyInside", `syntax.statements.${name}`), "ForOfStatement", `syntax.statements.${name}.onlyInside`);
        loopControlLabels = loopControlLabels || bool(control, "labels", `syntax.statements.${name}`);
    }
    expectValue(loopControlLabels, false, "syntax.statements.BreakStatement.labels");

    const expressionsJson = obj(syntax, "expressions", "syntax");
    onlyKeys(expressionsJson, EXPRESSION_NAMES, "syntax.expressions");
    const expressions = new Set<string>();
    const expression = (name: string): JsonObject => {
        const value = obj(expressionsJson, name, "syntax.expressions");
        if (bool(value, "enabled", `syntax.expressions.${name}`)) expressions.add(name);
        return value;
    };
    for (const name of ["Identifier", "StringLiteral", "NumberLiteral", "BooleanLiteral", "NullLiteral", "BinaryExpression", "LogicalExpression"]) {
        expression(name);
    }
    const call = expression("CallExpression");
    expectValue(call.callee, "Identifier", "syntax.expressions.CallExpression.callee");
    const object = expression("ObjectExpression");
    expectValue(object.key, "Identifier", "syntax.expressions.ObjectExpression.key");
    expectValue(object.computedKeys, false, "syntax.expressions.ObjectExpression.computedKeys");
    expectValue(object.shorthand, false, "syntax.expressions.ObjectExpression.shorthand");
    expectValue(object.spread, false, "syntax.expressions.ObjectExpression.spread");
    const array = expression("ArrayExpression");
    expectValue(array.spread, false, "syntax.expressions.ArrayExpression.spread");
    expectValue(array.holes, false, "syntax.expressions.ArrayExpression.holes");
    const member = expression("MemberExpression");
    expectValue(member.chaining, true, "syntax.expressions.MemberExpression.chaining");
    expectValue(member.optionalChaining, false, "syntax.expressions.MemberExpression.optionalChaining");
    expectValue(member.methodCalls, false, "syntax.expressions.MemberExpression.methodCalls");
    const unary = expression("UnaryExpression");
    expectValue(unary.prefixOnly, true, "syntax.expressions.UnaryExpression.prefixOnly");
    const assignment = expression("AssignmentExpression");
    expectValue(assignment.associativity, "right", "syntax.expressions.AssignmentExpression.associativity");
    const update = expression("UpdateExpression");
    const parenthesized = expression("ParenthesizedExpression");
    expectValue(parenthesized.representedByInnerNode, true, "syntax.expressions.ParenthesizedExpression.representedByInnerNode");

    const operators = obj(syntax, "operators", "syntax");
    const supported = new Set(strArray(operators, "supported", "syntax.operators"));
    const precedence = operators.precedenceHighToLow;
    if (!Array.isArray(precedence)) fail("syntax.operators.precedenceHighToLow", "se esperaba una lista");

    const binaryLevels: BinaryLevel[] = [];
    const unaryOperators = new Set<string>();
    const assignmentOperators = new Set<string>();
    precedence.forEach((entry, index) => {
        const path = `syntax.operators.precedenceHighToLow[${index}]`;
        const level = asObject(entry, path);
        const group = str(level, "group", path);
        const ops = strArray(level, "operators", path);
        const associativity = oneOf(str(level, "associativity", path), ["left", "right"], `${path}.associativity`);
        if (group === "postfix" || group === "unary") {
            for (const op of ops) {
                if (group === "unary" && op.startsWith("unary")) unaryOperators.add(op.slice(5));
                else if (group === "unary" && op === "!") unaryOperators.add(op);
                else if (!["prefix++", "prefix--", "postfix++", "postfix--", ".", "[]", "()"].includes(op)) {
                    fail(`${path}.operators`, `operador sin handler: ${op}`);
                }
            }
            return;
        }
        if (group === "assignment") {
            for (const op of ops) assignmentOperators.add(op);
            return;
        }
        if (!(group in BINARY_GROUPS)) fail(`${path}.group`, `grupo sin handler: ${group}`);
        for (const op of ops) {
            if (!supported.has(op)) fail(`${path}.operators`, `${op} no figura en operators.supported`);
        }
        binaryLevels.push({ operators: new Set(ops), logical: BINARY_GROUPS[group], rightAssociative: associativity === "right" });
    });

    return {
        statements,
        expressions,
        variableKinds: new Set(strArray(variable, "kinds", "syntax.statements.VariableDeclaration")),
        multipleDeclarators: bool(variable, "multipleDeclarators", "syntax.statements.VariableDeclaration"),
        elseIf: bool(ifStatement, "elseIf", "syntax.statements.IfStatement"),
        else: bool(ifStatement, "else", "syntax.statements.IfStatement"),
        forOfKinds: new Set(strArray(forOf, "declarationKinds", "syntax.statements.ForOfStatement")),
        loopControlLabels,
        callTrailingComma: bool(call, "trailingComma", "syntax.expressions.CallExpression"),
        objectTrailingComma: bool(object, "trailingComma", "syntax.expressions.ObjectExpression"),
        arrayTrailingComma: bool(array, "trailingComma", "syntax.expressions.ArrayExpression"),
        quotedKeys: bool(object, "quotedKeys", "syntax.expressions.ObjectExpression"),
        memberDot: bool(member, "dot", "syntax.expressions.MemberExpression"),
        memberComputed: bool(member, "computed", "syntax.expressions.MemberExpression"),
        updatePrefix: bool(update, "prefix", "syntax.expressions.UpdateExpression"),
        updatePostfix: bool(update, "postfix", "syntax.expressions.UpdateExpression"),
        unaryOperators,
        binaryLevels: binaryLevels.reverse(),
        assignmentOperators,
        unsupportedConstructs: new Set(Object.keys(obj(syntax, "unsupportedConstructs", "syntax"))),
    };
}

function loadFormats(rules: JsonObject): Map<string, FormatDefinition> {
    const formats = new Map<string, FormatDefinition>();
    for (const [name, value] of Object.entries(obj(rules, "formats", "rules"))) {
        const path = `rules.formats.${name}`;
        const format = asObject(value, path);
        onlyKeys(format, ["type", "pattern", "protocols", "description", "diagnosticCode"], path);
        expectValue(str(format, "type", path), "String", `${path}.type`);
        const common = { name, description: str(format, "description", path), diagnosticCode: str(format, "diagnosticCode", path) };
        if (typeof format.pattern === "string") {
            formats.set(name, { ...common, kind: "pattern", pattern: new RegExp(format.pattern) });
        } else if (Array.isArray(format.protocols)) {
            formats.set(name, { ...common, kind: "protocols", protocols: strArray(format, "protocols", path) });
        } else {
            fail(path, "se esperaba pattern o protocols");
        }
    }
    return formats;
}

const RULE_KEYS = [
    "schemaVersion",
    "languageVersion",
    "ruleEngine",
    "program",
    "scopes",
    "bindings",
    "controlFlow",
    "calls",
    "objects",
    "arrays",
    "memberAccess",
    "nullNarrowing",
    "operators",
    "formats",
    "aggregateConstraints",
    "diagnosticTemplates",
];

function loadRules(rules: JsonObject, supportedOperators: Set<string>): RulesModel {
    onlyKeys(rules, RULE_KEYS, "rules");

    const engine = obj(rules, "ruleEngine", "rules");
    expectValue(engine.executesProgram, false, "rules.ruleEngine.executesProgram");
    expectValue(engine.performsExternalRequests, false, "rules.ruleEngine.performsExternalRequests");

    const program = obj(rules, "program", "rules");
    expectValue(str(program, "emptyProgram", "rules.program"), "error", "rules.program.emptyProgram");

    const scopes = obj(rules, "scopes", "rules");
    onlyKeys(scopes, [
        "kind",
        "programCreatesScope",
        "blockCreatesScope",
        "ifBranchCreatesScope",
        "elseBranchCreatesScope",
        "forOfCreatesScope",
        "duplicateDeclarationInSameScope",
        "shadowingInChildScope",
        "useBeforeDeclaration",
    ], "rules.scopes");
    expectValue(str(scopes, "kind", "rules.scopes"), "block", "rules.scopes.kind");
    for (const key of ["programCreatesScope", "blockCreatesScope", "ifBranchCreatesScope", "elseBranchCreatesScope", "forOfCreatesScope"]) {
        expectValue(bool(scopes, key, "rules.scopes"), true, `rules.scopes.${key}`);
    }
    expectValue(str(scopes, "useBeforeDeclaration", "rules.scopes"), "error", "rules.scopes.useBeforeDeclaration");

    const bindingsJson = obj(rules, "bindings", "rules");
    const bindings = new Map<string, BindingRule>();
    for (const kind of ["let", "const"]) {
        const binding = obj(bindingsJson, kind, "rules.bindings");
        bindings.set(kind, {
            requiresInitializer: bool(binding, "requiresInitializer", `rules.bindings.${kind}`),
            mutable: bool(binding, "mutable", `rules.bindings.${kind}`),
        });
    }
    const forOfBinding = obj(bindingsJson, "forOfBinding", "rules.bindings");
    expectValue(bool(forOfBinding, "exactlyOneDeclarator", "rules.bindings.forOfBinding"), true, "rules.bindings.forOfBinding.exactlyOneDeclarator");
    expectValue(bool(obj(bindingsJson, "nativeValues", "rules.bindings"), "readOnly", "rules.bindings.nativeValues"), true, "rules.bindings.nativeValues.readOnly");

    const controlFlow = obj(rules, "controlFlow", "rules");
    onlyKeys(controlFlow, ["if", "forOf", "break", "continue"], "rules.controlFlow");
    expectValue(str(obj(controlFlow, "if", "rules.controlFlow"), "conditionType", "rules.controlFlow.if"), "Any", "rules.controlFlow.if.conditionType");
    const forOf = obj(controlFlow, "forOf", "rules.controlFlow");
    expectValue(str(forOf, "iterableKind", "rules.controlFlow.forOf"), "array", "rules.controlFlow.forOf.iterableKind");
    expectValue(bool(forOf, "reusingExistingBinding", "rules.controlFlow.forOf"), false, "rules.controlFlow.forOf.reusingExistingBinding");
    const loopControlAncestors = new Map<string, string[]>();
    for (const keyword of ["break", "continue"]) {
        const control = obj(controlFlow, keyword, "rules.controlFlow");
        loopControlAncestors.set(keyword, strArray(control, "requiresAncestor", `rules.controlFlow.${keyword}`));
    }

    const calls = obj(rules, "calls", "rules");
    expectValue(calls.knownFunctionsOnly, true, "rules.calls.knownFunctionsOnly");
    expectValue(calls.caseSensitive, true, "rules.calls.caseSensitive");
    expectValue(calls.calleeNode, "Identifier", "rules.calls.calleeNode");
    expectValue(calls.methodCalls, false, "rules.calls.methodCalls");
    expectValue(calls.argumentCount, "exact-contract-range", "rules.calls.argumentCount");
    expectValue(calls.argumentTypes, "assignable-to-parameter", "rules.calls.argumentTypes");
    expectValue(calls.userDefinedFunctions, false, "rules.calls.userDefinedFunctions");

    const objects = obj(rules, "objects", "rules");
    expectValue(objects.keyKind, "Identifier", "rules.objects.keyKind");
    expectValue(objects.additionalPropertiesDefault, false, "rules.objects.additionalPropertiesDefault");

    const arrays = obj(rules, "arrays", "rules");
    expectValue(arrays.mixedElementTypes, "Unknown", "rules.arrays.mixedElementTypes");
    expectValue(arrays.indexType, "Number", "rules.arrays.indexType");

    const memberAccess = obj(rules, "memberAccess", "rules");
    expectValue(memberAccess.objectComputedAccess, "static-string-property", "rules.memberAccess.objectComputedAccess");
    expectValue(memberAccess.arrayComputedAccess, "number-index", "rules.memberAccess.arrayComputedAccess");
    expectValue(memberAccess.methods, false, "rules.memberAccess.methods");

    const narrowing = obj(rules, "nullNarrowing", "rules");
    const patterns = new Set<string>();
    for (const pattern of strArray(narrowing, "supportedPatterns", "rules.nullNarrowing")) {
        const match = NARROWING_PATTERN.exec(pattern);
        if (!match || match[1] === match[3]) fail("rules.nullNarrowing.supportedPatterns", `patrón sin handler: ${pattern}`);
        patterns.add(pattern);
    }
    const appliesTo = strArray(narrowing, "appliesTo", "rules.nullNarrowing");
    for (const place of appliesTo) oneOf(place, ["ifConsequent", "ifAlternate"], "rules.nullNarrowing.appliesTo");

    const operators = new Map<string, OperatorRule>();
    for (const [operator, value] of Object.entries(obj(rules, "operators", "rules"))) {
        const path = `rules.operators.${operator}`;
        const rule = asObject(value, path);
        onlyKeys(rule, ["left", "right", "returns", "acceptedPairs", "acceptedOperand", "returnsByPair", "shortCircuit"], path);
        const raw = operator.replace(/^unary/, "");
        if (!supportedOperators.has(raw)) fail(path, "operador que no figura en syntax.operators.supported");
        if (rule.left !== undefined) expectValue(rule.left, "mutable-assignment-target", `${path}.left`);
        if (rule.right !== undefined) expectValue(rule.right, "assignable-to-left", `${path}.right`);
        let acceptedPairs: OperatorRule["acceptedPairs"];
        if (rule.acceptedPairs === "any") {
            acceptedPairs = "any";
        } else if (rule.acceptedPairs !== undefined) {
            if (!Array.isArray(rule.acceptedPairs)) fail(`${path}.acceptedPairs`, "se esperaba una lista o \"any\"");
            acceptedPairs = rule.acceptedPairs.map((pair, i) => {
                if (!Array.isArray(pair) || pair.length !== 2 || pair.some((t) => typeof t !== "string")) {
                    fail(`${path}.acceptedPairs[${i}]`, "se esperaba un par de tipos");
                }
                return [pair[0], pair[1]] as [string, string];
            });
        }
        operators.set(operator, {
            operator,
            acceptedPairs,
            acceptedOperand: typeof rule.acceptedOperand === "string" ? rule.acceptedOperand : undefined,
            returns: typeof rule.returns === "string" ? rule.returns : undefined,
            returnsByPair: rule.returnsByPair === undefined ? undefined : strRecord(rule, "returnsByPair", path),
        });
    }

    return {
        minimumStatements: int(program, "minimumStatements", "rules.program"),
        duplicateDeclarationIsError: oneOf(str(scopes, "duplicateDeclarationInSameScope", "rules.scopes"), ["error", "allowed"], "rules.scopes.duplicateDeclarationInSameScope") === "error",
        shadowingIsError: oneOf(str(scopes, "shadowingInChildScope", "rules.scopes"), ["error", "allowed"], "rules.scopes.shadowingInChildScope") === "error",
        bindings,
        forOfBindingKinds: new Set(strArray(forOf, "bindingKinds", "rules.controlFlow.forOf")),
        loopControlAncestors,
        duplicatePropertiesIsError: oneOf(str(objects, "duplicateProperties", "rules.objects"), ["error", "allowed"], "rules.objects.duplicateProperties") === "error",
        unknownConfigPropertiesIsError: oneOf(str(objects, "unknownConfigProperties", "rules.objects"), ["error", "allowed"], "rules.objects.unknownConfigProperties") === "error",
        missingRequiredIsError: oneOf(str(objects, "requiredProperties", "rules.objects"), ["error-when-missing"], "rules.objects.requiredProperties") === "error-when-missing",
        nullableRequiresNarrowing: bool(memberAccess, "nullableValueRequiresNarrowing", "rules.memberAccess"),
        unknownPropertyIsError: oneOf(str(memberAccess, "unknownProperty", "rules.memberAccess"), ["error", "allowed"], "rules.memberAccess.unknownProperty") === "error",
        narrowing: {
            enabled: bool(narrowing, "enabled", "rules.nullNarrowing"),
            patterns,
            consequent: appliesTo.includes("ifConsequent"),
            alternate: appliesTo.includes("ifAlternate"),
        },
        operators,
    };
}

function loadAggregates(rules: JsonObject): Map<string, AggregateConstraint> {
    const aggregates = new Map<string, AggregateConstraint>();
    for (const [name, value] of Object.entries(obj(rules, "aggregateConstraints", "rules"))) {
        const path = `rules.aggregateConstraints.${name}`;
        const constraint = asObject(value, path);
        onlyKeys(constraint, ["types", "properties", "maxTotalLength", "diagnosticCode"], path);
        aggregates.set(name, {
            name,
            types: strArray(constraint, "types", path),
            properties: strArray(constraint, "properties", path),
            maxTotalLength: int(constraint, "maxTotalLength", path),
            diagnosticCode: str(constraint, "diagnosticCode", path),
        });
    }
    return aggregates;
}

/** `rules.operators` distingue `unary+` del `+` binario; `!` no lleva prefijo. */
export function unaryRuleName(rules: RulesModel, operator: string): string {
    return rules.operators.has(`unary${operator}`) ? `unary${operator}` : operator;
}

const NULL_TYPE: Type = { kind: "scalar", name: "Null" };

export function nullableOf(type: Type): Type {
    if (type.kind === "union" && type.members.some((member) => member.kind === "scalar" && member.name === "Null")) return type;
    return { kind: "union", name: `${type.name} | Null`, members: [type, NULL_TYPE] };
}

export function arrayOf(element: Type, readOnly: boolean): Type {
    return { kind: "array", name: `Array<${element.name}>`, element, readOnly };
}

/** Parte una unión por los `|` que no están dentro de `< >`. */
function splitUnion(text: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === "<") depth++;
        else if (text[i] === ">") depth--;
        else if (text[i] === "|" && depth === 0) {
            parts.push(text.slice(start, i).trim());
            start = i + 1;
        }
    }
    parts.push(text.slice(start).trim());
    return parts;
}

function resolveTypeExpression(expression: string, typeByName: Map<string, Type>, path: string): Type {
    const text = expression.trim();
    const members = splitUnion(text);
    if (members.length > 1) {
        const resolved = members.filter((member) => member !== "Null").map((member) => resolveTypeExpression(member, typeByName, path));
        const union: Type = resolved.length === 1
            ? resolved[0]
            : { kind: "union", name: resolved.map((member) => member.name).join(" | "), members: resolved };
        return members.includes("Null") ? nullableOf(union) : union;
    }
    const array = /^Array<(.+)>$/.exec(text);
    if (array) return arrayOf(resolveTypeExpression(array[1], typeByName, path), false);
    const type = typeByName.get(text);
    if (!type) fail(path, `tipo inexistente: ${text}`);
    return type;
}

function loadTypes(
    types: JsonObject,
    formats: Map<string, FormatDefinition>,
    aggregates: Map<string, AggregateConstraint>
): Map<string, Type> {
    onlyKeys(types, ["schemaVersion", "languageVersion", "typeKinds", "types", "genericTypes"], "types");
    const generic = obj(types, "genericTypes", "types");
    onlyKeys(generic, ["Array<T>", "T | Null"], "types.genericTypes");

    const declared = obj(types, "types", "types");
    const typeByName = new Map<string, Type>();
    const objectSources = new Map<ObjectType, JsonObject>();

    for (const [name, value] of Object.entries(declared)) {
        const path = `types.types.${name}`;
        const definition = asObject(value, path);
        onlyKeys(definition, ["kind", "readOnly", "additionalProperties", "properties", "requiresAny", "aggregateConstraints", "literal"], path);
        const kind = oneOf(str(definition, "kind", path), ["scalar", "object", "void"], `${path}.kind`);
        if (kind === "scalar" && name === "Any") {
            typeByName.set(name, { kind: "unknown", name: "Any" });
        } else if (kind === "scalar") {
            const scalar = oneOf(name, ["String", "Number", "Boolean", "Null"], path) as ScalarName;
            typeByName.set(name, { kind: "scalar", name: scalar });
        } else if (kind === "void") {
            expectValue(name, "Void", path);
            typeByName.set(name, { kind: "void", name: "Void" });
        } else {
            const objectType: ObjectType = {
                kind: "object",
                name,
                readOnly: bool(definition, "readOnly", path),
                additionalProperties: bool(definition, "additionalProperties", path),
                properties: new Map(),
                requiresAny: definition.requiresAny === undefined ? [] : strArray(definition, "requiresAny", path),
                aggregateConstraints: definition.aggregateConstraints === undefined ? [] : strArray(definition, "aggregateConstraints", path),
            };
            typeByName.set(name, objectType);
            objectSources.set(objectType, definition);
        }
    }
    for (const required of ["String", "Number", "Boolean", "Null", "Void"]) {
        if (!typeByName.has(required)) fail("types.types", `falta el tipo ${required}`);
    }
    typeByName.set("Unknown", { kind: "unknown", name: "Unknown" });

    for (const [objectType, definition] of objectSources) {
        const path = `types.types.${objectType.name}`;
        for (const [propertyName, value] of Object.entries(obj(definition, "properties", path))) {
            const propertyPath = `${path}.properties.${propertyName}`;
            const property = asObject(value, propertyPath);
            onlyKeys(property, ["type", "required", "readOnly", "minLength", "maxLength", "format"], propertyPath);
            const type = resolveTypeExpression(str(property, "type", propertyPath), typeByName, `${propertyPath}.type`);
            const readOnly = property.readOnly === undefined ? false : bool(property, "readOnly", propertyPath);
            const definitionOut: PropertyDefinition = {
                name: propertyName,
                type: type.kind === "array" && (readOnly || objectType.readOnly) ? arrayOf(type.element, true) : type,
                required: bool(property, "required", propertyPath),
                readOnly,
            };
            if (property.minLength !== undefined) definitionOut.minLength = int(property, "minLength", propertyPath);
            if (property.maxLength !== undefined) definitionOut.maxLength = int(property, "maxLength", propertyPath);
            if ((definitionOut.minLength !== undefined || definitionOut.maxLength !== undefined) && type.name !== "String") {
                fail(propertyPath, "minLength y maxLength solo aplican a String");
            }
            if (property.format !== undefined) {
                const format = str(property, "format", propertyPath);
                if (!formats.has(format)) fail(`${propertyPath}.format`, `formato inexistente: ${format}`);
                definitionOut.format = format;
            }
            objectType.properties.set(propertyName, definitionOut);
        }
        for (const name of objectType.requiresAny) {
            if (!objectType.properties.has(name)) fail(`${path}.requiresAny`, `propiedad inexistente: ${name}`);
        }
        for (const name of objectType.aggregateConstraints) {
            const aggregate = aggregates.get(name);
            if (!aggregate) fail(`${path}.aggregateConstraints`, `restricción inexistente: ${name}`);
            if (!aggregate.types.includes(objectType.name)) fail(`${path}.aggregateConstraints`, `${name} no declara ${objectType.name}`);
        }
    }

    const visiting = new Set<ObjectType>();
    const visited = new Set<ObjectType>();
    const checkCycles = (type: ObjectType): void => {
        if (visited.has(type)) return;
        if (visiting.has(type)) fail(`types.types.${type.name}`, "referencia circular obligatoria");
        visiting.add(type);
        for (const property of type.properties.values()) {
            if (property.required && property.type.kind === "object") checkCycles(property.type);
        }
        visiting.delete(type);
        visited.add(type);
    };
    for (const type of objectSources.keys()) checkCycles(type);

    return typeByName;
}

function loadFunctions(
    functions: JsonObject,
    typeByName: Map<string, Type>,
    formats: Map<string, FormatDefinition>
): { functionByName: Map<string, FunctionDefinition>; categories: Map<string, string>; requirements: Map<string, string> } {
    onlyKeys(functions, ["schemaVersion", "languageVersion", "caseSensitive", "callSyntax", "userWritesAwait", "categories", "requirements", "functions"], "functions");
    expectValue(functions.userWritesAwait, false, "functions.userWritesAwait");
    const categories = new Map(Object.entries(strRecord(functions, "categories", "functions")));
    const requirements = new Map(Object.entries(strRecord(functions, "requirements", "functions")));
    const functionByName = new Map<string, FunctionDefinition>();

    for (const [name, value] of Object.entries(obj(functions, "functions", "functions"))) {
        const path = `functions.functions.${name}`;
        const definition = asObject(value, path);
        onlyKeys(definition, ["kind", "description", "parameters", "returns", "requires", "signatures", "examples"], path);
        const kind = str(definition, "kind", path);
        if (!categories.has(kind)) fail(`${path}.kind`, `categoría inexistente: ${kind}`);

        if (!Array.isArray(definition.parameters)) fail(`${path}.parameters`, "se esperaba una lista");
        let optionalSeen = false;
        const parameters = definition.parameters.map((raw, index) => {
            const parameterPath = `${path}.parameters[${index}]`;
            const parameter = asObject(raw, parameterPath);
            onlyKeys(parameter, ["name", "type", "required", "format"], parameterPath);
            const required = bool(parameter, "required", parameterPath);
            if (required && optionalSeen) fail(parameterPath, "un parámetro obligatorio no puede seguir a uno opcional");
            optionalSeen = optionalSeen || !required;
            const format = parameter.format === undefined ? undefined : str(parameter, "format", parameterPath);
            if (format !== undefined && !formats.has(format)) fail(`${parameterPath}.format`, `formato inexistente: ${format}`);
            return {
                name: str(parameter, "name", parameterPath),
                type: resolveTypeExpression(str(parameter, "type", parameterPath), typeByName, `${parameterPath}.type`),
                required,
                format,
            };
        });

        const returnsJson = obj(definition, "returns", path);
        onlyKeys(returnsJson, ["type", "nullable", "readOnly", "elementTypeOfParameter"], `${path}.returns`);
        let returns = resolveTypeExpression(str(returnsJson, "type", `${path}.returns`), typeByName, `${path}.returns.type`);
        if (returns.kind === "array" && bool(returnsJson, "readOnly", `${path}.returns`)) returns = arrayOf(returns.element, true);
        const nullable = bool(returnsJson, "nullable", `${path}.returns`);
        if (nullable) returns = nullableOf(returns);
        let elementTypeOfParameter: number | undefined;
        if (returnsJson.elementTypeOfParameter !== undefined) {
            elementTypeOfParameter = int(returnsJson, "elementTypeOfParameter", `${path}.returns`);
            if (parameters[elementTypeOfParameter]?.type.kind !== "array") {
                fail(`${path}.returns.elementTypeOfParameter`, "tiene que señalar un parámetro de tipo array");
            }
        }

        const parameterNames = new Set(parameters.map((parameter) => parameter.name));
        if (parameterNames.size !== parameters.length) fail(`${path}.parameters`, "hay parámetros con el mismo nombre");

        const declared = {
            parameters: (definition.parameters as JsonObject[]).map((parameter) => ({
                name: parameter.name as string,
                required: parameter.required as boolean,
                type: parameter.type as string,
            })),
            returns: `${returnsJson.type as string}${nullable ? " | Null" : ""}`,
        };
        const signatures = strArray(definition, "signatures", path);
        if (signatures.length === 0) fail(`${path}.signatures`, "se esperaba al menos una firma");
        signatures.forEach((signature, index) => checkSignature(signature, name, declared, `${path}.signatures[${index}]`));

        functionByName.set(name, {
            name,
            kind,
            description: str(definition, "description", path),
            parameters,
            returns,
            nullable,
            ...(elementTypeOfParameter === undefined ? {} : { elementTypeOfParameter }),
            requires: definition.requires === undefined
                ? []
                : strArray(definition, "requires", path).map((requirement) => oneOf(requirement, [...requirements.keys()], `${path}.requires`)),
            signatures,
            examples: strArray(definition, "examples", path),
        });
    }
    return { functionByName, categories, requirements };
}

const SIGNATURE_PATTERN = /^([A-Za-z_$][\w$]*)\((.*)\): (.+)$/;
const SIGNATURE_PARAMETER_PATTERN = /^([A-Za-z_$][\w$]*)(\?)?: (.+)$/;

/** Separa los parámetros de una firma por comas fuera de `<...>`. */
function splitSignatureParameters(list: string): string[] {
    if (list.trim() === "") return [];
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    for (let index = 0; index < list.length; index++) {
        if (list[index] === "<") depth++;
        else if (list[index] === ">") depth--;
        else if (list[index] === "," && depth === 0) {
            parts.push(list.slice(start, index).trim());
            start = index + 1;
        }
    }
    parts.push(list.slice(start).trim());
    return parts;
}

/**
 * La firma documentada tiene que coincidir con la declaración: nombre, parámetros en orden,
 * obligatoriedad y tipos. Un tipo declarado con `Any` es genérico y la firma puede nombrarlo distinto.
 */
function checkSignature(
    signature: string,
    name: string,
    declared: { parameters: { name: string; required: boolean; type: string }[]; returns: string },
    path: string
) {
    const match = SIGNATURE_PATTERN.exec(signature);
    if (!match) fail(path, "la firma no tiene la forma nombre(parámetros): Tipo");
    const [, signatureName, list, returns] = match;
    if (signatureName !== name) fail(path, `la firma nombra ${signatureName} en lugar de ${name}`);
    const parameters = splitSignatureParameters(list);
    if (parameters.length !== declared.parameters.length) {
        fail(path, `la firma tiene ${parameters.length} parámetros y la función declara ${declared.parameters.length}`);
    }
    parameters.forEach((raw, index) => {
        const parameter = SIGNATURE_PARAMETER_PATTERN.exec(raw);
        const expected = declared.parameters[index];
        if (!parameter) fail(path, `parámetro inválido en la firma: ${raw}`);
        if (parameter[1] !== expected.name) fail(path, `el parámetro ${index + 1} se llama ${expected.name}, no ${parameter[1]}`);
        if ((parameter[2] === undefined) !== expected.required) fail(path, `el parámetro ${expected.name} no coincide en obligatoriedad`);
        if (!/\bAny\b/.test(expected.type) && parameter[3] !== expected.type) {
            fail(path, `el parámetro ${expected.name} es ${expected.type}, no ${parameter[3]}`);
        }
    });
    if (!/\bAny\b/.test(declared.returns) && returns !== declared.returns) {
        fail(path, `el retorno es ${declared.returns}, no ${returns}`);
    }
}

function loadFormatter(formatter: JsonObject): FormatterModel {
    const path = "formatter";
    onlyKeys(formatter, ["schemaVersion", "languageVersion", "indentation", "strings", "statements", "blocks", "spacing", "objects", "arrays", "calls", "parentheses", "comments", "invalidSource", "properties", "examples"], path);

    const indentation = obj(formatter, "indentation", path);
    const style = oneOf(str(indentation, "style", `${path}.indentation`), ["space", "tab"], `${path}.indentation.style`);
    const size = int(indentation, "size", `${path}.indentation`);

    const strings = obj(formatter, "strings", path);
    const quote = oneOf(str(strings, "preferredQuote", `${path}.strings`), ["double", "single"], `${path}.strings.preferredQuote`);
    expectValue(strings.preserveValue, true, `${path}.strings.preserveValue`);
    expectValue(strings.escapePreferredQuote, true, `${path}.strings.escapePreferredQuote`);

    const statements = obj(formatter, "statements", path);
    expectValue(statements.onePerLine, true, `${path}.statements.onePerLine`);
    const semicolons = oneOf(str(statements, "semicolons", `${path}.statements`), ["omit", "always"], `${path}.statements.semicolons`);
    const blankLines = obj(statements, "blankLines", `${path}.statements`);

    const blocks = obj(formatter, "blocks", path);
    expectValue(blocks.openingBrace, "same-line", `${path}.blocks.openingBrace`);
    expectValue(blocks.closingBrace, "own-line", `${path}.blocks.closingBrace`);
    expectValue(blocks.emptyBlock, "multiline", `${path}.blocks.emptyBlock`);
    expectValue(blocks.elsePlacement, "same-line-after-closing-brace", `${path}.blocks.elsePlacement`);
    expectValue(blocks.elseIfPlacement, "same-line", `${path}.blocks.elseIfPlacement`);

    const spacing = obj(formatter, "spacing", path);
    expectValue(spacing.beforeComma, false, `${path}.spacing.beforeComma`);
    expectValue(spacing.betweenFunctionNameAndParenthesis, false, `${path}.spacing.betweenFunctionNameAndParenthesis`);
    expectValue(spacing.insideParentheses, false, `${path}.spacing.insideParentheses`);
    expectValue(spacing.insideBrackets, false, `${path}.spacing.insideBrackets`);
    bool(spacing, "insideInlineObjectBraces", `${path}.spacing`);

    const objects = obj(formatter, "objects", path);
    expectValue(objects.keys, "unquoted-identifiers", `${path}.objects.keys`);
    expectValue(objects.propertyPerLineWhenMultiline, true, `${path}.objects.propertyPerLineWhenMultiline`);
    const arrays = obj(formatter, "arrays", path);
    expectValue(arrays.elementPerLineWhenMultiline, true, `${path}.arrays.elementPerLineWhenMultiline`);
    const calls = obj(formatter, "calls", path);
    expectValue(calls.argumentPerLineWhenMultiline, true, `${path}.calls.argumentPerLineWhenMultiline`);
    const trailing = (section: JsonObject, name: string): boolean =>
        oneOf(str(section, "trailingComma", `${path}.${name}`), ["multiline", "none"], `${path}.${name}.trailingComma`) === "multiline";

    const parentheses = obj(formatter, "parentheses", path);
    expectValue(parentheses.preserveRequiredByPrecedence, true, `${path}.parentheses.preserveRequiredByPrecedence`);
    expectValue(parentheses.removeRedundant, false, `${path}.parentheses.removeRedundant`);

    const comments = obj(formatter, "comments", path);
    expectValue(comments.preserve, true, `${path}.comments.preserve`);
    expectValue(comments.blockCommentPreserveContent, true, `${path}.comments.blockCommentPreserveContent`);

    const invalidSource = obj(formatter, "invalidSource", path);
    expectValue(invalidSource.strategy, "preserve-source", `${path}.invalidSource.strategy`);
    expectValue(invalidSource.replaceEditorContent, false, `${path}.invalidSource.replaceEditorContent`);

    const properties = obj(formatter, "properties", path);
    expectValue(properties.idempotent, true, `${path}.properties.idempotent`);
    expectValue(properties.semanticPreserving, true, `${path}.properties.semanticPreserving`);

    const examples = Array.isArray(formatter.examples)
        ? formatter.examples.map((raw, index) => {
            const example = asObject(raw, `${path}.examples[${index}]`);
            return { input: str(example, "input", `${path}.examples[${index}]`), output: str(example, "output", `${path}.examples[${index}]`) };
        })
        : [];

    return {
        indent: style === "tab" ? "\t" : " ".repeat(size),
        quote: quote === "double" ? "\"" : "'",
        semicolons: semicolons === "always",
        maxBlankLines: int(blankLines, "maximumConsecutive", `${path}.statements.blankLines`),
        spaceAroundBinary: bool(spacing, "aroundBinaryOperators", `${path}.spacing`),
        spaceAroundLogical: bool(spacing, "aroundLogicalOperators", `${path}.spacing`),
        spaceAroundAssignment: bool(spacing, "aroundAssignmentOperators", `${path}.spacing`),
        spaceAfterComma: bool(spacing, "afterComma", `${path}.spacing`),
        spaceAfterKeyword: bool(spacing, "afterKeywordsBeforeParenthesis", `${path}.spacing`),
        objectTrailingComma: trailing(objects, "objects"),
        arrayTrailingComma: trailing(arrays, "arrays"),
        callTrailingComma: trailing(calls, "calls"),
        printWidth: DEFAULT_PRINT_WIDTH,
        examples,
    };
}

function loadDynamicResources(manifest: JsonObject, functionByName: Map<string, FunctionDefinition>): Map<string, DynamicResource> {
    const resources = new Map<string, DynamicResource>();
    const dynamicData = obj(manifest, "dynamicData", "manifest");
    expectValue(dynamicData.includedInContract, false, "manifest.dynamicData.includedInContract");
    for (const [name, value] of Object.entries(obj(dynamicData, "resources", "manifest.dynamicData"))) {
        const path = `manifest.dynamicData.resources.${name}`;
        const resource = asObject(value, path);
        const generatedExpression = str(resource, "generatedExpression", path);
        const functionName = /^([A-Za-z_][A-Za-z0-9_]*)\(/.exec(generatedExpression)?.[1];
        if (!functionName || !functionByName.has(functionName)) fail(`${path}.generatedExpression`, "no llama a una función del contrato");
        if (!generatedExpression.includes("{id}")) fail(`${path}.generatedExpression`, "falta {id}");
        resources.set(name, {
            name,
            displayField: str(resource, "displayField", path),
            valueField: str(resource, "valueField", path),
            generatedExpression,
            functionName,
        });
    }
    return resources;
}

export function loadContract(bundle: ContractBundle): LanguageContract {
    const manifest = asObject(bundle.manifest, "manifest");
    const schemaVersion = manifest.schemaVersion;
    if (typeof schemaVersion !== "number" || !SUPPORTED_SCHEMA_VERSIONS.includes(schemaVersion)) {
        fail("manifest.schemaVersion", `versión de esquema no soportada: ${String(schemaVersion)}`);
    }
    const language = obj(manifest, "language", "manifest");
    const languageVersion = str(language, "version", "manifest.language");
    const references = strRecord(manifest, "contracts", "manifest");

    const contracts = {} as Record<(typeof REQUIRED_CONTRACTS)[number], JsonObject>;
    for (const name of REQUIRED_CONTRACTS) {
        const reference = references[name];
        if (!reference) fail(`manifest.contracts.${name}`, "falta la referencia");
        if (!(reference in bundle.files)) fail(`manifest.contracts.${name}`, `no se encontró ${reference}`);
        contracts[name] = asObject(bundle.files[reference], name);
        checkVersions(contracts[name], name, languageVersion);
    }

    const lexical = loadLexical(contracts.syntax);
    const grammar = loadGrammar(contracts.syntax);
    const supportedOperators = new Set(strArray(obj(contracts.syntax, "operators", "syntax"), "supported", "syntax.operators"));
    const rules = loadRules(contracts.rules, supportedOperators);
    const formatByName = loadFormats(contracts.rules);
    const aggregateByName = loadAggregates(contracts.rules);
    const typeByName = loadTypes(contracts.types, formatByName, aggregateByName);
    const { functionByName, categories, requirements } = loadFunctions(contracts.functions, typeByName, formatByName);

    for (const [name, rule] of rules.operators) {
        for (const typeName of [rule.acceptedOperand, rule.returns, ...Object.values(rule.returnsByPair ?? {})]) {
            if (typeName === undefined || typeName === "left-type" || typeName === "mutable-number-target") continue;
            if (!typeByName.has(typeName)) fail(`rules.operators.${name}`, `tipo inexistente: ${typeName}`);
        }
        if (Array.isArray(rule.acceptedPairs)) {
            for (const pair of rule.acceptedPairs) {
                for (const typeName of pair) {
                    if (!typeByName.has(typeName)) fail(`rules.operators.${name}.acceptedPairs`, `tipo inexistente: ${typeName}`);
                }
            }
        }
    }
    for (const level of grammar.binaryLevels) {
        for (const op of level.operators) if (!rules.operators.has(op)) fail(`rules.operators.${op}`, "falta la regla");
    }
    for (const op of grammar.unaryOperators) {
        if (!rules.operators.has(unaryRuleName(rules, op))) fail(`rules.operators.unary${op}`, "falta la regla");
    }
    for (const op of grammar.assignmentOperators) if (!rules.operators.has(op)) fail(`rules.operators.${op}`, "falta la regla");

    const templates = new Map(Object.entries(strRecord(contracts.rules, "diagnosticTemplates", "rules")));
    for (const aggregate of aggregateByName.values()) {
        if (!templates.has(aggregate.diagnosticCode)) fail(`rules.aggregateConstraints.${aggregate.name}`, `falta la plantilla ${aggregate.diagnosticCode}`);
    }
    for (const format of formatByName.values()) {
        if (!templates.has(format.diagnosticCode)) fail(`rules.formats.${format.name}`, `falta la plantilla ${format.diagnosticCode}`);
    }

    return {
        languageId: str(language, "id", "manifest.language"),
        languageName: str(language, "name", "manifest.language"),
        languageVersion,
        contractVersion: str(manifest, "contractVersion", "manifest"),
        lexical,
        grammar,
        rules,
        formatter: loadFormatter(contracts.formatter),
        typeByName,
        functionByName,
        functionCategories: categories,
        functionRequirements: requirements,
        formatByName,
        aggregateByName,
        templates,
        dynamicResources: loadDynamicResources(manifest, functionByName),
        outOfScope: strArray(manifest, "outOfScope", "manifest"),
    };
}
