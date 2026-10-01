import type { ArrayType, LanguageContract, ObjectType, Type, UnionType } from "../contract/model";

export const UNKNOWN: Type = { kind: "unknown", name: "Unknown" };

export function scalar(contract: LanguageContract, name: string): Type {
    return contract.typeByName.get(name) ?? UNKNOWN;
}

export function isNullType(type: Type): boolean {
    return type.kind === "scalar" && type.name === "Null";
}

export function isNullable(type: Type): type is UnionType {
    return type.kind === "union" && type.members.some(isNullType);
}

export function withoutNull(type: Type): Type {
    if (type.kind !== "union") return type;
    const members = type.members.filter((member) => !isNullType(member));
    if (members.length === 1) return members[0];
    return { kind: "union", name: members.map((member) => member.name).join(" | "), members };
}

export function arrayType(element: Type, readOnly: boolean): ArrayType {
    return { kind: "array", name: `Array<${element.name}>`, element, readOnly };
}

export function sameType(a: Type, b: Type): boolean {
    if (a.kind !== b.kind) return false;
    if (a.kind === "array" && b.kind === "array") return sameType(a.element, b.element);
    if (a.kind === "union" && b.kind === "union") {
        return a.members.length === b.members.length && a.members.every((member) => b.members.some((other) => sameType(member, other)));
    }
    if (a.kind === "literal-object" && b.kind === "literal-object") {
        if (a.properties.size !== b.properties.size) return false;
        for (const [name, property] of a.properties) {
            const other = b.properties.get(name);
            if (!other || !sameType(property.type, other.type)) return false;
        }
        return true;
    }
    return a.name === b.name;
}

/** Comprobación estructural sin diagnósticos de un objeto literal contra una configuración. */
function literalFitsObject(source: Type, target: ObjectType): boolean {
    if (source.kind !== "literal-object" || target.readOnly) return false;
    for (const [name, property] of source.properties) {
        const definition = target.properties.get(name);
        if (!definition) {
            if (!target.additionalProperties) return false;
            continue;
        }
        if (!isAssignable(property.type, definition.type)) return false;
    }
    for (const [name, definition] of target.properties) {
        if (definition.required && !source.properties.has(name)) return false;
    }
    return true;
}

export function isAssignable(source: Type, target: Type): boolean {
    if (source.kind === "unknown" || target.kind === "unknown") return true;
    if (source.kind === "union") return source.members.every((member) => isAssignable(member, target));
    if (target.kind === "union") return target.members.some((member) => isAssignable(source, member));
    if (source.kind === "void" || target.kind === "void") return false;
    switch (target.kind) {
        case "scalar":
            return source.kind === "scalar" && source.name === target.name;
        case "array":
            return source.kind === "array" && isAssignable(source.element, target.element);
        case "object":
            if (source.kind === "object") return source.name === target.name;
            return literalFitsObject(source, target);
        case "literal-object":
            return source.kind === "literal-object" && sameType(source, target);
    }
}
