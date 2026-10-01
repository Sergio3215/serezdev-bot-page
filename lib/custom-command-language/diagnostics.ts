export interface Position {
    line: number;
    column: number;
    offset: number;
}

export interface Loc {
    start: Position;
    end: Position;
}

export type DiagnosticPhase = "tokenizer" | "parser" | "semantic" | "formatter";

export interface Diagnostic {
    phase: DiagnosticPhase;
    code: string;
    message: string;
    loc: Loc;
    /** Valores usados en el mensaje; permiten que la interfaz redacte su propio texto a partir del código. */
    params: Record<string, string | number>;
}

/**
 * Códigos que el contrato no declara pero las guías piden. Si `rules.diagnosticTemplates`
 * define el mismo código, gana el contrato.
 */
export const FRONTEND_TEMPLATES: Readonly<Record<string, string>> = {
    INVALID_CHARACTER: "El carácter {character} no es válido",
    UNTERMINATED_STRING: "El string no está cerrado",
    INVALID_ESCAPE_SEQUENCE: "La secuencia de escape {sequence} no es válida",
    INVALID_UNICODE_ESCAPE: "\\u requiere cuatro dígitos hexadecimales",
    TEMPLATE_STRING_NOT_SUPPORTED: "Los template strings no están disponibles; utilizá comillas y +",
    UNTERMINATED_BLOCK_COMMENT: "El comentario de bloque no está cerrado",
    INVALID_NUMBER: "{raw} no es un número válido",
    UNEXPECTED_TOKEN: "No se esperaba {token}",
    EXPECTED_TOKEN: "Se esperaba {expected}",
    UNSUPPORTED_CONSTRUCT: "{construct} no está disponible en este lenguaje",
    UNSUPPORTED_OPERATOR: "{operator} no está disponible. {hint}",
    INVALID_CALLEE: "Solo se pueden llamar funciones por su nombre",
    METHOD_CALL_NOT_SUPPORTED: "No se pueden llamar métodos; utilizá las funciones del lenguaje",
    QUOTED_OBJECT_KEY: "La propiedad {name} debe escribirse sin comillas",
    INVALID_ASSIGNMENT_TARGET: "Solo se puede asignar a una variable o a una propiedad",
    INCOMPATIBLE_OPERANDS: "{operator} no admite {operands}",
    INCOMPATIBLE_ASSIGNMENT: "No se puede asignar {actual} a un valor de tipo {expected}",
    VOID_VALUE: "{name} no devuelve un valor utilizable",
    INVALID_INDEX: "El índice debe ser Number y recibió {actual}",
    INVALID_COMPUTED_PROPERTY: "El acceso con corchetes a un objeto requiere un string fijo",
    COMMENTS_NOT_PRESERVED: "No se puede formatear sin mover o perder este comentario",
    FORMAT_UNSAFE: "No se pudo formatear sin cambiar el significado del código",
};

export function renderTemplate(template: string, params: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match));
}

export class DiagnosticBag {
    readonly items: Diagnostic[] = [];
    private readonly seen = new Set<string>();

    constructor(
        private readonly templates: ReadonlyMap<string, string>,
        private readonly phase: DiagnosticPhase
    ) {}

    report(code: string, loc: Loc, params: Record<string, string | number> = {}): void {
        const key = `${code}:${loc.start.offset}:${loc.end.offset}`;
        if (this.seen.has(key)) return;
        this.seen.add(key);
        const template = this.templates.get(code) ?? code;
        this.items.push({ phase: this.phase, code, message: renderTemplate(template, params), loc, params });
    }

    get hasErrors(): boolean {
        return this.items.length > 0;
    }
}

export function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
    return [...diagnostics].sort(
        (a, b) => a.loc.start.offset - b.loc.start.offset || a.loc.end.offset - b.loc.end.offset
    );
}
