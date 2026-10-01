import {
    autocompletion,
    closeBrackets,
    closeBracketsKeymap,
    completionKeymap,
    snippet,
    type Completion,
    type CompletionContext,
    type CompletionResult,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { linter, lintGutter, lintKeymap, type Diagnostic as EditorDiagnostic } from "@codemirror/lint";
import { EditorSelection, RangeSetBuilder, type Extension } from "@codemirror/state";
import {
    Decoration,
    EditorView,
    ViewPlugin,
    drawSelection,
    highlightActiveLine,
    hoverTooltip,
    keymap,
    lineNumbers,
    type DecorationSet,
    type ViewUpdate,
} from "@codemirror/view";
import type { LanguageService, SignatureHelpResult } from "@/lib/custom-command-language";

const LINT_DELAY_MS = 150;

function tokenClasses(service: LanguageService, source: string): { from: number; to: number; className: string }[] {
    const contract = service.contract;
    const keywordTypes = new Set(contract.lexical.keywords.values());
    const literalTypes = new Set(["true", "false", "null"].map((word) => contract.lexical.keywords.get(word)));
    const colon = contract.lexical.delimiters.get(":");
    const dot = contract.lexical.delimiters.get(".");
    const { tokens, trivia } = service.tokenize(source);
    const significant = tokens.filter((token) => token.type !== "NEWLINE" && token.type !== "EOF");

    const ranges = significant.flatMap((token, index) => {
        let className: string | null = null;
        if (literalTypes.has(token.type)) className = "cc-literal";
        else if (keywordTypes.has(token.type)) className = "cc-keyword";
        else if (token.type === "STRING") className = "cc-string";
        else if (token.type === "NUMBER") className = "cc-number";
        else if (token.type === "OPERATOR") className = "cc-operator";
        else if (token.type === "UNSUPPORTED") className = "cc-invalid";
        else if (token.type === "IDENTIFIER") {
            const definition = contract.functionByName.get(token.raw);
            if (definition) className = `cc-fn-${definition.kind}`;
            else if (significant[index + 1]?.type === colon || significant[index - 1]?.type === dot) className = "cc-property";
            else className = "cc-variable";
        }
        return className ? [{ from: token.loc.start.offset, to: token.loc.end.offset, className }] : [];
    });
    for (const comment of trivia) ranges.push({ from: comment.loc.start.offset, to: comment.loc.end.offset, className: "cc-comment" });
    return ranges.filter((range) => range.to > range.from).sort((a, b) => a.from - b.from);
}

function highlighter(service: LanguageService): Extension {
    const build = (view: EditorView): DecorationSet => {
        const builder = new RangeSetBuilder<Decoration>();
        for (const range of tokenClasses(service, view.state.doc.toString())) {
            builder.add(range.from, range.to, Decoration.mark({ class: range.className }));
        }
        return builder.finish();
    };
    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;
            constructor(view: EditorView) {
                this.decorations = build(view);
            }
            update(update: ViewUpdate) {
                if (update.docChanged) this.decorations = build(update.view);
            }
        },
        { decorations: (plugin) => plugin.decorations }
    );
}

function diagnostics(service: LanguageService): Extension {
    return linter(
        (view): EditorDiagnostic[] => {
            const length = view.state.doc.length;
            return service.analyze(view.state.doc.toString()).diagnostics.map((diagnostic) => {
                const from = Math.min(diagnostic.loc.start.offset, length);
                return {
                    from,
                    to: Math.min(Math.max(diagnostic.loc.end.offset, from), length),
                    severity: "error",
                    source: diagnostic.code,
                    message: diagnostic.message,
                };
            });
        },
        { delay: LINT_DELAY_MS }
    );
}

const COMPLETION_TYPES: Record<string, string> = {
    function: "function",
    property: "property",
    variable: "variable",
    keyword: "keyword",
};

function completions(service: LanguageService): Extension {
    const source = (context: CompletionContext): CompletionResult | null => {
        const word = context.matchBefore(/[A-Za-z_][A-Za-z0-9_]*$/);
        const previous = context.state.sliceDoc(Math.max(0, context.pos - 1), context.pos);
        if (!word && !context.explicit && previous !== ".") return null;

        const result = service.complete(context.state.doc.toString(), context.pos);
        if (result.items.length === 0) return null;
        const options: Completion[] = result.items.map((item) => ({
            label: item.label,
            type: COMPLETION_TYPES[item.kind],
            detail: item.detail,
            info: item.documentation,
            boost: item.kind === "property" ? 2 : item.kind === "variable" ? 1 : 0,
            apply: item.insertText.includes("${") ? snippet(item.insertText) : item.insertText,
        }));
        return { from: result.from, to: result.to, options, validFor: /^[A-Za-z0-9_]*$/ };
    };
    return autocompletion({ override: [source], icons: true });
}

function hover(service: LanguageService): Extension {
    return hoverTooltip((view, position) => {
        const result = service.hover(view.state.doc.toString(), position);
        if (!result) return null;
        return {
            pos: result.from,
            end: result.to,
            above: true,
            create: () => {
                const dom = document.createElement("div");
                dom.className = "cc-hover";
                const title = document.createElement("div");
                title.className = "cc-hover-title";
                title.textContent = result.title;
                dom.appendChild(title);
                for (const line of result.lines) {
                    const paragraph = document.createElement("div");
                    paragraph.textContent = line;
                    dom.appendChild(paragraph);
                }
                return { dom };
            },
        };
    });
}

/**
 * Reemplaza todo el documento por la versión formateada en una sola transacción, para que
 * Deshacer vuelva al texto previo. Si el código no se puede formatear, lleva el cursor al
 * primer diagnóstico y devuelve su mensaje.
 */
export function formatDocument(view: EditorView, service: LanguageService): string | null {
    const source = view.state.doc.toString();
    const result = service.format(source);
    if (!result.ok) {
        const first = result.diagnostics[0];
        if (first) {
            view.dispatch({ selection: EditorSelection.cursor(first.loc.start.offset), scrollIntoView: true });
            view.focus();
        }
        return first?.message ?? "No se pudo formatear el código.";
    }
    if (result.code !== source) {
        view.dispatch({ changes: { from: 0, to: source.length, insert: result.code } });
    }
    return null;
}

const editorTheme = EditorView.theme(
    {
        "&": { backgroundColor: "#111214", color: "#dbdee1", fontSize: "13px", borderRadius: "12px" },
        "&.cm-focused": { outline: "2px solid #5865F2" },
        ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", lineHeight: "1.6" },
        ".cm-content": { caretColor: "#ffffff", padding: "10px 0" },
        ".cm-gutters": { backgroundColor: "#111214", color: "#5c5f66", border: "none", borderRadius: "12px 0 0 12px" },
        ".cm-activeLine": { backgroundColor: "#ffffff08" },
        ".cm-activeLineGutter": { backgroundColor: "#ffffff08" },
        "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "#5865F255" },
        ".cm-tooltip": { backgroundColor: "#1e1f22", border: "1px solid #ffffff1a", color: "#dbdee1", borderRadius: "8px" },
        ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "#5865F2", color: "#ffffff" },
        ".cm-completionDetail": { color: "#949ba4", fontStyle: "normal", marginLeft: "8px" },
        ".cm-diagnostic-error": { borderLeft: "3px solid #f23f43" },
        ".cm-lintRange-error": { textDecoration: "underline wavy #f23f43", textUnderlineOffset: "3px", backgroundImage: "none" },
        ".cc-hover": { padding: "6px 10px", maxWidth: "420px", fontSize: "12px", lineHeight: "1.5" },
        ".cc-hover-title": { fontFamily: "ui-monospace, monospace", color: "#ffffff", marginBottom: "2px" },
        ".cc-keyword": { color: "#c792ea" },
        ".cc-literal": { color: "#f78c6c" },
        ".cc-string": { color: "#c3e88d" },
        ".cc-number": { color: "#f78c6c" },
        ".cc-operator": { color: "#89ddff" },
        ".cc-comment": { color: "#6a737d", fontStyle: "italic" },
        ".cc-fn-reference": { color: "#ffcb6b" },
        ".cc-fn-query": { color: "#82aaff" },
        ".cc-fn-action": { color: "#5865F2", fontWeight: "600" },
        ".cc-property": { color: "#f07178" },
        ".cc-variable": { color: "#eeffff" },
        ".cc-invalid": { color: "#f23f43", textDecoration: "line-through" },
    },
    { dark: true }
);

export interface LanguageExtensionOptions {
    onChange: (code: string) => void;
    onSignature: (signature: SignatureHelpResult | null) => void;
    onFormatRequest: () => void;
}

export function languageExtensions(service: LanguageService, options: LanguageExtensionOptions): Extension[] {
    return [
        lineNumbers(),
        history(),
        drawSelection(),
        highlightActiveLine(),
        closeBrackets(),
        EditorView.lineWrapping,
        editorTheme,
        highlighter(service),
        diagnostics(service),
        lintGutter(),
        completions(service),
        hover(service),
        keymap.of([
            { key: "Shift-Alt-f", run: () => (options.onFormatRequest(), true) },
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            ...completionKeymap,
            ...lintKeymap,
        ]),
        EditorView.updateListener.of((update) => {
            if (update.docChanged) options.onChange(update.state.doc.toString());
            if (update.docChanged || update.selectionSet) {
                options.onSignature(service.signatureHelp(update.state.doc.toString(), update.state.selection.main.head));
            }
        }),
    ];
}
