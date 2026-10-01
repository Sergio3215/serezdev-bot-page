import manifest from "../../../contracts/custom-command-language/manifest.json";
import syntax from "../../../contracts/custom-command-language/syntax.json";
import rules from "../../../contracts/custom-command-language/rules.json";
import types from "../../../contracts/custom-command-language/types.json";
import functions from "../../../contracts/custom-command-language/functions.json";
import formatter from "../../../contracts/custom-command-language/formatter.json";
import { loadContract } from "./loader";

/** Contrato incluido en el build. Si algún JSON es inconsistente, falla al importar el módulo. */
export const defaultContract = loadContract({
    manifest,
    files: {
        "./syntax.json": syntax,
        "./rules.json": rules,
        "./types.json": types,
        "./functions.json": functions,
        "./formatter.json": formatter,
    },
});
