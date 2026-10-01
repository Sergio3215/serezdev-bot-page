import { defaultContract } from "./contract";
import { createLanguageService } from "./ide/languageService";
import { generateSource, type SimpleAction } from "./simple/generator";
import { readSimpleSource as readSource } from "./simple/reader";

export { ContractError, loadContract, type ContractBundle } from "./contract/loader";
export type { LanguageContract } from "./contract/model";
export type { Diagnostic, Loc, Position } from "./diagnostics";
export type { Program } from "./parser/ast";
export type { FormatResult } from "./formatter/formatter";
export {
    createLanguageService,
    type AnalyzeResult,
    type CompletionItem,
    type CompletionResult,
    type HoverResult,
    type LanguageService,
    type SignatureHelpResult,
} from "./ide/languageService";
export { SimpleModelError, contextSources, queryResolver, simpleShape, sourceOf, type SimpleAction, type SimpleShape, type SimpleValue } from "./simple/generator";
export { printString } from "./formatter/stringPrinter";
export { highlightRanges, type HighlightKind, type HighlightRange } from "./ide/highlight";

export const languageService = createLanguageService(defaultContract);

export function generateSimpleSource(actions: SimpleAction[]): string {
    return generateSource(defaultContract, actions);
}

/** Modelo del modo simple equivalente al código, o null si el código no se puede representar con sus controles. */
export function readSimpleSource(source: string): SimpleAction[] | null {
    return readSource(defaultContract, source);
}
