import { FORMAT_DIAGNOSTICS, unaryRuleName } from "../contract/loader";
import type {
    FunctionDefinition,
    LanguageContract,
    LiteralObjectType,
    ObjectType,
    OperatorRule,
    PropertyDefinition,
    Type,
} from "../contract/model";
import { DiagnosticBag, type Diagnostic, type Loc } from "../diagnostics";
import type {
    AssignmentExpression,
    BinaryExpression,
    BlockStatement,
    CallExpression,
    Expression,
    ForOfStatement,
    Identifier,
    IfStatement,
    LogicalExpression,
    MemberExpression,
    Node,
    ObjectExpression,
    Program,
    Statement,
    UnaryExpression,
    UpdateExpression,
    VariableDeclaration,
} from "../parser/ast";
import { UNKNOWN, arrayType, isAssignable, isNullType, isNullable, sameType, scalar, withoutNull } from "./typeSystem";

export interface Binding {
    name: string;
    declarationKind: string;
    mutable: boolean;
    type: Type;
    declarationNode: Node;
}

export class Scope {
    readonly bindings = new Map<string, Binding>();
    readonly narrowings = new Map<string, Type>();

    constructor(
        readonly parent: Scope | null,
        readonly node: Node
    ) {}

    private *chain(): Generator<Scope> {
        yield this;
        if (this.parent) yield* this.parent.chain();
    }

    lookup(name: string): { binding: Binding; type: Type } | null {
        for (const scope of this.chain()) {
            const binding = scope.bindings.get(name);
            if (binding) return { binding, type: binding.type };
            const narrowed = scope.narrowings.get(name);
            if (narrowed) {
                const outer = scope.parent?.lookup(name);
                if (outer) return { binding: outer.binding, type: narrowed };
            }
        }
        return null;
    }

    /** Variables visibles desde este scope, la más cercana primero. */
    visibleBindings(): Binding[] {
        const seen = new Set<string>();
        const result: Binding[] = [];
        for (const scope of this.chain()) {
            for (const binding of scope.bindings.values()) {
                if (seen.has(binding.name)) continue;
                seen.add(binding.name);
                result.push(binding);
            }
        }
        return result;
    }
}

export interface Analysis {
    expressionTypes: Map<Node, Type>;
    resolvedFunctions: Map<CallExpression, FunctionDefinition>;
    scopes: Map<Node, Scope>;
    bindings: Map<Identifier, Binding>;
}

export interface ValidationResult {
    valid: boolean;
    diagnostics: Diagnostic[];
    analysis: Analysis;
}

interface Narrowing {
    name: string;
    consequent: Type | null;
    alternate: Type | null;
}

function stringLength(value: string): number {
    return Array.from(value).length;
}

class RuleEngine {
    private scope: Scope;
    private readonly ancestors: string[] = [];
    readonly analysis: Analysis = {
        expressionTypes: new Map(),
        resolvedFunctions: new Map(),
        scopes: new Map(),
        bindings: new Map(),
    };

    constructor(
        private readonly contract: LanguageContract,
        private readonly bag: DiagnosticBag,
        program: Program
    ) {
        this.scope = new Scope(null, program);
    }

    private type(name: string): Type {
        return scalar(this.contract, name);
    }

    private report(code: string, loc: Loc, params: Record<string, string | number> = {}): void {
        this.bag.report(code, loc, params);
    }

    private withScope(node: Node, run: (scope: Scope) => void): void {
        const previous = this.scope;
        this.scope = new Scope(previous, node);
        this.analysis.scopes.set(node, this.scope);
        try {
            run(this.scope);
        } finally {
            this.scope = previous;
        }
    }

    visitProgram(program: Program): void {
        this.analysis.scopes.set(program, this.scope);
        if (program.body.length < this.contract.rules.minimumStatements) this.report("EMPTY_PROGRAM", program.loc);
        for (const statement of program.body) this.visitStatement(statement);
    }

    private visitStatements(statements: Statement[]): void {
        for (const statement of statements) this.visitStatement(statement);
    }

    private visitStatement(statement: Statement): void {
        switch (statement.type) {
            case "BlockStatement":
                this.withScope(statement, () => this.visitStatements(statement.body));
                return;
            case "VariableDeclaration":
                this.visitDeclaration(statement);
                return;
            case "IfStatement":
                this.visitIf(statement);
                return;
            case "ForOfStatement":
                this.visitForOf(statement);
                return;
            case "BreakStatement":
            case "ContinueStatement": {
                const keyword = statement.type === "BreakStatement" ? "break" : "continue";
                const required = this.contract.rules.loopControlAncestors.get(keyword) ?? [];
                if (!required.some((ancestor) => this.ancestors.includes(ancestor))) {
                    this.report("INVALID_LOOP_CONTROL", statement.loc, { keyword });
                }
                return;
            }
            case "ExpressionStatement":
                this.visitExpression(statement.expression);
                return;
        }
    }

    private declare(id: Identifier, kind: string, mutable: boolean, type: Type, node: Node): void {
        const existing = this.scope.bindings.get(id.name);
        if (existing && this.contract.rules.duplicateDeclarationIsError) {
            this.report("DUPLICATE_DECLARATION", id.loc, { name: id.name });
            return;
        }
        if (!existing && this.contract.rules.shadowingIsError && this.scope.parent?.lookup(id.name)) {
            this.report("DUPLICATE_DECLARATION", id.loc, { name: id.name });
        }
        const binding: Binding = { name: id.name, declarationKind: kind, mutable, type, declarationNode: node };
        this.scope.bindings.set(id.name, binding);
        this.analysis.bindings.set(id, binding);
        this.analysis.expressionTypes.set(id, type);
        this.analysis.scopes.set(id, this.scope);
    }

    private visitDeclaration(declaration: VariableDeclaration): void {
        const rule = this.contract.rules.bindings.get(declaration.kind);
        const mutable = rule?.mutable ?? true;
        for (const declarator of declaration.declarations) {
            let type: Type = UNKNOWN;
            if (declarator.init) {
                type = this.valueOf(declarator.init);
                if (isNullType(type) && mutable) type = UNKNOWN;
            } else if (rule?.requiresInitializer) {
                this.report("MISSING_INITIALIZER", declarator.id.loc, { name: declarator.id.name });
            }
            this.declare(declarator.id, declaration.kind, mutable, type, declarator);
        }
    }

    /** Narrowing de los patrones `x === null`, `x !== null` y sus inversos. */
    private narrowingFor(test: Expression): Narrowing | null {
        const narrowing = this.contract.rules.narrowing;
        if (!narrowing.enabled || test.type !== "BinaryExpression") return null;
        if (test.operator !== "===" && test.operator !== "!==") return null;
        const identifier = test.left.type === "Identifier" && test.right.type === "NullLiteral" ? test.left
            : test.right.type === "Identifier" && test.left.type === "NullLiteral" ? test.right : null;
        if (!identifier) return null;
        const resolved = this.scope.lookup(identifier.name);
        if (!resolved || !isNullable(resolved.type)) return null;
        const present = withoutNull(resolved.type);
        const absent = this.type("Null");
        const whenTrue = test.operator === "!==" ? present : absent;
        const whenFalse = test.operator === "!==" ? absent : present;
        return {
            name: identifier.name,
            consequent: narrowing.consequent ? whenTrue : null,
            alternate: narrowing.alternate ? whenFalse : null,
        };
    }

    private visitBranch(node: BlockStatement | IfStatement, name: string | undefined, type: Type | null): void {
        this.withScope(node, (scope) => {
            if (name && type) scope.narrowings.set(name, type);
            if (node.type === "BlockStatement") this.visitStatements(node.body);
            else this.visitIf(node);
        });
    }

    private visitIf(statement: IfStatement): void {
        this.valueOf(statement.test);
        const narrowing = this.narrowingFor(statement.test);
        this.visitBranch(statement.consequent, narrowing?.name, narrowing?.consequent ?? null);
        if (statement.alternate) this.visitBranch(statement.alternate, narrowing?.name, narrowing?.alternate ?? null);
    }

    private visitForOf(statement: ForOfStatement): void {
        const iterable = this.valueOf(statement.right);
        let element: Type = UNKNOWN;
        if (iterable.kind === "array") element = iterable.element;
        else if (iterable.kind !== "unknown") this.report("NOT_ITERABLE", statement.right.loc);

        const declaration = statement.left;
        const declarator = declaration.declarations[0];
        if (declaration.declarations.length !== 1 || !this.contract.rules.forOfBindingKinds.has(declaration.kind)) {
            this.report("INVALID_FOR_OF_DECLARATION", declaration.loc);
        }
        this.withScope(statement, () => {
            const mutable = this.contract.rules.bindings.get(declaration.kind)?.mutable ?? true;
            this.declare(declarator.id, declaration.kind, mutable, element, declarator);
            this.ancestors.push("ForOfStatement");
            try {
                this.visitStatement(statement.body);
            } finally {
                this.ancestors.pop();
            }
        });
    }

    /** Tipo de una expresión usada como valor: un retorno Void no puede usarse. */
    private valueOf(expression: Expression): Type {
        const type = this.visitExpression(expression);
        if (type.kind !== "void") return type;
        const name = expression.type === "CallExpression" ? expression.callee.name : "La expresión";
        this.report("VOID_VALUE", expression.loc, { name });
        return UNKNOWN;
    }

    private visitExpression(expression: Expression): Type {
        const type = this.computeType(expression);
        this.analysis.expressionTypes.set(expression, type);
        return type;
    }

    private computeType(expression: Expression): Type {
        switch (expression.type) {
            case "Identifier":
                return this.visitIdentifier(expression);
            case "StringLiteral":
                return this.type("String");
            case "NumberLiteral":
                return this.type("Number");
            case "BooleanLiteral":
                return this.type("Boolean");
            case "NullLiteral":
                return this.type("Null");
            case "ArrayExpression": {
                const elements = expression.elements.map((element) => this.valueOf(element));
                if (elements.length === 0) return arrayType(UNKNOWN, false);
                const first = elements[0];
                return arrayType(elements.every((element) => sameType(element, first)) ? first : UNKNOWN, false);
            }
            case "ObjectExpression":
                return this.visitObject(expression);
            case "CallExpression":
                return this.visitCall(expression);
            case "MemberExpression":
                return this.visitMember(expression).type;
            case "BinaryExpression":
            case "LogicalExpression":
                return this.visitBinary(expression);
            case "UnaryExpression":
                return this.visitUnary(expression);
            case "AssignmentExpression":
                return this.visitAssignment(expression);
            case "UpdateExpression":
                return this.visitUpdate(expression);
        }
    }

    private visitIdentifier(identifier: Identifier): Type {
        this.analysis.scopes.set(identifier, this.scope);
        const resolved = this.scope.lookup(identifier.name);
        if (!resolved) {
            this.report("UNDEFINED_IDENTIFIER", identifier.loc, { name: identifier.name });
            return UNKNOWN;
        }
        this.analysis.bindings.set(identifier, resolved.binding);
        return resolved.type;
    }

    private visitObject(object: ObjectExpression): LiteralObjectType {
        const type: LiteralObjectType = { kind: "literal-object", name: "Object", properties: new Map() };
        for (const property of object.properties) {
            const valueType = this.valueOf(property.value);
            if (type.properties.has(property.key.name)) {
                if (this.contract.rules.duplicatePropertiesIsError) {
                    this.report("DUPLICATE_PROPERTY", property.key.loc, { name: property.key.name });
                }
                continue;
            }
            type.properties.set(property.key.name, { type: valueType, node: property, value: property.value });
        }
        return type;
    }

    private visitCall(call: CallExpression): Type {
        const definition = this.contract.functionByName.get(call.callee.name);
        const argumentTypes = call.arguments.map((argument) => this.valueOf(argument));
        this.analysis.scopes.set(call.callee, this.scope);
        if (!definition) {
            this.report("UNKNOWN_NATIVE_FUNCTION", call.callee.loc, { name: call.callee.name });
            return UNKNOWN;
        }
        this.analysis.resolvedFunctions.set(call, definition);

        const minimum = definition.parameters.filter((parameter) => parameter.required).length;
        const maximum = definition.parameters.length;
        const count = call.arguments.length;
        if (count < minimum || count > maximum) {
            this.report("INVALID_ARGUMENT_COUNT", call.loc, {
                name: definition.name,
                actual: count,
                expected: minimum === maximum ? String(minimum) : `${minimum} a ${maximum}`,
            });
        }
        call.arguments.forEach((argument, index) => {
            const parameter = definition.parameters[index];
            if (!parameter) return;
            this.checkValue(argument, argumentTypes[index], parameter.type, {
                label: parameter.name,
                owner: definition.name,
                format: parameter.format,
            });
        });
        return definition.returns;
    }

    /** Valida un valor contra el tipo esperado: asignabilidad, configuraciones, límites y formatos. */
    private checkValue(
        node: Expression,
        actual: Type,
        expected: Type,
        context: { label: string; owner: string; format?: string; property?: PropertyDefinition }
    ): void {
        if (expected.kind === "object" && actual.kind === "literal-object") {
            if (expected.readOnly) {
                this.report("INCOMPATIBLE_ARGUMENT", node.loc, { parameter: context.label, expected: expected.name, actual: actual.name });
                return;
            }
            this.validateConfig(actual, expected, node, context.property ? context.label : context.owner);
            return;
        }
        if (!isAssignable(actual, expected)) {
            this.report("INCOMPATIBLE_ARGUMENT", node.loc, { parameter: context.label, expected: expected.name, actual: actual.name });
            return;
        }
        if (node.type !== "StringLiteral") return;
        const property = context.property;
        if (property?.minLength !== undefined && stringLength(node.value) < property.minLength) {
            this.report("STRING_TOO_SHORT", node.loc, { target: context.label, minimum: property.minLength });
        }
        if (property?.maxLength !== undefined && stringLength(node.value) > property.maxLength) {
            this.report("STRING_TOO_LONG", node.loc, { target: context.label, maximum: property.maxLength });
        }
        const format = context.format ?? property?.format;
        if (format) this.checkFormat(node.value, format, node.loc, context.label);
    }

    private checkFormat(value: string, formatName: string, loc: Loc, target: string): void {
        const format = this.contract.formatByName.get(formatName);
        if (!format) return;
        let valid: boolean;
        if (format.kind === "pattern") {
            valid = format.pattern.test(value);
        } else {
            try {
                const url = new URL(value);
                valid = format.protocols.includes(url.protocol) && url.hostname.length > 0;
            } catch {
                valid = false;
            }
        }
        if (!valid) this.report(FORMAT_DIAGNOSTICS[formatName], loc, { target });
    }

    private validateConfig(literal: LiteralObjectType, target: ObjectType, anchor: Expression, owner: string): void {
        const rules = this.contract.rules;
        for (const [name, property] of literal.properties) {
            const definition = target.properties.get(name);
            if (!definition) {
                if (!target.additionalProperties && rules.unknownConfigPropertiesIsError) {
                    this.report("UNKNOWN_CONFIG_PROPERTY", property.node.key.loc, { target: owner, name });
                }
                continue;
            }
            this.checkValue(property.value, property.type, definition.type, { label: name, owner, property: definition });
        }
        if (rules.missingRequiredIsError) {
            for (const [name, definition] of target.properties) {
                if (definition.required && !literal.properties.has(name)) {
                    this.report("MISSING_CONFIG_PROPERTY", anchor.loc, { target: owner, name });
                }
            }
        }
        if (target.requiresAny.length > 0 && !target.requiresAny.some((name) => literal.properties.has(name))) {
            this.report("EMPTY_EMBED", anchor.loc, { target: owner });
        }
        for (const name of target.aggregateConstraints) {
            const constraint = this.contract.aggregateByName.get(name);
            if (!constraint) continue;
            const total = constraint.properties.reduce((sum, path) => sum + this.literalLength(literal, path.split(".")), 0);
            if (total > constraint.maxTotalLength) this.report(constraint.diagnosticCode, anchor.loc, { maximum: constraint.maxTotalLength });
        }
    }

    /** Longitud de un string literal en la ruta indicada; 0 si no es un literal conocido. */
    private literalLength(literal: LiteralObjectType, path: string[]): number {
        const property = literal.properties.get(path[0]);
        if (!property) return 0;
        const value = property.value;
        if (path.length === 1) return value.type === "StringLiteral" ? stringLength(value.value) : 0;
        return property.type.kind === "literal-object" ? this.literalLength(property.type, path.slice(1)) : 0;
    }

    private visitMember(member: MemberExpression): { type: Type; readOnly: boolean } {
        const objectType = this.valueOf(member.object);
        const propertyType = member.computed ? this.valueOf(member.property) : null;
        const result = this.resolveMember(member, objectType, propertyType);
        this.analysis.expressionTypes.set(member, result.type);
        return result;
    }

    private resolveMember(member: MemberExpression, objectType: Type, propertyType: Type | null): { type: Type; readOnly: boolean } {
        const rules = this.contract.rules;
        const unknown = { type: UNKNOWN, readOnly: false };
        if (objectType.kind === "unknown") return unknown;
        if (isNullType(objectType) || isNullable(objectType)) {
            if (rules.nullableRequiresNarrowing) this.report("NULLABLE_MEMBER_ACCESS", member.object.loc);
            return unknown;
        }

        if (member.computed && objectType.kind === "array") {
            if (propertyType && propertyType.kind !== "unknown" && propertyType.name !== "Number") {
                this.report("INVALID_INDEX", member.property.loc, { actual: propertyType.name });
            }
            return { type: objectType.element, readOnly: objectType.readOnly };
        }

        let name: string;
        if (member.computed) {
            if (member.property.type !== "StringLiteral") {
                if (objectType.kind === "object" || objectType.kind === "literal-object") {
                    this.report("INVALID_COMPUTED_PROPERTY", member.property.loc);
                    return unknown;
                }
                if (rules.unknownPropertyIsError) this.report("UNKNOWN_PROPERTY", member.property.loc, { name: "[]" });
                return unknown;
            }
            name = member.property.value;
        } else {
            name = (member.property as Identifier).name;
        }

        if (objectType.kind === "object") {
            const definition = objectType.properties.get(name);
            if (definition) return { type: definition.type, readOnly: objectType.readOnly || definition.readOnly };
        } else if (objectType.kind === "literal-object") {
            const property = objectType.properties.get(name);
            if (property) return { type: property.type, readOnly: false };
        }
        if (rules.unknownPropertyIsError) this.report("UNKNOWN_PROPERTY", member.property.loc, { name });
        return unknown;
    }

    private operatorRule(name: string): OperatorRule | undefined {
        return this.contract.rules.operators.get(name);
    }

    private resultType(rule: OperatorRule, left: Type, right: Type | null): Type {
        if (rule.returnsByPair && right) {
            const byPair = rule.returnsByPair[`${left.name},${right.name}`];
            if (byPair) return this.type(byPair);
            return UNKNOWN;
        }
        if (rule.returns === "left-type") return left;
        return rule.returns ? this.type(rule.returns) : UNKNOWN;
    }

    private pairAccepted(rule: OperatorRule, left: Type, right: Type): boolean {
        if (rule.acceptedPairs === "any" || rule.acceptedPairs === undefined) return true;
        return rule.acceptedPairs.some(([a, b]) => a === left.name && b === right.name);
    }

    private visitBinary(expression: BinaryExpression | LogicalExpression): Type {
        const left = this.valueOf(expression.left);
        const right = this.valueOf(expression.right);
        const rule = this.operatorRule(expression.operator);
        if (!rule) return UNKNOWN;
        if (left.kind === "unknown" || right.kind === "unknown") {
            return rule.returnsByPair ? UNKNOWN : this.resultType(rule, left, right);
        }
        if (!this.pairAccepted(rule, left, right)) {
            this.report("INCOMPATIBLE_OPERANDS", expression.loc, { operator: expression.operator, operands: `${left.name} y ${right.name}` });
            return UNKNOWN;
        }
        return this.resultType(rule, left, right);
    }

    private visitUnary(expression: UnaryExpression): Type {
        const operand = this.valueOf(expression.argument);
        const rule = this.operatorRule(unaryRuleName(this.contract.rules, expression.operator));
        if (!rule) return UNKNOWN;
        if (operand.kind !== "unknown" && rule.acceptedOperand && operand.name !== rule.acceptedOperand) {
            this.report("INCOMPATIBLE_OPERANDS", expression.loc, { operator: expression.operator, operands: operand.name });
            return UNKNOWN;
        }
        return this.resultType(rule, operand, null);
    }

    /** Destino de una asignación o actualización: tipo declarado y si puede modificarse. */
    private assignmentTarget(target: Expression): { type: Type; ok: boolean } {
        if (target.type === "Identifier") {
            this.analysis.scopes.set(target, this.scope);
            const resolved = this.scope.lookup(target.name);
            if (!resolved) {
                this.report("UNDEFINED_IDENTIFIER", target.loc, { name: target.name });
                return { type: UNKNOWN, ok: false };
            }
            this.analysis.bindings.set(target, resolved.binding);
            this.analysis.expressionTypes.set(target, resolved.binding.type);
            if (!resolved.binding.mutable) {
                this.report("CONST_REASSIGNMENT", target.loc, { name: target.name });
                return { type: resolved.binding.type, ok: false };
            }
            return { type: resolved.binding.type, ok: true };
        }
        if (target.type === "MemberExpression") {
            const member = this.visitMember(target);
            if (member.readOnly) {
                this.report("READ_ONLY_VALUE", target.loc);
                return { type: member.type, ok: false };
            }
            return { type: member.type, ok: true };
        }
        return { type: UNKNOWN, ok: false };
    }

    private visitAssignment(expression: AssignmentExpression): Type {
        const right = this.valueOf(expression.right);
        const target = this.assignmentTarget(expression.left);
        const rule = this.operatorRule(expression.operator);
        if (expression.left.type === "Identifier" && target.ok) {
            this.scope.narrowings.set(expression.left.name, target.type);
        }
        if (!rule || !target.ok) return target.type;
        if (expression.operator === "=") {
            if (!isAssignable(right, target.type)) {
                this.report("INCOMPATIBLE_ASSIGNMENT", expression.loc, { expected: target.type.name, actual: right.name });
            }
        } else if (target.type.kind !== "unknown" && right.kind !== "unknown" && !this.pairAccepted(rule, target.type, right)) {
            this.report("INCOMPATIBLE_OPERANDS", expression.loc, { operator: expression.operator, operands: `${target.type.name} y ${right.name}` });
        }
        return this.resultType(rule, target.type, null);
    }

    private visitUpdate(expression: UpdateExpression): Type {
        const target = this.assignmentTarget(expression.argument);
        const number = this.type("Number");
        if (target.ok && target.type.kind !== "unknown" && target.type.name !== "Number") {
            this.report("INCOMPATIBLE_OPERANDS", expression.loc, { operator: expression.operator, operands: target.type.name });
        }
        return number;
    }
}

export function validate(program: Program, contract: LanguageContract): ValidationResult {
    const bag = new DiagnosticBag(contract.templates, "semantic");
    const engine = new RuleEngine(contract, bag, program);
    engine.visitProgram(program);
    return { valid: !bag.hasErrors, diagnostics: bag.items, analysis: engine.analysis };
}
