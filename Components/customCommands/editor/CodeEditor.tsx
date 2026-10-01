"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { languageService, type SignatureHelpResult } from "@/lib/custom-command-language";
import { formatDocument, languageExtensions } from "./languageExtensions";

export interface CodeEditorHandle {
    /** Devuelve el mensaje de error si no se pudo formatear. */
    format: () => string | null;
    goTo: (offset: number) => void;
}

interface CodeEditorProps {
    value: string;
    onChange: (code: string) => void;
    onFormatError?: (message: string | null) => void;
    ariaLabel: string;
}

const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor({ value, onChange, onFormatError, ariaLabel }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const callbacks = useRef({ onChange, onFormatError });
    const [signature, setSignature] = useState<SignatureHelpResult | null>(null);

    useEffect(() => {
        callbacks.current = { onChange, onFormatError };
    }, [onChange, onFormatError]);

    useEffect(() => {
        if (!containerRef.current) return;
        const view = new EditorView({
            parent: containerRef.current,
            state: EditorState.create({
                doc: value,
                extensions: [
                    languageExtensions(languageService, {
                        onChange: (code) => callbacks.current.onChange(code),
                        onSignature: setSignature,
                        onFormatRequest: () => {
                            if (viewRef.current) callbacks.current.onFormatError?.(formatDocument(viewRef.current, languageService));
                        },
                    }),
                    EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
                ],
            }),
        });
        viewRef.current = view;
        return () => {
            view.destroy();
            viewRef.current = null;
        };
        // El editor se crea una sola vez; los cambios externos de `value` se aplican abajo.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        const current = view.state.doc.toString();
        if (current !== value) view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }, [value]);

    useImperativeHandle(ref, () => ({
        format: () => (viewRef.current ? formatDocument(viewRef.current, languageService) : null),
        goTo: (offset: number) => {
            const view = viewRef.current;
            if (!view) return;
            const position = Math.min(offset, view.state.doc.length);
            view.dispatch({ selection: EditorSelection.cursor(position), scrollIntoView: true });
            view.focus();
        },
    }), []);

    return (
        <div className="space-y-1.5">
            <div ref={containerRef} className="min-h-[220px] overflow-hidden rounded-xl border border-white/10 [&_.cm-editor]:min-h-[220px]" />
            <div className="min-h-[18px] font-mono text-[11px] text-zinc-400" aria-live="polite">
                {signature && (
                    <span>
                        {signature.name}(
                        {signature.parameters.map((parameter, index) => (
                            <span key={parameter.name}>
                                {index > 0 && ", "}
                                <span className={index === signature.activeParameter ? "font-bold text-white" : undefined}>
                                    {parameter.name}: {parameter.type}
                                </span>
                            </span>
                        ))}
                        ) — <span className="font-sans">{signature.description}</span>
                    </span>
                )}
            </div>
        </div>
    );
});

export default CodeEditor;
