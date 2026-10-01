import type { FunctionDefinition, LanguageContract, ObjectType, ParameterDefinition, Type } from "../contract/model";
import { format } from "../formatter/formatter";
import { printString } from "../formatter/stringPrinter";

/**
 * Valor elegido en un control visual. Un string vacío, null o undefined significa "no elegido"
 * y omite la propiedad: así el canal actual no genera `channel: null`.
 */
export type SimpleValue = string | null | undefined | { [property: string]: SimpleValue };

export interface SimpleAction {
    /** Función del contrato que el modo simple sabe generar (ver `simpleShape`). */
    functionName: string;
    values: Record<string, SimpleValue>;
}

export class SimpleModelError extends Error {}

function isEmpty(value: SimpleValue): boolean {
    if (value === null || value === undefined || value === "") return true;
    return typeof value === "object" && Object.values(value).every(isEmpty);
}

/** Recurso dinámico (canales, roles) cuya función genera el tipo indicado, p. ej. `Channel` → `ChannelReference`. */
export function referenceExpression(contract: LanguageContract, type: Type, id: string): string | null {
    for (const resource of contract.dynamicResources.values()) {
        const returns = contract.functionByName.get(resource.functionName)?.returns;
        if (returns?.name !== type.name) continue;
        const quotedId = printString(id, "\"");
        return resource.generatedExpression.includes("\"{id}\"")
            ? resource.generatedExpression.replace("\"{id}\"", quotedId)
            : resource.generatedExpression.replace("{id}", id);
    }
    return null;
}

function printValue(contract: LanguageContract, type: Type, value: SimpleValue, path: string): string {
    if (type.kind === "object" && type.readOnly) {
        if (typeof value !== "string") throw new SimpleModelError(`${path} espera el ID elegido`);
        const expression = referenceExpression(contract, type, value);
        if (!expression) throw new SimpleModelError(`${path}: no hay un recurso dinámico para ${type.name}`);
        return expression;
    }
    if (type.kind === "object") {
        if (typeof value !== "object" || value === null) throw new SimpleModelError(`${path} espera un objeto`);
        return printObject(contract, type, value, path);
    }
    if (type.name === "String") {
        if (typeof value !== "string") throw new SimpleModelError(`${path} espera texto`);
        return printString(value, contract.formatter.quote);
    }
    throw new SimpleModelError(`${path}: el modo simple no genera valores ${type.name}`);
}

function printObject(contract: LanguageContract, type: ObjectType, values: Record<string, SimpleValue>, path: string): string {
    for (const name of Object.keys(values)) {
        if (!type.properties.has(name)) throw new SimpleModelError(`${path} no admite ${name}`);
    }
    const entries: string[] = [];
    for (const [name, property] of type.properties) {
        const value = values[name];
        if (isEmpty(value)) continue;
        entries.push(`${name}: ${printValue(contract, property.type, value, `${path}.${name}`)}`);
    }
    return `{ ${entries.join(", ")} }`;
}

/**
 * Consulta que obtiene un valor del tipo indicado a partir de un ID y puede devolver null,
 * p. ej. `GetMember` para `Member`. El código generado la guarda en una variable y descarta null.
 */
export function queryResolver(contract: LanguageContract, type: Type): FunctionDefinition | null {
    for (const definition of contract.functionByName.values()) {
        const [parameter] = definition.parameters;
        if (definition.kind !== "query" || !definition.nullable || definition.parameters.length !== 1) continue;
        if (parameter.type.name !== "String" || parameter.format !== "snowflake") continue;
        const returns = definition.returns;
        if (returns.kind === "union" && returns.members.some((member) => member.name === type.name)) return definition;
    }
    return null;
}

export type SimpleShape =
    | { kind: "config"; type: ObjectType }
    | { kind: "direct"; parameters: ParameterDefinition[] };

/**
 * Cómo arma el modo simple una función: con un único objeto de configuración (mensajes, tarjetas)
 * o, si es una acción, con parámetros que se eligen de listas (roles, miembros). Null si no se puede.
 */
export function simpleShape(contract: LanguageContract, definition: FunctionDefinition): SimpleShape | null {
    const [parameter] = definition.parameters;
    if (definition.parameters.length === 1 && parameter.type.kind === "object" && !parameter.type.readOnly) {
        return { kind: "config", type: parameter.type };
    }
    if (definition.kind !== "action" || definition.parameters.length === 0) return null;
    const resolvable = definition.parameters.every((candidate) =>
        candidate.required && candidate.type.kind === "object" && candidate.type.readOnly
        && (referenceExpression(contract, candidate.type, "") !== null
            || queryResolver(contract, candidate.type) !== null
            || contextSources(contract, candidate.type).length > 0)
    );
    return resolvable ? { kind: "direct", parameters: definition.parameters } : null;
}

function uniqueName(base: string, used: Set<string>): string {
    let name = base;
    for (let suffix = 2; used.has(name); suffix++) name = `${base}${suffix}`;
    used.add(name);
    return name;
}

/**
 * Consultas sin parámetros que entregan valores del tipo indicado desde el mensaje, p. ej.
 * `GetAuthor` (uno) o `GetMentionedMembers` (varios). Solo las que nunca devuelven null.
 */
export function contextSources(contract: LanguageContract, type: Type): { definition: FunctionDefinition; many: boolean }[] {
    return [...contract.functionByName.values()].flatMap((definition): { definition: FunctionDefinition; many: boolean }[] => {
        if (definition.kind !== "query" || definition.parameters.length > 0 || definition.nullable) return [];
        const returns = definition.returns;
        if (returns.name === type.name) return [{ definition, many: false }];
        if (returns.kind === "array" && returns.element.name === type.name) return [{ definition, many: true }];
        return [];
    });
}

/** Valor de un parámetro de miembro que viene del mensaje en vez de un ID fijo. */
export function sourceOf(value: SimpleValue): string | null {
    return typeof value === "object" && value !== null && typeof value.source === "string" ? value.source : null;
}

function directStatement(contract: LanguageContract, definition: FunctionDefinition, values: Record<string, SimpleValue>, used: Set<string>): string {
    const declarations: string[] = [];
    const guards: string[] = [];
    const loops: { variable: string; source: string }[] = [];
    const args = definition.parameters.map((parameter) => {
        const value = values[parameter.name];
        const source = sourceOf(value);
        if (source !== null) {
            const match = contextSources(contract, parameter.type).find((candidate) => candidate.definition.name === source);
            if (!match) throw new SimpleModelError(`${definition.name}.${parameter.name} no admite ${source}`);
            if (!match.many) return `${source}()`;
            const variable = uniqueName(parameter.name, used);
            loops.push({ variable, source });
            return variable;
        }
        const id = typeof value === "string" ? value : "";
        const reference = referenceExpression(contract, parameter.type, id);
        if (reference !== null) return reference;
        const resolver = queryResolver(contract, parameter.type);
        if (!resolver) throw new SimpleModelError(`${definition.name}.${parameter.name} no se puede elegir desde el modo simple`);
        const variable = uniqueName(parameter.name, used);
        declarations.push(`const ${variable} = ${resolver.name}(${printString(id, contract.formatter.quote)})`);
        guards.push(variable);
        return variable;
    });
    let body = `${definition.name}(${args.join(", ")})`;
    for (const variable of [...guards].reverse()) body = `if (${variable} !== null) {\n${body}\n}`;
    for (const loop of [...loops].reverse()) body = `for (const ${loop.variable} of ${loop.source}()) {\n${body}\n}`;
    return [...declarations, body].join("\n");
}

/** Genera código fuente del lenguaje; el resultado se formatea y debe analizarse como cualquier otro código. */
export function generateSource(contract: LanguageContract, actions: SimpleAction[]): string {
    const used = new Set<string>();
    const statements = actions.map((action) => {
        const definition = contract.functionByName.get(action.functionName);
        if (!definition) throw new SimpleModelError(`Función inexistente: ${action.functionName}`);
        const shape = simpleShape(contract, definition);
        if (!shape) throw new SimpleModelError(`${action.functionName} no se genera desde el modo simple`);
        if (shape.kind === "direct") return directStatement(contract, definition, action.values, used);
        return `${definition.name}(${printObject(contract, shape.type, action.values, definition.name)})`;
    });
    const source = statements.join("\n");
    const formatted = format(source, contract);
    return formatted.ok ? formatted.code : source;
}
