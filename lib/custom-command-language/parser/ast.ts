import type { Loc } from "../diagnostics";

interface BaseNode {
    loc: Loc;
    /** Pares de paréntesis que rodeaban la expresión en el código; el formatter los conserva. */
    parens?: number;
}

export interface Program extends BaseNode {
    type: "Program";
    body: Statement[];
}

export interface BlockStatement extends BaseNode {
    type: "BlockStatement";
    body: Statement[];
}

export interface ExpressionStatement extends BaseNode {
    type: "ExpressionStatement";
    expression: Expression;
}

export interface VariableDeclaration extends BaseNode {
    type: "VariableDeclaration";
    kind: string;
    declarations: VariableDeclarator[];
}

export interface VariableDeclarator extends BaseNode {
    type: "VariableDeclarator";
    id: Identifier;
    init: Expression | null;
}

export interface IfStatement extends BaseNode {
    type: "IfStatement";
    test: Expression;
    consequent: BlockStatement;
    alternate: IfStatement | BlockStatement | null;
}

export interface ForOfStatement extends BaseNode {
    type: "ForOfStatement";
    left: VariableDeclaration;
    right: Expression;
    body: BlockStatement;
}

export interface BreakStatement extends BaseNode {
    type: "BreakStatement";
}

export interface ContinueStatement extends BaseNode {
    type: "ContinueStatement";
}

export interface Identifier extends BaseNode {
    type: "Identifier";
    name: string;
}

export interface StringLiteral extends BaseNode {
    type: "StringLiteral";
    value: string;
    raw: string;
}

export interface NumberLiteral extends BaseNode {
    type: "NumberLiteral";
    value: number;
    raw: string;
}

export interface BooleanLiteral extends BaseNode {
    type: "BooleanLiteral";
    value: boolean;
}

export interface NullLiteral extends BaseNode {
    type: "NullLiteral";
}

export interface CallExpression extends BaseNode {
    type: "CallExpression";
    callee: Identifier;
    arguments: Expression[];
}

export interface Property extends BaseNode {
    type: "Property";
    key: Identifier;
    value: Expression;
}

export interface ObjectExpression extends BaseNode {
    type: "ObjectExpression";
    properties: Property[];
}

export interface ArrayExpression extends BaseNode {
    type: "ArrayExpression";
    elements: Expression[];
}

export interface MemberExpression extends BaseNode {
    type: "MemberExpression";
    object: Expression;
    property: Expression;
    computed: boolean;
}

export interface BinaryExpression extends BaseNode {
    type: "BinaryExpression";
    operator: string;
    left: Expression;
    right: Expression;
}

export interface LogicalExpression extends BaseNode {
    type: "LogicalExpression";
    operator: string;
    left: Expression;
    right: Expression;
}

export interface UnaryExpression extends BaseNode {
    type: "UnaryExpression";
    operator: string;
    argument: Expression;
}

export interface AssignmentExpression extends BaseNode {
    type: "AssignmentExpression";
    operator: string;
    left: Expression;
    right: Expression;
}

export interface UpdateExpression extends BaseNode {
    type: "UpdateExpression";
    operator: string;
    argument: Expression;
    prefix: boolean;
}

export type Statement =
    | BlockStatement
    | ExpressionStatement
    | VariableDeclaration
    | IfStatement
    | ForOfStatement
    | BreakStatement
    | ContinueStatement;

export type Expression =
    | Identifier
    | StringLiteral
    | NumberLiteral
    | BooleanLiteral
    | NullLiteral
    | CallExpression
    | ObjectExpression
    | ArrayExpression
    | MemberExpression
    | BinaryExpression
    | LogicalExpression
    | UnaryExpression
    | AssignmentExpression
    | UpdateExpression;

export type Node = Program | Statement | Expression | VariableDeclarator | Property;

/** Hijos directos en orden de aparición. */
export function childNodes(node: Node): Node[] {
    switch (node.type) {
        case "Program":
        case "BlockStatement":
            return node.body;
        case "ExpressionStatement":
            return [node.expression];
        case "VariableDeclaration":
            return node.declarations;
        case "VariableDeclarator":
            return node.init ? [node.id, node.init] : [node.id];
        case "IfStatement":
            return node.alternate ? [node.test, node.consequent, node.alternate] : [node.test, node.consequent];
        case "ForOfStatement":
            return [node.left, node.right, node.body];
        case "CallExpression":
            return [node.callee, ...node.arguments];
        case "ObjectExpression":
            return node.properties;
        case "Property":
            return [node.key, node.value];
        case "ArrayExpression":
            return node.elements;
        case "MemberExpression":
            return [node.object, node.property];
        case "BinaryExpression":
        case "LogicalExpression":
        case "AssignmentExpression":
            return [node.left, node.right];
        case "UnaryExpression":
        case "UpdateExpression":
            return [node.argument];
        default:
            return [];
    }
}

/** Recorre el árbol en profundidad; `parent` es null para la raíz. */
export function walk(node: Node, visit: (node: Node, parent: Node | null) => void, parent: Node | null = null): void {
    visit(node, parent);
    for (const child of childNodes(node)) walk(child, visit, node);
}
