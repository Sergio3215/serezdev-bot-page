import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SimpleModelError, generateSimpleSource, languageService, readSimpleSource, simpleShape, type SimpleAction } from "@/lib/custom-command-language";

const CHANNEL = "123456789012345678";
const ROLE = "371826690424569866";
const MEMBER = "234567890123456789";
const contract = languageService.contract;

const ACTIONS: Record<string, SimpleAction> = {
    SendMessage: { functionName: "SendMessage", values: { channel: CHANNEL, message: "Hola {autor}" } },
    ReplyMessage: { functionName: "ReplyMessage", values: { message: "Hola" } },
    SendEmbed: { functionName: "SendEmbed", values: { title: "Aviso", color: "#5865F2", footer: { text: "pie" } } },
    ReplyEmbed: { functionName: "ReplyEmbed", values: { description: "Hola {mencionado}" } },
    AddRoleAuthor: { functionName: "AddRole", values: { member: { source: "GetAuthor" }, role: ROLE } },
    AddRoleMentions: { functionName: "AddRole", values: { member: { source: "GetMentionedMembers" }, role: ROLE } },
    AddRoleFixed: { functionName: "AddRole", values: { member: MEMBER, role: ROLE } },
};

describe("modo simple", () => {
    for (const [name, action] of Object.entries(ACTIONS)) {
        it(`${name}: genera código válido y lo vuelve a leer igual`, () => {
            const source = generateSimpleSource([action]);
            const analysis = languageService.analyze(source);
            assert.deepEqual(analysis.diagnostics, [], source);
            assert.deepEqual(readSimpleSource(source), [action]);
        });
    }

    it("varias acciones se generan y leen en orden", () => {
        const actions = [ACTIONS.ReplyMessage, ACTIONS.AddRoleFixed, ACTIONS.SendEmbed];
        const source = generateSimpleSource(actions);
        assert.deepEqual(languageService.analyze(source).diagnostics, []);
        assert.deepEqual(readSimpleSource(source), actions);
    });

    it("los marcadores generan menciones", () => {
        const source = generateSimpleSource([ACTIONS.SendMessage]);
        assert.match(source, /"Hola <@" \+ GetAuthor\(\)\.id \+ ">"/);
        assert.match(source, /Channel\("123456789012345678"\)/);
    });

    it("un miembro fijo se resuelve con GetMember y se descarta null", () => {
        const source = generateSimpleSource([ACTIONS.AddRoleFixed]);
        assert.match(source, /const member = GetMember\("234567890123456789"\)/);
        assert.match(source, /if \(member !== null\)/);
    });

    it("solo representa visualmente acciones con controles", () => {
        const visual = [...contract.functionByName.values()]
            .filter((definition) => simpleShape(contract, definition) !== null)
            .map((definition) => definition.name)
            .sort();
        assert.deepEqual(visual, ["AddRole", "ReplyEmbed", "ReplyMessage", "SendEmbed", "SendMessage"]);
    });

    it("no genera funciones exclusivas del modo avanzado", () => {
        for (const functionName of ["random", "randomRange", "string", "int", "HasRole", "GetMember", "Channel"]) {
            assert.throws(() => generateSimpleSource([{ functionName, values: {} }]), SimpleModelError, functionName);
        }
        assert.throws(() => generateSimpleSource([{ functionName: "NoExiste", values: {} }]), SimpleModelError);
        assert.throws(() => generateSimpleSource([{ functionName: "ReplyMessage", values: { mensaje: "x" } }]), SimpleModelError);
    });

    it("no lee código que el modo simple no puede representar", () => {
        assert.equal(readSimpleSource("ReplyMessage({ message: string(random()) })"), null);
        assert.equal(readSimpleSource("const saludo = \"hola\"\nReplyMessage({ message: saludo })"), null);
        assert.equal(readSimpleSource("// nota\nReplyMessage({ message: \"hola\" })"), null);
        assert.equal(readSimpleSource("if (true) {\n    ReplyMessage({ message: \"hola\" })\n}"), null);
        assert.equal(readSimpleSource("ReplyMessage({ message: "), null);
    });
});
