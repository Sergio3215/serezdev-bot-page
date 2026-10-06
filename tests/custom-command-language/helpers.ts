import { readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { ContractError, loadContract, type ContractBundle } from "@/lib/custom-command-language";

const CONTRACT_DIR = path.join(process.cwd(), "contracts", "custom-command-language");
const FILES = ["syntax", "rules", "types", "functions", "formatter"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;

export interface RawContracts {
    manifest: Json;
    syntax: Json;
    rules: Json;
    types: Json;
    functions: Json;
    formatter: Json;
}

function read(name: string): Json {
    return JSON.parse(readFileSync(path.join(CONTRACT_DIR, `${name}.json`), "utf8"));
}

export function rawContracts(): RawContracts {
    return {
        manifest: read("manifest"),
        syntax: read("syntax"),
        rules: read("rules"),
        types: read("types"),
        functions: read("functions"),
        formatter: read("formatter"),
    };
}

export function bundleOf(raw: RawContracts): ContractBundle {
    const files: Record<string, unknown> = {};
    for (const name of FILES) files[`./${name}.json`] = raw[name];
    return { manifest: raw.manifest, files };
}

export function loadMutated(mutate: (raw: RawContracts) => void) {
    const raw = rawContracts();
    mutate(raw);
    return loadContract(bundleOf(raw));
}

export function assertRejected(mutate: (raw: RawContracts) => void, message: RegExp): void {
    assert.throws(() => loadMutated(mutate), (error: unknown) => {
        assert.ok(error instanceof ContractError, `se esperaba ContractError y llegó ${String(error)}`);
        assert.match(error.message, message);
        return true;
    });
}
