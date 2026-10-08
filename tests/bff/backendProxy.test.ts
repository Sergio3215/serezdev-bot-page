import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { endpointKey, forwardBody, forwardUrl, isAllowedEndpoint, isSnowflake, limitCheckFor, ownershipCheckFor } from "@/lib/backendProxy";
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

describe("limpieza de mensajes en el proxy", () => {
    const SERVER = "123456789012345678";
    const OTHER = "999999999999999999";

    for (const resource of ["autoCleanMessage", "ghostMessage"]) {
        it(`${resource}: permite listar, crear, editar, cambiar estado y eliminar`, () => {
            assert.equal(isAllowedEndpoint([resource], "GET"), true);
            assert.equal(isAllowedEndpoint([resource], "POST"), true);
            assert.equal(isAllowedEndpoint([resource, ID], "PUT"), true);
            assert.equal(isAllowedEndpoint([resource, ID, "status"], "PATCH"), true);
            assert.equal(isAllowedEndpoint([resource, ID], "DELETE"), true);
        });

        it(`${resource}: rechaza métodos y rutas no declaradas`, () => {
            assert.equal(isAllowedEndpoint([resource], "DELETE"), false);
            assert.equal(isAllowedEndpoint([resource], "PUT"), false);
            assert.equal(isAllowedEndpoint([resource, ID], "GET"), false);
            assert.equal(isAllowedEndpoint([resource, ID, "status"], "PUT"), false);
            assert.equal(isAllowedEndpoint([resource, ID, "run"], "POST"), false);
            assert.equal(isAllowedEndpoint([resource, "not-an-id"], "PUT"), false);
        });

        it(`${resource}: las operaciones por id verifican que el id sea de este servidor`, () => {
            assert.deepEqual(ownershipCheckFor([resource, ID]), { resource, id: ID });
            assert.deepEqual(ownershipCheckFor([resource, ID, "status"]), { resource, id: ID });
            assert.equal(ownershipCheckFor([resource]), null);
        });

        it(`${resource}: no tiene límite de plan definido`, () => {
            assert.equal(limitCheckFor("POST", [resource], "{}"), null);
            assert.equal(limitCheckFor("PATCH", [resource, ID, "status"], JSON.stringify({ enabled: true })), null);
        });
    }

    it("endpoints desconocidos parecidos se rechazan", () => {
        for (const path of [["autoClean"], ["ghostMessages"], ["messageCleanup"], ["autoCleanMessage", "run"]]) {
            assert.equal(isAllowedEndpoint(path, "GET"), false, path.join("/"));
            assert.equal(isAllowedEndpoint(path, "POST"), false, path.join("/"));
        }
    });

    it("el serverId de la query siempre es el de la ruta", () => {
        const url = forwardUrl("https://bot.test/api/v1", ["autoCleanMessage"], new URLSearchParams({ serverId: OTHER, x: "1" }), SERVER);
        assert.deepEqual(url.searchParams.getAll("serverId"), [SERVER]);
        assert.equal(url.searchParams.get("x"), "1");
        assert.equal(url.pathname, "/api/v1/autoCleanMessage");
    });

    it("el serverId del cuerpo siempre es el de la ruta", () => {
        const body = forwardBody(["ghostMessage"], { serverId: OTHER, channelId: "1", lifetimeValue: 1, lifetimeUnit: "hours" }, SERVER);
        assert.deepEqual(body, { channelId: "1", lifetimeValue: 1, lifetimeUnit: "hours", serverId: SERVER });
        assert.equal(forwardBody(["customCommand"], { serverId: OTHER }, SERVER).serverId, SERVER);
    });

    it("el cambio de estado manda solo { enabled }, como exige el bot", () => {
        assert.deepEqual(forwardBody(["autoCleanMessage", ID, "status"], { enabled: true, serverId: OTHER }, SERVER), { enabled: true });
        assert.deepEqual(forwardBody(["ghostMessage", ID, "status"], { enabled: false }, SERVER), { enabled: false });
        assert.equal(forwardBody(["scheduledTask", ID, "status"], { enabled: true }, SERVER).serverId, SERVER);
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
