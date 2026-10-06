import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SERVER_ONLY_MODULES = ["@/lib/internalApi", "@/lib/subscriptions", "@/lib/railway", "@/lib/payments/"];

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) return sourceFiles(full);
        return /\.(ts|tsx)$/.test(entry) ? [full] : [];
    });
}

describe("límite BFF ↔ navegador", () => {
    it("ningún módulo cliente importa código con el secreto interno o con acceso directo al bot", () => {
        const files = ["Components", "app", "lib"].flatMap((dir) => sourceFiles(path.join(process.cwd(), dir)));
        const offenders: string[] = [];
        for (const file of files) {
            const source = readFileSync(file, "utf8");
            if (!/^\s*["']use client["']/.test(source)) continue;
            for (const serverModule of SERVER_ONLY_MODULES) {
                if (source.includes(`from "${serverModule}`)) offenders.push(`${path.relative(process.cwd(), file)} → ${serverModule}`);
            }
            if (source.includes("INTERNAL_API_SECRET")) offenders.push(`${path.relative(process.cwd(), file)} → INTERNAL_API_SECRET`);
        }
        assert.deepEqual(offenders, []);
    });

    it("el cliente habla con el bot solo a través del proxy del BFF", async () => {
        const { botApiUrl } = await import("@/lib/botApi");
        assert.equal(botApiUrl("123456789012345678", "customCommand"), "/api/guilds/123456789012345678/backend/customCommand");
        assert.equal(botApiUrl("1/../2", "x", { a: "b" }), "/api/guilds/1%2F..%2F2/backend/x?a=b");
    });
});
