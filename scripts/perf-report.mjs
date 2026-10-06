#!/usr/bin/env node
// Reporte de bundles a partir de la salida de `next build` (Turbopack). Uso: npm run build && npm run perf:report [-- --json]
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const root = process.cwd();
const next = path.join(root, ".next");
const chunksDir = path.join(next, "static", "chunks");

if (!existsSync(path.join(next, "build-manifest.json"))) {
    console.error("No hay build: ejecutá `npm run build` primero.");
    process.exit(1);
}

const FEATURES = [
    { id: "customCommandsList", label: "Custom Commands: lista", marker: "Todavía no hay comandos personalizados" },
    { id: "customCommandsEditor", label: "Custom Commands: editor", marker: "Mensaje que activa el comando" },
    { id: "simpleMode", label: "Simple Mode", marker: "Responder con una tarjeta" },
    { id: "preview", label: "Preview", marker: "Mensaje de prueba" },
    { id: "languageContract", label: "Contrato + motor del lenguaje", marker: "serez-custom-command" },
    { id: "codeMirror", label: "CodeMirror", marker: "cm-editor" },
];

const sizeCache = new Map();
function sizeOf(file) {
    if (!sizeCache.has(file)) {
        const content = readFileSync(path.join(next, file));
        sizeCache.set(file, { raw: content.length, gzip: gzipSync(content).length, text: content.toString("utf8") });
    }
    return sizeCache.get(file);
}

function total(files) {
    let raw = 0;
    let gzip = 0;
    for (const file of files) {
        const size = sizeOf(file);
        raw += size.raw;
        gzip += size.gzip;
    }
    return { files: files.length, raw, gzip };
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

const buildManifest = JSON.parse(readFileSync(path.join(next, "build-manifest.json"), "utf8"));
const rootMain = buildManifest.rootMainFiles ?? [];

function routeEntries() {
    const routes = JSON.parse(readFileSync(path.join(next, "app-path-routes-manifest.json"), "utf8"));
    const result = [];
    for (const [entry, route] of Object.entries(routes)) {
        if (!entry.endsWith("/page")) continue;
        const manifestPath = path.join(next, "server", "app", `${entry}_client-reference-manifest.js`);
        if (!existsSync(manifestPath)) continue;
        globalThis.__RSC_MANIFEST = {};
        new Function(readFileSync(manifestPath, "utf8"))();
        const manifest = globalThis.__RSC_MANIFEST[entry];
        const files = new Set(rootMain);
        for (const list of Object.values(manifest.entryJSFiles ?? {})) for (const file of list) files.add(file);
        result.push({ route, files: [...files] });
    }
    return result.sort((a, b) => a.route.localeCompare(b.route));
}

const chunkFiles = readdirSync(chunksDir).filter((file) => file.endsWith(".js")).map((file) => `static/chunks/${file}`);

const ASYNC_GROUP = /Promise\.all\(\[((?:"static\/chunks\/[^"]+",?)+)\]\.map\(/g;
function asyncGroups() {
    const groups = new Map();
    for (const file of chunkFiles) {
        for (const match of sizeOf(file).text.matchAll(ASYNC_GROUP)) {
            const files = match[1].split(",").map((item) => item.replace(/"/g, ""));
            groups.set(files.join("|"), files);
        }
    }
    return [...groups.values()];
}

const markerChunks = Object.fromEntries(FEATURES.map((feature) => [
    feature.id,
    chunkFiles.filter((file) => sizeOf(file).text.includes(feature.marker)),
]));

function featuresIn(files) {
    const set = new Set(files);
    return FEATURES.filter((feature) => markerChunks[feature.id].some((file) => set.has(file))).map((feature) => feature.id);
}

const routes = routeEntries().map((entry) => ({ route: entry.route, ...total(entry.files), features: featuresIn(entry.files) }));
const groups = asyncGroups();

const lazy = FEATURES.map((feature) => {
    const candidates = groups.filter((files) => markerChunks[feature.id].some((file) => files.includes(file)));
    candidates.sort((a, b) => total(a).raw - total(b).raw);
    const smallest = candidates[0];
    return {
        feature: feature.id,
        label: feature.label,
        chunks: markerChunks[feature.id],
        loadedBy: smallest ? { ...total(smallest), features: featuresIn(smallest) } : null,
    };
});

const report = {
    generatedAt: new Date().toISOString(),
    nextVersion: JSON.parse(readFileSync(path.join(root, "node_modules", "next", "package.json"), "utf8")).version,
    totals: { chunks: chunkFiles.length, ...total(chunkFiles) },
    routes,
    lazy,
};

if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
} else {
    console.log(`# Bundle report (Next ${report.nextVersion})\n`);
    console.log(`Chunks JS: ${report.totals.chunks} · ${kb(report.totals.raw)} · gzip ${kb(report.totals.gzip)}\n`);
    console.log("## JS inicial por ruta\n");
    console.log("| Ruta | Archivos | Raw | Gzip | Features incluidas |");
    console.log("|---|---:|---:|---:|---|");
    for (const route of routes) {
        console.log(`| ${route.route} | ${route.files} | ${kb(route.raw)} | ${kb(route.gzip)} | ${route.features.join(", ") || "—"} |`);
    }
    console.log("\n## Carga diferida por feature\n");
    console.log("| Feature | Grupo dinámico más chico que la carga | Raw | Gzip | Features que arrastra ese grupo |");
    console.log("|---|---:|---:|---:|---|");
    for (const item of lazy) {
        const group = item.loadedBy;
        console.log(group
            ? `| ${item.label} | ${group.files} archivos | ${kb(group.raw)} | ${kb(group.gzip)} | ${group.features.join(", ")} |`
            : `| ${item.label} | (no está en un grupo dinámico) | — | — | — |`);
    }
}
