import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import * as route from "@/app/api/guilds/[server]/backend/[...path]/route";

const SERVER = "123456789012345678";
const OTHER_SERVER = "999999999999999999";
const OWN_ID = "64b7f0c2a1b2c3d4e5f60718";
const FOREIGN_ID = "64b7f0c2a1b2c3d4e5f60719";

type Call = { url: URL; method: string; body: string | undefined };

let calls: Call[];
let permissions: string;
let tokenCounter = 0;
const realFetch = globalThis.fetch;

/** Discord responde la lista de servidores del usuario; el bot, el listado del recurso con un id propio. */
beforeEach(() => {
    calls = [];
    permissions = "8";
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(input instanceof Request ? input.url : input.toString());
        if (url.hostname === "discord.com") {
            return Response.json([{ id: SERVER, owner: false, permissions }]);
        }
        calls.push({ url, method: init?.method ?? "GET", body: init?.body as string | undefined });
        if ((init?.method ?? "GET") === "GET") return Response.json({ data: [{ id: OWN_ID, enabled: true }] });
        return Response.json({ message: "ok", data: {} });
    }) as typeof fetch;
});

afterEach(() => {
    globalThis.fetch = realFetch;
});

async function call(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string[], options: { query?: string; body?: unknown; server?: string } = {}) {
    // Un token distinto por request: checkGuildAdmin cachea la lista de servidores por credencial.
    const token = `token-${++tokenCounter}`;
    const server = options.server ?? SERVER;
    const request = new NextRequest(`http://localhost/api/guilds/${server}/backend/${path.join("/")}${options.query ?? ""}`, {
        method,
        headers: { cookie: `discord_token=${token}`, "content-type": "application/json" },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    return route[method](request, { params: Promise.resolve({ server, path }) });
}

describe("proxy de limpieza de mensajes", () => {
    it("GET fuerza el serverId de la ruta aunque el cliente mande otro", async () => {
        const res = await call("GET", ["autoCleanMessage"], { query: `?serverId=${OTHER_SERVER}` });
        assert.equal(res.status, 200);
        assert.deepEqual(calls[0].url.searchParams.getAll("serverId"), [SERVER]);
        assert.equal(calls[0].url.pathname.endsWith("/autoCleanMessage"), true);
    });

    it("POST reemplaza el serverId del cuerpo", async () => {
        const res = await call("POST", ["ghostMessage"], { body: { serverId: OTHER_SERVER, channelId: "234567890123456789", lifetimeValue: 1, lifetimeUnit: "hours", enabled: true } });
        assert.equal(res.status, 200);
        assert.equal(calls.length, 1);
        assert.equal(JSON.parse(calls[0].body ?? "{}").serverId, SERVER);
    });

    it("PATCH de estado verifica el dueño y manda solo { enabled }", async () => {
        const res = await call("PATCH", ["autoCleanMessage", OWN_ID, "status"], { body: { enabled: false, serverId: OTHER_SERVER } });
        assert.equal(res.status, 200);
        assert.equal(calls.length, 2);
        assert.equal(calls[0].method, "GET");
        assert.equal(calls[0].url.searchParams.get("serverId"), SERVER);
        assert.equal(calls[1].method, "PATCH");
        assert.deepEqual(JSON.parse(calls[1].body ?? "{}"), { enabled: false });
        assert.equal(calls[1].url.searchParams.get("serverId"), SERVER);
    });

    for (const [method, path] of [["PUT", ["ghostMessage", FOREIGN_ID]], ["DELETE", ["autoCleanMessage", FOREIGN_ID]], ["PATCH", ["ghostMessage", FOREIGN_ID, "status"]]] as const) {
        it(`${method} sobre un id de otro servidor responde 404 sin llegar al bot`, async () => {
            const res = await call(method, [...path], { body: method === "DELETE" ? undefined : { enabled: true } });
            assert.equal(res.status, 404);
            assert.deepEqual(calls.map((item) => item.method), ["GET"]);
        });
    }

    it("PUT y DELETE sobre un id propio se reenvían", async () => {
        assert.equal((await call("PUT", ["ghostMessage", OWN_ID], { body: { channelId: "234567890123456789", lifetimeValue: 2, lifetimeUnit: "days", enabled: true } })).status, 200);
        assert.deepEqual(calls.map((item) => item.method), ["GET", "PUT"]);
        calls = [];
        assert.equal((await call("DELETE", ["autoCleanMessage", OWN_ID])).status, 200);
        assert.deepEqual(calls.map((item) => item.method), ["GET", "DELETE"]);
    });

    it("sin permisos de administración responde 403 y no llama al bot", async () => {
        permissions = "0";
        const res = await call("GET", ["ghostMessage"]);
        assert.equal(res.status, 403);
        assert.equal(calls.length, 0);
    });

    it("sin sesión responde 401", async () => {
        const request = new NextRequest(`http://localhost/api/guilds/${SERVER}/backend/autoCleanMessage`);
        const res = await route.GET(request, { params: Promise.resolve({ server: SERVER, path: ["autoCleanMessage"] }) });
        assert.equal(res.status, 401);
        assert.equal(calls.length, 0);
    });

    it("método no permitido y endpoint desconocido responden 404", async () => {
        assert.equal((await call("DELETE", ["autoCleanMessage"])).status, 404);
        assert.equal((await call("POST", ["autoCleanMessage", OWN_ID, "run"], { body: {} })).status, 404);
        assert.equal((await call("GET", ["messageCleanup"])).status, 404);
        assert.equal(calls.length, 0);
    });

    it("serverId inválido en la ruta responde 400", async () => {
        assert.equal((await call("GET", ["ghostMessage"], { server: "1/../2" })).status, 400);
        assert.equal(calls.length, 0);
    });
});
