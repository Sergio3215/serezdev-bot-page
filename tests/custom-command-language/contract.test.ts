import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadContract, languageService } from "@/lib/custom-command-language";
import { defaultContract } from "@/lib/custom-command-language/contract";
import { assertRejected, bundleOf, loadMutated, rawContracts } from "./helpers";

describe("carga del contrato", () => {
    it("los JSON actuales cargan y coinciden con el contrato del build", () => {
        const raw = rawContracts();
        const contract = loadContract(bundleOf(raw));
        assert.equal(contract.languageVersion, raw.manifest.language.version);
        assert.equal(contract.contractVersion, raw.manifest.contractVersion);
        assert.deepEqual([...contract.functionByName.keys()], Object.keys(raw.functions.functions));
        assert.equal(defaultContract.languageVersion, contract.languageVersion);
        assert.equal(languageService.contract, defaultContract);
    });

    it("toma del JSON los formatos con su diagnóstico y descripción", () => {
        for (const [name, format] of Object.entries(rawContracts().rules.formats) as [string, { diagnosticCode: string; description: string }][]) {
            const loaded = defaultContract.formatByName.get(name);
            assert.equal(loaded?.diagnosticCode, format.diagnosticCode);
            assert.equal(loaded?.description, format.description);
            assert.ok(defaultContract.templates.has(format.diagnosticCode));
        }
    });

    it("toma del JSON las construcciones no soportadas, sus palabras y lexemas", () => {
        const constructs = rawContracts().syntax.unsupportedConstructs as Record<string, { keywords?: string[]; lexemes?: string[] }>;
        assert.deepEqual([...defaultContract.grammar.unsupportedConstructs].sort(), Object.keys(constructs).sort());
        for (const [construct, definition] of Object.entries(constructs)) {
            for (const word of definition.keywords ?? []) assert.equal(defaultContract.lexical.unsupportedWords.get(word), construct);
            for (const lexeme of definition.lexemes ?? []) assert.equal(defaultContract.lexical.unsupportedLexemes.get(lexeme), construct);
        }
    });

    it("toma del JSON los requisitos de las funciones", () => {
        assert.deepEqual([...defaultContract.functionRequirements.keys()], Object.keys(rawContracts().functions.requirements));
    });
});

describe("versionado", () => {
    it("rechaza un languageVersion distinto al del manifest", () => {
        assertRejected((raw) => { raw.rules.languageVersion = "9.9.9"; }, /rules\.languageVersion/);
    });

    it("rechaza un schemaVersion no soportado en el manifest", () => {
        assertRejected((raw) => { raw.manifest.schemaVersion = 2; }, /manifest\.schemaVersion/);
    });

    it("rechaza un schemaVersion no soportado en un contrato", () => {
        assertRejected((raw) => { raw.types.schemaVersion = 2; }, /types\.schemaVersion/);
    });

    it("rechaza una referencia contractual faltante", () => {
        assertRejected((raw) => { delete raw.manifest.contracts.functions; }, /manifest\.contracts\.functions.*falta la referencia/);
    });

    it("rechaza una referencia a un archivo inexistente", () => {
        assertRejected((raw) => { raw.manifest.contracts.formatter = "./otro.json"; }, /no se encontró \.\/otro\.json/);
    });
});

describe("funciones", () => {
    it("rechaza un parámetro con tipo inexistente", () => {
        assertRejected((raw) => {
            raw.functions.functions.upper.parameters[0].type = "Texto";
            raw.functions.functions.upper.signatures = ["upper(value: Texto): String"];
        }, /tipo inexistente: Texto/);
    });

    it("rechaza parámetros duplicados", () => {
        assertRejected((raw) => {
            raw.functions.functions.randomRange.parameters[1].name = "min";
        }, /mismo nombre/);
    });

    it("rechaza una firma que no coincide con los parámetros", () => {
        assertRejected((raw) => {
            raw.functions.functions.randomRange.signatures = ["randomRange(min: Number, max: String): Number"];
        }, /max es Number, no String/);
        assertRejected((raw) => {
            raw.functions.functions.randomRange.signatures = ["randomRange(min: Number): Number"];
        }, /1 parámetros y la función declara 2/);
        assertRejected((raw) => {
            raw.functions.functions.upper.signatures = ["lower(value: String): String"];
        }, /nombra lower en lugar de upper/);
    });

    it("rechaza un retorno inexistente o distinto a la firma", () => {
        assertRejected((raw) => {
            raw.functions.functions.now.returns.type = "Fecha";
            raw.functions.functions.now.signatures = ["now(): Fecha"];
        }, /tipo inexistente: Fecha/);
        assertRejected((raw) => {
            raw.functions.functions.now.signatures = ["now(): String"];
        }, /el retorno es Number, no String/);
    });

    it("rechaza un requires desconocido", () => {
        assertRejected((raw) => { raw.functions.functions.GetAuthor.requires = ["attachment"]; }, /GetAuthor\.requires.*attachment/);
    });

    it("rechaza un formato inexistente en un parámetro", () => {
        assertRejected((raw) => { raw.functions.functions.Channel.parameters[0].format = "uuid"; }, /formato inexistente: uuid/);
    });

    it("rechaza una categoría inexistente", () => {
        assertRejected((raw) => { raw.functions.functions.now.kind = "helper"; }, /categoría inexistente: helper/);
    });

    it("rechaza un parámetro obligatorio después de uno opcional", () => {
        assertRejected((raw) => {
            raw.functions.functions.randomRange.parameters[0].required = false;
        }, /obligatorio no puede seguir a uno opcional/);
    });
});

describe("tipos", () => {
    it("rechaza una propiedad con tipo inexistente", () => {
        assertRejected((raw) => { raw.types.types.Member.properties.bot.type = "Bool"; }, /Member\.properties\.bot\.type.*tipo inexistente: Bool/);
    });

    it("rechaza una unión con un miembro inexistente", () => {
        assertRejected((raw) => { raw.types.types.Member.properties.displayName.type = "String | Texto"; }, /tipo inexistente: Texto/);
    });

    it("rechaza un genérico con tipo inexistente o no soportado", () => {
        assertRejected((raw) => { raw.types.types.Member.properties.roles.type = "Array<Rol>"; }, /tipo inexistente: Rol/);
        assertRejected((raw) => { raw.types.genericTypes["Map<K, V>"] = { kind: "map" }; }, /genericTypes\.Map<K, V>/);
    });

    it("rechaza restricciones inexistentes o que no declaran el tipo", () => {
        assertRejected((raw) => { raw.types.types.SendEmbedConfig.aggregateConstraints = ["embedSize"]; }, /restricción inexistente: embedSize/);
        assertRejected((raw) => { raw.rules.aggregateConstraints.embedText.types = ["ReplyEmbedConfig"]; }, /embedText no declara SendEmbedConfig/);
        assertRejected((raw) => { raw.types.types.SendEmbedConfig.requiresAny = ["thumbnail"]; }, /propiedad inexistente: thumbnail/);
    });

    it("rechaza longitudes sobre tipos que no son String y formatos inexistentes", () => {
        assertRejected((raw) => { raw.types.types.Member.properties.bot.maxLength = 3; }, /minLength y maxLength solo aplican a String/);
        assertRejected((raw) => { raw.types.types.Member.properties.id.format = "uuid"; }, /formato inexistente: uuid/);
    });

    it("rechaza un tipo base faltante", () => {
        assertRejected((raw) => { delete raw.types.types.Void; }, /falta el tipo Void/);
    });
});

describe("rules", () => {
    it("rechaza operadores desconocidos", () => {
        assertRejected((raw) => { raw.rules.operators["**"] = { acceptedPairs: [["Number", "Number"]], returns: "Number" }; }, /rules\.operators\.\*\*/);
    });

    it("rechaza tipos inexistentes en las reglas de operadores", () => {
        assertRejected((raw) => { raw.rules.operators["-"].acceptedPairs = [["Entero", "Number"]]; }, /tipo inexistente: Entero/);
    });

    it("rechaza un operador del syntax sin regla", () => {
        assertRejected((raw) => { delete raw.rules.operators["%"]; }, /rules\.operators\.%.*falta la regla/);
    });

    it("rechaza reglas incompatibles con el motor", () => {
        assertRejected((raw) => { raw.rules.calls.methodCalls = true; }, /rules\.calls\.methodCalls/);
        assertRejected((raw) => { raw.rules.scopes.kind = "function"; }, /rules\.scopes\.kind/);
    });

    it("rechaza formatos sin diagnóstico, sin plantilla o sin soporte", () => {
        assertRejected((raw) => { delete raw.rules.formats.snowflake.diagnosticCode; }, /formats\.snowflake\.diagnosticCode/);
        assertRejected((raw) => { raw.rules.formats.snowflake.diagnosticCode = "BAD_ID"; }, /falta la plantilla BAD_ID/);
        assertRejected((raw) => { raw.rules.formats.uuid = { type: "String", description: "UUID", diagnosticCode: "INVALID_URL" }; }, /pattern o protocols/);
        assertRejected((raw) => { raw.rules.formats.snowflake.type = "Number"; }, /formats\.snowflake\.type/);
    });

    it("rechaza una restricción agregada inválida", () => {
        assertRejected((raw) => { raw.rules.aggregateConstraints.embedText.diagnosticCode = "TOO_BIG"; }, /falta la plantilla TOO_BIG/);
        assertRejected((raw) => { raw.rules.aggregateConstraints.embedText.maxTotalLength = -1; }, /maxTotalLength/);
    });

    it("rechaza patrones de narrowing sin handler", () => {
        assertRejected((raw) => { raw.rules.nullNarrowing.supportedPatterns.push("identifier == null"); }, /patrón sin handler/);
        assertRejected((raw) => { raw.rules.nullNarrowing.supportedPatterns.push("null === null"); }, /patrón sin handler/);
    });
});

describe("syntax", () => {
    it("rechaza statements y expresiones sin handler", () => {
        assertRejected((raw) => { raw.syntax.statements.WhileStatement = { enabled: true }; }, /syntax\.statements\.WhileStatement/);
        assertRejected((raw) => { raw.syntax.expressions.ArrowFunctionExpression = { enabled: true }; }, /ArrowFunctionExpression/);
    });

    it("rechaza capacidades que el motor no implementa", () => {
        assertRejected((raw) => { raw.syntax.expressions.MemberExpression.optionalChaining = true; }, /optionalChaining/);
        assertRejected((raw) => { raw.syntax.lexical.numbers.exponent = true; }, /numbers\.exponent/);
        assertRejected((raw) => { raw.syntax.lexical.strings.escapes.push("\\x"); }, /escape sin handler/);
        assertRejected((raw) => { raw.syntax.operators.precedenceHighToLow.push({ group: "bitwise", operators: ["&"], associativity: "left" }); }, /grupo sin handler: bitwise/);
    });

    it("rechaza construcciones no soportadas inconsistentes", () => {
        assertRejected((raw) => { raw.syntax.unsupportedConstructs.while.keywords = ["var"]; }, /var ya pertenece a var/);
        assertRejected((raw) => { raw.syntax.unsupportedConstructs.spread.lexemes = ["=>"]; }, /=> ya pertenece a arrowFunction/);
        assertRejected((raw) => { raw.syntax.unsupportedConstructs.var.keywords = ["no-es-palabra"]; }, /no es un identificador/);
        assertRejected((raw) => { raw.syntax.unsupportedConstructs.var.hint = "x"; }, /unsupportedConstructs\.var\.hint/);
    });

    it("una construcción quitada del JSON deja de reportarse como no soportada", () => {
        const contract = loadMutated((raw) => { delete raw.syntax.unsupportedConstructs.var; });
        assert.equal(contract.lexical.unsupportedWords.has("var"), false);
    });
});

describe("formatter", () => {
    it("rechaza opciones sin soporte", () => {
        assertRejected((raw) => { raw.formatter.indentation.style = "mixed"; }, /indentation\.style/);
        assertRejected((raw) => { raw.formatter.blocks.openingBrace = "next-line"; }, /blocks\.openingBrace/);
    });

    it("los ejemplos del contrato se formatean como declaran y son idempotentes", () => {
        const examples = defaultContract.formatter.examples;
        assert.ok(examples.length > 0);
        for (const example of examples) {
            const result = languageService.format(example.input);
            assert.equal(result.ok, true);
            assert.equal(result.code, example.output);
            assert.equal(languageService.format(result.code).code, example.output);
        }
    });

    it("los ejemplos de funciones no tienen errores léxicos ni sintácticos", () => {
        for (const definition of defaultContract.functionByName.values()) {
            for (const example of definition.examples) {
                const tokens = languageService.tokenize(example);
                const parsed = languageService.parse(example);
                assert.deepEqual([...tokens.diagnostics, ...parsed.diagnostics], [], `${definition.name}: ${example}`);
            }
        }
    });
});
