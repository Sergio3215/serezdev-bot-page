import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadGuilds, MAX_GUILD_RETRIES, type GuildsResponse } from "@/lib/guildLoading";

const guild = { id: "1", name: "Serez", icon: null, owner: true, permissions: "8", features: [] };
const ok: GuildsResponse = { ok: true, status: 200, data: { botGuilds: [guild], otherAdminGuilds: [] } };
const limited = (retryAfter: number): GuildsResponse => ({ ok: false, status: 429, data: { retryAfter } });

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => { resolve = done; });
    return { promise, resolve };
}

describe("carga de servidores concurrente con la sesión", () => {
    it("pide los servidores sin esperar la sesión y aplica el resultado al confirmarse", async () => {
        const auth = deferred<boolean>();
        let requests = 0;
        const outcome = loadGuilds({
            authenticated: auth.promise,
            signal: new AbortController().signal,
            request: async () => { requests++; return ok; },
        });
        await Promise.resolve();
        assert.equal(requests, 1);
        auth.resolve(true);
        assert.deepEqual(await outcome, { kind: "loaded", botGuilds: [guild], otherAdminGuilds: [] });
    });

    it("no redirige a reautenticar si la sesión no es válida", async () => {
        const outcome = await loadGuilds({
            authenticated: Promise.resolve(false),
            signal: new AbortController().signal,
            request: async () => ({ ok: false, status: 401, data: { needsReauth: true } }),
        });
        assert.deepEqual(outcome, { kind: "cancelled" });
    });

    it("pide reautenticar ante 401 con needsReauth y sesión válida", async () => {
        const outcome = await loadGuilds({
            authenticated: Promise.resolve(true),
            signal: new AbortController().signal,
            request: async () => ({ ok: false, status: 401, data: { needsReauth: true } }),
        });
        assert.deepEqual(outcome, { kind: "reauth" });
    });

    it("un 401 sin needsReauth no reintenta ni redirige", async () => {
        let requests = 0;
        const outcome = await loadGuilds({
            authenticated: Promise.resolve(true),
            signal: new AbortController().signal,
            request: async () => { requests++; return { ok: false, status: 401, data: {} }; },
        });
        assert.deepEqual(outcome, { kind: "failed" });
        assert.equal(requests, 1);
    });

    it("ante 429 espera retryAfter acotado y reintenta hasta MAX_GUILD_RETRIES", async () => {
        const waits: number[] = [];
        let requests = 0;
        const outcome = await loadGuilds({
            authenticated: Promise.resolve(true),
            signal: new AbortController().signal,
            wait: async (seconds) => { waits.push(seconds); },
            request: async () => { requests++; return limited(requests === 1 ? 60 : 0.1); },
        });
        assert.deepEqual(outcome, { kind: "failed" });
        assert.equal(requests, MAX_GUILD_RETRIES + 1);
        assert.deepEqual(waits, [10, 0.5, 0.5]);
    });

    it("se recupera si un reintento responde bien", async () => {
        const responses = [limited(1), ok];
        const outcome = await loadGuilds({
            authenticated: Promise.resolve(true),
            signal: new AbortController().signal,
            wait: async () => undefined,
            request: async () => responses.shift() ?? ok,
        });
        assert.equal(outcome.kind, "loaded");
    });

    it("no hace más pedidos después de cancelar (logout o desmontaje)", async () => {
        const controller = new AbortController();
        let requests = 0;
        const outcome = await loadGuilds({
            authenticated: Promise.resolve(true),
            signal: controller.signal,
            wait: async () => { controller.abort(); },
            request: async () => { requests++; return limited(1); },
        });
        assert.deepEqual(outcome, { kind: "cancelled" });
        assert.equal(requests, 1);
    });

    it("ignora la respuesta si se canceló mientras estaba en vuelo", async () => {
        const controller = new AbortController();
        const response = deferred<GuildsResponse>();
        const outcome = loadGuilds({ authenticated: Promise.resolve(true), signal: controller.signal, request: () => response.promise });
        controller.abort();
        response.resolve(ok);
        assert.deepEqual(await outcome, { kind: "cancelled" });
    });
});
