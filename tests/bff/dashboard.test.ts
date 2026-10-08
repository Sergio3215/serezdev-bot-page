import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DASHBOARD_CATEGORIES, DASHBOARD_FEATURES, featuresOf } from "@/lib/dashboardFeatures";
import { canRestartBot, PLANS } from "@/lib/plans";

describe("categorías del dashboard", () => {
    it("Gestión agrupa cumpleaños, bienvenida, interacciones y reglas de canal", () => {
        assert.deepEqual(featuresOf("management").map((feature) => feature.id), ["birthday", "joinServer", "gif", "channelRule"]);
    });

    it("Automatización agrupa tareas programadas, comandos personalizados, limpieza automática y mensajes fantasma", () => {
        assert.deepEqual(featuresOf("automation").map((feature) => feature.id), ["scheduledTask", "customCommand", "autoCleanMessage", "ghostMessage"]);
    });

    it("Limpieza automática y Mensajes fantasma son dos tarjetas independientes de Automatización", () => {
        for (const [id, label] of [["autoCleanMessage", "Limpieza automática"], ["ghostMessage", "Mensajes fantasma"]]) {
            const matches = DASHBOARD_FEATURES.filter((feature) => feature.id === id);
            assert.equal(matches.length, 1, id);
            assert.equal(matches[0].category, "automation", id);
            assert.equal(matches[0].label, label, id);
            assert.equal(featuresOf("management").some((feature) => feature.id === id), false, id);
        }
    });

    it("no existe una feature genérica que agrupe ambas", () => {
        const ids: string[] = DASHBOARD_FEATURES.map((feature) => feature.id);
        assert.equal(ids.includes("messageCleanup"), false);
        assert.equal(DASHBOARD_FEATURES.some((feature) => feature.label === "Limpieza de mensajes"), false);
    });

    it("las categorías principales siguen siendo Gestión y Automatización", () => {
        assert.deepEqual(DASHBOARD_CATEGORIES.map((category) => category.id), ["management", "automation"]);
    });

    it("cada feature pertenece a una categoría existente y aparece una sola vez", () => {
        const categories = new Set(DASHBOARD_CATEGORIES.map((category) => category.id));
        const ids = DASHBOARD_FEATURES.map((feature) => feature.id);
        assert.equal(new Set(ids).size, ids.length);
        for (const feature of DASHBOARD_FEATURES) assert.ok(categories.has(feature.category), feature.id);
    });

    it("plan y reinicio no son features de ninguna categoría", () => {
        const ids: string[] = DASHBOARD_FEATURES.map((feature) => feature.id);
        for (const excluded of ["billing", "restart", "logout"]) assert.equal(ids.includes(excluded), false);
    });
});

describe("reinicio del bot", () => {
    it("solo lo pueden usar los dos servidores habilitados", () => {
        assert.equal(canRestartBot("1235045954491781150"), true);
        assert.equal(canRestartBot("748652112485023854"), true);
        assert.equal(canRestartBot("123456789012345678"), false);
        assert.equal(canRestartBot(""), false);
    });

    it("ningún plan lo ofrece como feature", () => {
        for (const plan of Object.values(PLANS)) {
            assert.equal(plan.features.some((feature) => /reinicio/i.test(feature)), false, plan.id);
        }
    });
});
