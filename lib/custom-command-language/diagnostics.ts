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
