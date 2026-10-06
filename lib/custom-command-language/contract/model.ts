import type { Expression, Property } from "../parser/ast";

export type ScalarName = "String" | "Number" | "Boolean" | "Null";

export interface ScalarType {
    kind: "scalar";
    name: ScalarName;
}

export interface VoidType {
    kind: "void";
    name: "Void";
}

/** Tipo sin restricciones: `Unknown` lo infiere el motor; `Any` lo declara el contrato y acepta cualquier valor. */
export interface UnknownType {
    kind: "unknown";
    name: "Unknown" | "Any";
}

export interface PropertyDefinition {
    name: string;
    type: Type;
    required: boolean;
    readOnly: boolean;
    minLength?: number;
    maxLength?: number;
    format?: string;
}

export interface ObjectType {
    kind: "object";
    name: string;
    readOnly: boolean;
    additionalProperties: boolean;
    properties: Map<string, PropertyDefinition>;
    requiresAny: string[];
    aggregateConstraints: string[];
}

export interface ArrayType {
    kind: "array";
    name: string;
    element: Type;
    readOnly: boolean;
}

export interface UnionType {
    kind: "union";
    name: string;
    members: Type[];
}

/** Tipo estructural de un objeto escrito en el código. */
export interface LiteralObjectType {
    kind: "literal-object";
    name: "Object";
    properties: Map<string, { type: Type; node: Property; value: Expression }>;
}

export type Type = ScalarType | VoidType | UnknownType | ObjectType | ArrayType | UnionType | LiteralObjectType;

export interface ParameterDefinition {
    name: string;
    type: Type;
    required: boolean;
    format?: string;
}

export interface FunctionDefinition {
    name: string;
    kind: string;
    description: string;
    parameters: ParameterDefinition[];
    returns: Type;
    nullable: boolean;
    /** Si está, la función devuelve el tipo de elemento del array recibido en ese parámetro (p. ej. elegir uno de una lista). */
    elementTypeOfParameter?: number;
    /** Lo que el mensaje tiene que traer para que el comando se ejecute, p. ej. "mention". */
    requires: string[];
    signatures: string[];
    examples: string[];
}

interface FormatBase {
    name: string;
    description: string;
    diagnosticCode: string;
}

export type FormatDefinition =
    | (FormatBase & { kind: "pattern"; pattern: RegExp })
    | (FormatBase & { kind: "protocols"; protocols: string[] });

export interface AggregateConstraint {
    name: string;
    types: string[];
    properties: string[];
    maxTotalLength: number;
    diagnosticCode: string;
}

export type OperatorOperand = "any" | [string, string][];

export interface OperatorRule {
    operator: string;
    acceptedPairs?: OperatorOperand;
    acceptedOperand?: string;
    returns?: string;
    returnsByPair?: Record<string, string>;
}

export interface BindingRule {
    requiresInitializer: boolean;
    mutable: boolean;
}

export interface RulesModel {
    minimumStatements: number;
    duplicateDeclarationIsError: boolean;
    shadowingIsError: boolean;
    bindings: Map<string, BindingRule>;
    forOfBindingKinds: Set<string>;
    loopControlAncestors: Map<string, string[]>;
    duplicatePropertiesIsError: boolean;
    unknownConfigPropertiesIsError: boolean;
    missingRequiredIsError: boolean;
    nullableRequiresNarrowing: boolean;
    unknownPropertyIsError: boolean;
    /** Patrones de `rules.nullNarrowing.supportedPatterns`, p. ej. "identifier !== null". */
    narrowing: { enabled: boolean; patterns: Set<string>; consequent: boolean; alternate: boolean };
    operators: Map<string, OperatorRule>;
}

export interface BinaryLevel {
    operators: Set<string>;
    logical: boolean;
    rightAssociative: boolean;
}

export interface LexicalModel {
    identifierStart: RegExp;
    identifierPart: RegExp;
    ignoredWhitespace: Set<string>;
    keywords: Map<string, string>;
    delimiters: Map<string, string>;
    operators: string[];
    unsupportedOperators: Map<string, string>;
    unsupportedLexemes: Map<string, string>;
    /** Palabra de JavaScript → construcción de `syntax.unsupportedConstructs` que representa. */
    unsupportedWords: Map<string, string>;
    constructLabels: Map<string, string>;
    quotes: Set<string>;
    escapes: Map<string, string>;
    unicodeEscape: boolean;
    lineComment: string;
    blockCommentOpen: string;
    blockCommentClose: string;
    templateStrings: boolean;
    decimalNumbers: boolean;
}

export interface GrammarModel {
    statements: Set<string>;
    expressions: Set<string>;
    variableKinds: Set<string>;
    multipleDeclarators: boolean;
    elseIf: boolean;
    else: boolean;
    forOfKinds: Set<string>;
    loopControlLabels: boolean;
    callTrailingComma: boolean;
    objectTrailingComma: boolean;
    arrayTrailingComma: boolean;
    quotedKeys: boolean;
    memberDot: boolean;
    memberComputed: boolean;
    updatePrefix: boolean;
    updatePostfix: boolean;
    unaryOperators: Set<string>;
    binaryLevels: BinaryLevel[];
    assignmentOperators: Set<string>;
    unsupportedConstructs: Set<string>;
}

export interface FormatterModel {
    indent: string;
    quote: "\"" | "'";
    semicolons: boolean;
    maxBlankLines: number;
    spaceAroundBinary: boolean;
    spaceAroundLogical: boolean;
    spaceAroundAssignment: boolean;
    spaceAfterComma: boolean;
    spaceAfterKeyword: boolean;
    objectTrailingComma: boolean;
    arrayTrailingComma: boolean;
    callTrailingComma: boolean;
    printWidth: number;
    examples: { input: string; output: string }[];
}

export interface DynamicResource {
    name: string;
    displayField: string;
    valueField: string;
    generatedExpression: string;
    functionName: string;
}

export interface LanguageContract {
    languageId: string;
    languageName: string;
    languageVersion: string;
    contractVersion: string;
    lexical: LexicalModel;
    grammar: GrammarModel;
    rules: RulesModel;
    formatter: FormatterModel;
    typeByName: Map<string, Type>;
    functionByName: Map<string, FunctionDefinition>;
    functionCategories: Map<string, string>;
    functionRequirements: Map<string, string>;
    formatByName: Map<string, FormatDefinition>;
    aggregateByName: Map<string, AggregateConstraint>;
    templates: Map<string, string>;
    dynamicResources: Map<string, DynamicResource>;
    outOfScope: string[];
}
