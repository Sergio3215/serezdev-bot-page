import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    OTHER_STRATEGY_CONFLICT,
    TIME_ERRORS,
    buildCleanupPayload,
    changeDraftUnit,
    channelConflict,
    cleanupErrorMessage,
    describeCleanup,
    draftFromConfig,
    emptyCleanupDraft,
    formatCleanupDuration,
    parseCleanupValue,
    prepareCleanupSave,
    timeInputStep,
    toCleanupConfig,
    validateCleanupTime,
    type CleanupLists,
} from "@/lib/messageCleanup";
import type { CleanupConfig, CleanupDraft } from "@/types/MessageCleanup";

const CHANNEL = "234567890123456789";
const OTHER_CHANNEL = "345678901234567890";
const noLists: CleanupLists = { autoClean: [], ghost: [] };
const config = (id: string, channelId: string): CleanupConfig => ({ id, channelId, value: 1, unit: "hours", enabled: true, nextRunAt: null });
const draft = (patch: Partial<CleanupDraft> = {}): CleanupDraft => ({ ...emptyCleanupDraft(), channelId: CHANNEL, value: "2.5", ...patch });

describe("validación de horas", () => {
    for (const value of [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 12, 24]) {
        it(`${value} horas es válido`, () => assert.equal(validateCleanupTime(value, "hours"), null));
    }
    for (const value of [0.1, 0.2, 0.3, 1.1, 1.33, 2.1, 2.6]) {
        it(`${value} horas no es múltiplo de 0.25`, () => assert.equal(validateCleanupTime(value, "hours"), TIME_ERRORS.hours));
    }
    it("0 y negativos son inválidos", () => {
        assert.equal(validateCleanupTime(0, "hours"), TIME_ERRORS.notPositive);
        assert.equal(validateCleanupTime(-1, "hours"), TIME_ERRORS.notPositive);
        assert.equal(validateCleanupTime(-0.25, "hours"), TIME_ERRORS.notPositive);
    });
    it("tolera el error de punto flotante de una suma de cuartos", () => {
        assert.equal(validateCleanupTime(0.1 + 0.15, "hours"), null);
    });
    it("NaN e infinito son inválidos", () => {
        assert.equal(validateCleanupTime(NaN, "hours"), TIME_ERRORS.empty);
        assert.equal(validateCleanupTime(Infinity, "hours"), TIME_ERRORS.empty);
    });
});

describe("validación de días", () => {
    for (const value of [1, 2, 3, 7, 15, 30]) {
        it(`${value} días es válido`, () => assert.equal(validateCleanupTime(value, "days"), null));
    }
    for (const value of [0.5, 1.25, 1.5, 2.5]) {
        it(`${value} días es inválido`, () => assert.equal(validateCleanupTime(value, "days"), TIME_ERRORS.days));
    }
    it("0 y negativos son inválidos", () => {
        assert.equal(validateCleanupTime(0, "days"), TIME_ERRORS.notPositive);
        assert.equal(validateCleanupTime(-1, "days"), TIME_ERRORS.notPositive);
    });
});

describe("unidad", () => {
    it("solo existen hours y days", () => {
        for (const unit of ["minutes", "weeks", "months", "cron", "", undefined]) {
            assert.equal(validateCleanupTime(1, unit), TIME_ERRORS.unit, String(unit));
        }
    });
});

describe("lectura del input", () => {
    it("acepta punto y coma decimal", () => {
        assert.equal(parseCleanupValue("2.5"), 2.5);
        assert.equal(parseCleanupValue(" 2,5 "), 2.5);
        assert.equal(parseCleanupValue("12"), 12);
    });
    it("rechaza texto, exponentes y signos", () => {
        for (const text of ["", "abc", "1e2", "-1", "+1", "1.", ".5", "1.2.3"]) assert.ok(Number.isNaN(parseCleanupValue(text)), text);
    });
});

describe("formato humano", () => {
    const cases: [number, "hours" | "days", string][] = [
        [0.25, "hours", "15 minutos"],
        [0.5, "hours", "30 minutos"],
        [0.75, "hours", "45 minutos"],
        [1, "hours", "1 hora"],
        [1.25, "hours", "1 hora 15 minutos"],
        [1.5, "hours", "1 hora 30 minutos"],
        [2.5, "hours", "2 horas 30 minutos"],
        [1, "days", "1 día"],
        [2, "days", "2 días"],
    ];
    for (const [value, unit, expected] of cases) {
        it(`${value} ${unit} → ${expected}`, () => assert.equal(formatCleanupDuration(value, unit), expected));
    }
    it("Auto Clean y Ghost describen la duración distinto", () => {
        assert.equal(describeCleanup("autoClean", { value: 2.5, unit: "hours" }), "Cada 2 horas y 30 minutos");
        assert.equal(describeCleanup("autoClean", { value: 12, unit: "hours" }), "Cada 12 horas");
        assert.equal(describeCleanup("ghost", { value: 2.5, unit: "hours" }), "Los mensajes duran 2 horas y 30 minutos");
        assert.equal(describeCleanup("ghost", { value: 1, unit: "days" }), "Los mensajes duran 1 día");
    });
});

describe("formulario", () => {
    it("horas usa step 0.25 y días step 1", () => {
        assert.equal(timeInputStep("hours"), 0.25);
        assert.equal(timeInputStep("days"), 1);
    });

    it("días rechaza decimales", () => {
        const result = prepareCleanupSave("autoClean", draft({ value: "1.5", unit: "days" }), noLists);
        assert.deepEqual(result, { ok: false, errors: { value: TIME_ERRORS.days } });
    });

    it("pasar 2.5 Horas a Días conserva el número y lo marca inválido en vez de mandarlo", () => {
        const changed = changeDraftUnit(draft({ value: "2.5", unit: "hours" }), "days");
        assert.equal(changed.value, "2.5");
        assert.equal(changed.unit, "days");
        assert.equal(prepareCleanupSave("ghost", changed, noLists).ok, false);
    });

    it("no hay payload si el borrador es inválido", () => {
        for (const invalid of [draft({ channelId: "" }), draft({ value: "" }), draft({ value: "0" }), draft({ value: "1.33" }), draft({ value: "-1" })]) {
            assert.equal(prepareCleanupSave("autoClean", invalid, noLists).ok, false, JSON.stringify(invalid));
        }
        assert.deepEqual(prepareCleanupSave("autoClean", draft({ channelId: "" }), noLists), { ok: false, errors: { channelId: "Seleccioná un canal." } });
    });

    it("el payload usa los campos de cada contrato", () => {
        assert.deepEqual(buildCleanupPayload("autoClean", draft()), { channelId: CHANNEL, frequencyValue: 2.5, frequencyUnit: "hours", enabled: true });
        assert.deepEqual(buildCleanupPayload("ghost", draft({ value: "3", unit: "days", enabled: false })), { channelId: CHANNEL, lifetimeValue: 3, lifetimeUnit: "days", enabled: false });
    });

    it("el payload no lleva serverId: lo fija el BFF", () => {
        const result = prepareCleanupSave("autoClean", draft(), noLists);
        assert.ok(result.ok);
        assert.equal("serverId" in result.payload, false);
    });

    it("editar carga los valores actuales", () => {
        const auto = toCleanupConfig("autoClean", { id: "a", serverId: "1", channelId: CHANNEL, frequencyValue: 2.5, frequencyUnit: "hours", enabled: false, nextRunAt: "2026-10-08T12:00:00.000Z" });
        assert.deepEqual(draftFromConfig(auto), { id: "a", channelId: CHANNEL, value: "2.5", unit: "hours", enabled: false });
        assert.equal(auto.nextRunAt, "2026-10-08T12:00:00.000Z");
        const ghost = toCleanupConfig("ghost", { id: "g", serverId: "1", channelId: CHANNEL, lifetimeValue: 1, lifetimeUnit: "days", enabled: true });
        assert.deepEqual(ghost, { id: "g", channelId: CHANNEL, value: 1, unit: "days", enabled: true, nextRunAt: null });
    });
});

describe("conflicto Auto Clean / Ghost", () => {
    const lists: CleanupLists = { autoClean: [config("a1", CHANNEL)], ghost: [config("g1", OTHER_CHANNEL)] };

    it("un canal con Ghost no puede recibir Auto Clean, y al revés", () => {
        assert.equal(channelConflict("autoClean", OTHER_CHANNEL, lists, null), OTHER_STRATEGY_CONFLICT);
        assert.equal(channelConflict("ghost", CHANNEL, lists, null), OTHER_STRATEGY_CONFLICT);
        assert.deepEqual(prepareCleanupSave("ghost", draft({ channelId: CHANNEL }), lists), { ok: false, errors: { channelId: OTHER_STRATEGY_CONFLICT } });
    });

    it("la misma estrategia no se duplica en un canal, pero editar la propia sí se permite", () => {
        assert.match(channelConflict("autoClean", CHANNEL, lists, null) ?? "", /ya tiene una limpieza automática/);
        assert.equal(channelConflict("autoClean", CHANNEL, lists, "a1"), null);
    });

    it("un 409 del bot se traduce a un mensaje entendible", () => {
        assert.equal(cleanupErrorMessage("autoClean", 409, { message: "El canal ya posee una configuración Ghost Message" }, ""), OTHER_STRATEGY_CONFLICT);
        assert.equal(cleanupErrorMessage("ghost", 409, { message: "El canal ya posee una configuración Auto Clean Message" }, ""), OTHER_STRATEGY_CONFLICT);
        assert.match(cleanupErrorMessage("autoClean", 409, { message: "El canal ya posee una configuración Auto Clean Message" }, ""), /ya tiene una limpieza automática/);
        assert.equal(cleanupErrorMessage("ghost", 409, {}, ""), OTHER_STRATEGY_CONFLICT);
    });
});

describe("errores de la API", () => {
    it("no muestra textos técnicos del bot", () => {
        const message = cleanupErrorMessage("autoClean", 400, { message: "frequencyValue debe ser un múltiplo positivo de 0.25 para hours" }, "x");
        assert.equal(message.includes("frequencyValue"), false);
    });
    it("cubre sesión, permisos, recurso, caída y error interno", () => {
        assert.match(cleanupErrorMessage("ghost", 401, {}, ""), /sesión/);
        assert.equal(cleanupErrorMessage("ghost", 403, { error: "No administrás este servidor" }, ""), "No administrás este servidor");
        assert.match(cleanupErrorMessage("ghost", 404, {}, ""), /No se encontró/);
        assert.match(cleanupErrorMessage("ghost", 0, {}, ""), /No se pudo conectar/);
        assert.match(cleanupErrorMessage("ghost", 502, {}, ""), /No se pudo conectar/);
        assert.equal(cleanupErrorMessage("ghost", 500, { message: "stack" }, "No se pudo guardar."), "No se pudo guardar.");
    });
});
