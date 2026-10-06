import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createLanguageService, languageService } from "@/lib/custom-command-language";
import { loadMutated } from "./helpers";

const codes = (source: string): string[] => languageService.analyze(source).diagnostics.map((diagnostic) => diagnostic.code);

const SPRINT_2 = {
    random: "random(): Number",
    randomRange: "randomRange(min: Number, max: Number): Number",
    choose: "choose(values: Array<T>): T",
    now: "now(): Number",
    date: "date(): String",
    time: "time(): String",
    username: "username(): String",
    displayName: "displayName(): String",
    userId: "userId(): String",
    channelId: "channelId(): String",
    serverId: "serverId(): String",
    memberCount: "memberCount(): Number",
    upper: "upper(value: String): String",
    lower: "lower(value: String): String",
    length: "length(value: String | Array<Any>): Number",
};

const SPRINT_3 = {
    string: "string(value: String | Number | Boolean): String",
    int: "int(value: Number | String): Number",
    decimal: "decimal(value: Number | String): Number",
    bool: "bool(value: Boolean | String): Boolean",
};

describe("Sprint 2 y Sprint 3", () => {
    for (const [name, signature] of Object.entries({ ...SPRINT_2, ...SPRINT_3 })) {
        it(`${name} existe con su firma`, () => {
            assert.deepEqual(languageService.contract.functionByName.get(name)?.signatures, [signature]);
        });
    }

    it("acepta usos válidos", () => {
        const source = [
            "const dado = randomRange(1, 6)",
            "const respuesta = choose([\"Sí\", \"No\"])",
            "const texto = upper(respuesta) + lower(username()) + displayName() + userId() + channelId() + serverId()",
            "const n = length(texto) + length([1, 2]) + memberCount() + now() + random() + dado",
            "ReplyMessage({ message: date() + \" \" + time() + \" \" + string(n) + string(true) })",
            "const total = int(\"10\") + decimal(\"10.5\") + int(3.7)",
            "if (bool(\"true\")) {",
            "    ReplyMessage({ message: string(total) })",
            "}",
        ].join("\n");
        assert.deepEqual(codes(source), []);
    });

    it("choose devuelve el tipo de los elementos", () => {
        assert.deepEqual(codes("const n = choose([1, 2]) + 1"), []);
        assert.deepEqual(codes("const n = choose([\"a\"]) - 1"), ["INCOMPATIBLE_OPERANDS"]);
    });

    it("rechaza argumentos incompatibles", () => {
        assert.deepEqual(codes("const a = upper(1)"), ["INCOMPATIBLE_ARGUMENT"]);
        assert.deepEqual(codes("const a = int(true)"), ["INCOMPATIBLE_ARGUMENT"]);
        assert.deepEqual(codes("const a = bool(1)"), ["INCOMPATIBLE_ARGUMENT"]);
        assert.deepEqual(codes("const a = string(null)"), ["INCOMPATIBLE_ARGUMENT"]);
        assert.deepEqual(codes("const a = randomRange(1)"), ["INVALID_ARGUMENT_COUNT"]);
    });
});

describe("diagnostics", () => {
    it("reporta errores léxicos, sintácticos y semánticos con la plantilla del contrato", () => {
        const [diagnostic] = languageService.analyze("const a = 1 == 2").diagnostics;
        assert.equal(diagnostic.code, "UNSUPPORTED_OPERATOR");
        assert.equal(diagnostic.message, "== no está disponible. Utilizar ===");
        assert.equal(languageService.analyze("const a = \"abc").diagnostics[0].code, "UNTERMINATED_STRING");
        assert.deepEqual(codes("ReplyMessage({ mesage: \"x\" })"), ["MISSING_CONFIG_PROPERTY", "UNKNOWN_CONFIG_PROPERTY"]);
        assert.equal(languageService.analyze("").diagnostics[0].code, "EMPTY_PROGRAM");
    });

    it("las construcciones no soportadas usan palabras y etiquetas del contrato", () => {
        const word = languageService.analyze("var a = 1").diagnostics[0];
        assert.equal(word.code, "UNSUPPORTED_CONSTRUCT");
        assert.equal(word.message, "var no está disponible en este lenguaje");
        const lexeme = languageService.analyze("const f = (a) => a").diagnostics[0];
        assert.equal(lexeme.message, "La función flecha (=>) no está disponible en este lenguaje");
        const structural = languageService.analyze("for (let i = 0; i < 3; i++) {\n}").diagnostics[0];
        assert.equal(structural.message, "El for clásico no está disponible en este lenguaje");
    });

    it("los formatos emiten el diagnóstico declarado en rules.formats", () => {
        assert.deepEqual(codes("const c = Channel(\"123\")"), ["INVALID_SNOWFLAKE"]);
        assert.deepEqual(codes("SendEmbed({ color: \"rojo\" })"), ["INVALID_COLOR"]);
        assert.deepEqual(codes("SendEmbed({ image: \"ftp://x.com/a.png\" })"), ["INVALID_URL"]);
    });

    it("exige descartar null según los patrones del contrato", () => {
        const access = "const member = GetMember(\"123456789012345678\")\n";
        assert.deepEqual(codes(`${access}ReplyMessage({ message: member.displayName })`), ["NULLABLE_MEMBER_ACCESS"]);
        assert.deepEqual(codes(`${access}if (member !== null) {\n    ReplyMessage({ message: member.displayName })\n}`), []);
        assert.deepEqual(codes(`${access}if (null !== member) {\n    ReplyMessage({ message: member.displayName })\n}`), []);
        assert.deepEqual(codes(`${access}if (member === null) {\n} else {\n    ReplyMessage({ message: member.displayName })\n}`), []);

        const restricted = createLanguageService(loadMutated((raw) => {
            raw.rules.nullNarrowing.supportedPatterns = ["identifier !== null"];
        }));
        const narrowed = restricted.analyze(`${access}if (null !== member) {\n    ReplyMessage({ message: member.displayName })\n}`);
        assert.deepEqual(narrowed.diagnostics.map((diagnostic) => diagnostic.code), ["NULLABLE_MEMBER_ACCESS"]);
    });

    it("cada código que emite el motor tiene plantilla en el contrato", () => {
        const root = path.join(process.cwd(), "lib", "custom-command-language");
        const files: string[] = [];
        const walk = (dir: string): void => {
            for (const entry of readdirSync(dir)) {
                const full = path.join(dir, entry);
                if (statSync(full).isDirectory()) walk(full);
                else if (full.endsWith(".ts")) files.push(full);
            }
        };
        walk(root);
        const emitted = new Set<string>();
        for (const file of files) {
            const source = readFileSync(file, "utf8");
            for (const match of source.matchAll(/(?:report|failAt)\((?:[^()"]*,\s*)?"([A-Z_]+)"/g)) emitted.add(match[1]);
            for (const match of source.matchAll(/"([A-Z][A-Z_]+)"\s*:\s*"[A-Z_]+"/g)) emitted.add(match[1]);
        }
        assert.ok(emitted.size > 20, `se detectaron solo ${emitted.size} códigos`);
        const missing = [...emitted].filter((code) => !languageService.contract.templates.has(code));
        assert.deepEqual(missing, []);
    });
});

describe("autocomplete", () => {
    it("sugiere funciones por prefijo", () => {
        const source = "Rep";
        const result = languageService.complete(source, source.length);
        const labels = result.items.map((item) => item.label);
        assert.ok(labels.includes("ReplyMessage"));
        assert.ok(labels.includes("ReplyEmbed"));
        assert.ok(!labels.includes("SendMessage"));
        assert.equal(result.from, 0);
    });

    it("sugiere propiedades de la configuración esperada", () => {
        const source = "SendEmbed({ ti })";
        const result = languageService.complete(source, source.indexOf("ti") + 2);
        const item = result.items.find((candidate) => candidate.label === "title");
        assert.equal(item?.kind, "property");
        assert.equal(item?.insertText, "title: ");
    });

    it("sugiere propiedades de un miembro y variables visibles", () => {
        const source = "const author = GetAuthor()\nconst name = author.dis";
        const members = languageService.complete(source, source.length).items.map((item) => item.label);
        assert.deepEqual(members, ["displayName"]);
        const variables = "const saludo = \"hola\"\nReplyMessage({ message: sal })";
        const items = languageService.complete(variables, variables.indexOf("sal })") + 3).items;
        assert.ok(items.some((item) => item.label === "saludo" && item.kind === "variable"));
    });

    it("no sugiere dentro de strings", () => {
        const source = "ReplyMessage({ message: \"Rep\" })";
        assert.deepEqual(languageService.complete(source, source.lastIndexOf("Rep") + 3).items, []);
    });
});

describe("hover", () => {
    it("describe funciones con su firma", () => {
        const source = "const n = randomRange(1, 6)";
        const hover = languageService.hover(source, source.indexOf("randomRange") + 2);
        assert.equal(hover?.title, "randomRange(min: Number, max: Number): Number");
    });

    it("describe variables con su tipo y propiedades de configuración", () => {
        const source = "const n = memberCount()\nReplyMessage({ message: string(n) })";
        assert.equal(languageService.hover(source, 6)?.title, "const n: Number");
        const property = languageService.hover(source, source.indexOf("message") + 1);
        assert.equal(property?.title, "ReplyMessageConfig.message: String");
    });

    it("avisa cuando una consulta puede devolver null", () => {
        const source = "const m = GetMember(\"123456789012345678\")";
        const hover = languageService.hover(source, source.indexOf("GetMember") + 1);
        assert.ok(hover?.lines.some((line) => line.includes("null")));
    });
});

describe("signature help", () => {
    it("marca el parámetro activo", () => {
        const source = "const n = randomRange(1, ";
        const help = languageService.signatureHelp(source, source.length);
        assert.equal(help?.name, "randomRange");
        assert.equal(help?.activeParameter, 1);
        assert.deepEqual(help?.parameters.map((parameter) => parameter.name), ["min", "max"]);
    });

    it("usa la llamada más interna", () => {
        const source = "ReplyMessage({ message: upper(";
        assert.equal(languageService.signatureHelp(source, source.length)?.name, "upper");
    });

    it("no responde fuera de una llamada", () => {
        assert.equal(languageService.signatureHelp("const a = 1", 5), null);
    });
});

describe("formatter", () => {
    it("formatea y es idempotente", () => {
        const result = languageService.format("if(true){ReplyMessage({message:'hola'})}");
        assert.equal(result.ok, true);
        assert.equal(result.code, "if (true) {\n    ReplyMessage({\n        message: \"hola\",\n    })\n}");
        assert.equal(languageService.format(result.code).code, result.code);
    });

    it("preserva comentarios", () => {
        const source = "// saludo\nReplyMessage({\n    message: \"hola\",\n})";
        assert.equal(languageService.format(source).code, source);
    });

    it("no reemplaza código inválido", () => {
        const result = languageService.format("const a = (");
        assert.equal(result.ok, false);
        assert.equal(result.code, "const a = (");
        assert.ok(result.diagnostics.length > 0);
    });
});
