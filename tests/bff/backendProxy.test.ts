import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { endpointKey, isAllowedEndpoint, isSnowflake, limitCheckFor } from "@/lib/backendProxy";
import { buildCustomCommandPayload, effectiveRoleIds, normalizeCustomCommand } from "@/lib/customCommands";

const ID = "64b7f0c2a1b2c3d4e5f60718";

describe("allowlist del proxy", () => {
    it("normaliza IDs de documento en la clave del endpoint", () => {
        assert.equal(endpointKey(["customCommand", ID, "status"]), "customCommand/:id/status");
        assert.equal(endpointKey(["customCommand"]), "customCommand");
        assert.equal(endpointKey([ID]), ID);
    });

    it("permite solo los métodos declarados", () => {
        assert.equal(isAllowedEndpoint(["customCommand"], "GET"), true);
        assert.equal(isAllowedEndpoint(["customCommand", "preview"], "POST"), true);
        assert.equal(isAllowedEndpoint(["customCommand", ID], "PUT"), true);
        assert.equal(isAllowedEndpoint(["customCommand", ID, "status"], "PATCH"), true);
        assert.equal(isAllowedEndpoint(["customCommand", "preview"], "GET"), false);
        assert.equal(isAllowedEndpoint(["customCommand"], "DELETE"), false);
    });

    it("no expone endpoints internos", () => {
        for (const path of [["subscription"], ["subscriptions", "sync"], ["customCommand", "sync"], ["customCommand", "not-an-id"], ["..", "admin"]]) {
            for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"] as const) {
                assert.equal(isAllowedEndpoint(path, method), false, `${method} ${path.join("/")}`);
            }
        }
    });

    it("valida el serverId como snowflake", () => {
        assert.equal(isSnowflake("123456789012345678"), true);
        assert.equal(isSnowflake("1234"), false);
        assert.equal(isSnowflake("123456789012345678/../x"), false);
        assert.equal(isSnowflake(""), false);
    });
});

describe("controles de límite del plan", () => {
    it("crear cuenta contra el total", () => {
        assert.deepEqual(limitCheckFor("POST", ["customCommand"], "{}"), { resource: "customCommand", action: "create" });
        assert.deepEqual(limitCheckFor("POST", ["channelRule"], "{}"), { resource: "channelRule", action: "create" });
    });

    it("activar cuenta contra los activos", () => {
        assert.deepEqual(limitCheckFor("PATCH", ["customCommand", ID, "status"], JSON.stringify({ enabled: true })), { resource: "customCommand", action: "activate", id: ID });
        assert.deepEqual(limitCheckFor("PATCH", ["channelRule", ID, "enabled"], JSON.stringify({ enabled: true })), { resource: "channelRule", action: "activate", id: ID });
        assert.deepEqual(limitCheckFor("PUT", ["customCommand", ID], JSON.stringify({ enabled: true })), { resource: "customCommand", action: "activate", id: ID });
    });

    it("desactivar, editar sin activar, borrar y preview no consumen límite", () => {
        assert.equal(limitCheckFor("PATCH", ["customCommand", ID, "status"], JSON.stringify({ enabled: false })), null);
        assert.equal(limitCheckFor("PUT", ["customCommand", ID], JSON.stringify({ code: "x" })), null);
        assert.equal(limitCheckFor("DELETE", ["customCommand", ID], undefined), null);
        assert.equal(limitCheckFor("POST", ["customCommand", "preview"], "{}"), null);
        assert.equal(limitCheckFor("POST", ["scheduledTask"], "{}"), null);
    });
});

describe("helpers de comandos personalizados", () => {
    it("normaliza comandos anteriores al sprint", () => {
        assert.deepEqual(normalizeCustomCommand({ id: 1, command: "!hola", code: "x" }), {
            id: "1",
            command: "!hola",
            triggerType: "include",
            code: "x",
            description: null,
            allowedRoleIds: [],
            enabled: true,
        });
    });

    it("los roles efectivos descartan roles borrados solo cuando los roles cargaron", () => {
        assert.deepEqual(effectiveRoleIds(["1", " 2 ", "1", ""], null), ["1", "2"]);
        assert.deepEqual(effectiveRoleIds(["1", "2"], ["2", "3"]), ["2"]);
    });

    it("el payload recorta textos y solo marca enabled al crear", () => {
        const draft = { command: " !hola ", triggerType: "exact" as const, code: "x", description: "  ", allowedRoleIds: ["1", "9"] };
        assert.deepEqual(buildCustomCommandPayload(draft, ["1"], true), {
            command: "!hola",
            triggerType: "exact",
            code: "x",
            description: null,
            allowedRoleIds: ["1"],
            enabled: true,
        });
        assert.equal("enabled" in buildCustomCommandPayload(draft, ["1"], false), false);
    });
});
