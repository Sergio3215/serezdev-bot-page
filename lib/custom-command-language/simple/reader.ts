import type { LanguageContract, ObjectType, Type } from "../contract/model";
import { format } from "../formatter/formatter";
import type { CallExpression, Expression, Statement } from "../parser/ast";
import { parse } from "../parser/parser";
import { tokenize } from "../tokenizer/tokenizer";
import { contextSources, generateSource, queryResolver, simpleShape, type SimpleAction, type SimpleValue } from "./generator";

/** Recurso dinámico cuya función genera el tipo de referencia indicado. */
function referenceFunction(contract: LanguageContract, type: Type): string | null {
    for (const resource of contract.dynamicResources.values()) {
        if (contract.functionByName.get(resource.functionName)?.returns.name === type.name) return resource.functionName;
    }
    return null;
}

/** ID de una llamada `Función("id")` a la función indicada. */
function idArgument(node: Expression, functionName: string | null): string | undefined {
    if (node.parens || node.type !== "CallExpression" || node.callee.name !== functionName || node.arguments.length !== 1) return undefined;
    const [id] = node.arguments;
    return id.type === "StringLiteral" && !id.parens ? id.value : undefined;
}

function readValue(contract: LanguageContract, type: Type, node: Expression): SimpleValue | undefined {
    if (node.parens) return undefined;
    if (type.kind === "object" && type.readOnly) return idArgument(node, referenceFunction(contract, type));
    if (type.kind === "object") return node.type === "ObjectExpression" ? readObject(contract, type, node) : undefined;
    if (type.name === "String") return node.type === "StringLiteral" ? node.value : undefined;
    return undefined;
}

function readObject(contract: LanguageContract, type: ObjectType, node: Expression): Record<string, SimpleValue> | undefined {
    if (node.type !== "ObjectExpression" || node.parens) return undefined;
    const values: Record<string, SimpleValue> = {};
    for (const property of node.properties) {
        const definition = type.properties.get(property.key.name);
        if (!definition || property.key.name in values) return undefined;
        const value = readValue(contract, definition.type, property.value);
        if (value === undefined) return undefined;
        values[property.key.name] = value;
    }
    return values;
}

/**
 * Variables del código generado: una consulta por ID (`const member = GetMember("id")`) o la
 * variable de un recorrido sobre una fuente del mensaje (`for (const member of GetMentionedMembers())`).
 */
type Bindings = Map<string, { functionName: string; id: string } | { source: string }>;

function readCall(contract: LanguageContract, call: CallExpression, bindings: Bindings): SimpleAction | null {
    const definition = contract.functionByName.get(call.callee.name);
    const shape = definition ? simpleShape(contract, definition) : null;
    if (!definition || !shape || call.parens) return null;

    if (shape.kind === "config") {
        if (call.arguments.length !== 1) return null;
        const values = readObject(contract, shape.type, call.arguments[0]);
        return values ? { functionName: definition.name, values } : null;
    }

    if (call.arguments.length !== shape.parameters.length) return null;
    const values: Record<string, SimpleValue> = {};
    for (const [index, parameter] of shape.parameters.entries()) {
        const argument = call.arguments[index];
        const reference = idArgument(argument, referenceFunction(contract, parameter.type));
        if (reference !== undefined) {
            values[parameter.name] = reference;
            continue;
        }
        const sources = contextSources(contract, parameter.type);
        if (argument.type === "CallExpression" && argument.arguments.length === 0 && !argument.parens
            && sources.some((candidate) => !candidate.many && candidate.definition.name === argument.callee.name)) {
            values[parameter.name] = { source: argument.callee.name };
            continue;
        }
        const binding = argument.type === "Identifier" && !argument.parens ? bindings.get(argument.name) : undefined;
        if (binding && "source" in binding && sources.some((candidate) => candidate.many && candidate.definition.name === binding.source)) {
            values[parameter.name] = { source: binding.source };
            continue;
        }
        if (!binding || !("id" in binding) || binding.functionName !== queryResolver(contract, parameter.type)?.name) return null;
        values[parameter.name] = binding.id;
    }
    return { functionName: definition.name, values };
}

/** Recorre las instrucciones y junta las acciones; cualquier otra forma hace que el código no sea "simple". */
function readStatements(contract: LanguageContract, statements: Statement[], bindings: Bindings, actions: SimpleAction[]): boolean {
    for (const statement of statements) {
        if (statement.type === "ExpressionStatement" && statement.expression.type === "CallExpression") {
            const action = readCall(contract, statement.expression, bindings);
            if (!action) return false;
            actions.push(action);
        } else if (statement.type === "VariableDeclaration" && statement.kind === "const" && statement.declarations.length === 1) {
            const [declarator] = statement.declarations;
            const init = declarator.init;
            if (!init || init.type !== "CallExpression") return false;
            const resolver = contract.functionByName.get(init.callee.name);
            const id = idArgument(init, resolver?.name ?? null);
            if (!resolver || id === undefined || resolver.kind !== "query") return false;
            bindings.set(declarator.id.name, { functionName: resolver.name, id });
        } else if (statement.type === "ForOfStatement" && statement.left.kind === "const") {
            const source = statement.right;
            if (source.type !== "CallExpression" || source.arguments.length > 0 || source.parens) return false;
            const definition = contract.functionByName.get(source.callee.name);
            if (!definition || definition.kind !== "query" || definition.returns.kind !== "array") return false;
            bindings.set(statement.left.declarations[0].id.name, { source: definition.name });
            if (!readStatements(contract, statement.body.body, bindings, actions)) return false;
        } else if (statement.type === "IfStatement" && !statement.alternate) {
            const test = statement.test;
            const guardsBinding = test.type === "BinaryExpression" && test.operator === "!=="
                && test.left.type === "Identifier" && bindings.has(test.left.name) && test.right.type === "NullLiteral";
            if (!guardsBinding || !readStatements(contract, statement.consequent.body, bindings, actions)) return false;
        } else {
            return false;
        }
    }
    return true;
}

/**
 * Reconstruye el modelo del modo simple a partir del código. Devuelve null si el código usa algo
 * que los controles no representan (variables propias, condiciones, comentarios), para no
 * perder nada al mostrarlo en el modo simple.
 */
export function readSimpleSource(contract: LanguageContract, source: string): SimpleAction[] | null {
    const tokens = tokenize(source, contract);
    if (!tokens.ok || tokens.trivia.length > 0) return null;
    const parsed = parse(tokens.tokens, contract);
    if (!parsed.ok || parsed.ast.body.length === 0) return null;

    const actions: SimpleAction[] = [];
    if (!readStatements(contract, parsed.ast.body, new Map(), actions) || actions.length === 0) return null;

    const formatted = format(source, contract);
    try {
        return formatted.ok && generateSource(contract, actions) === formatted.code ? actions : null;
    } catch {
        return null;
    }
}
