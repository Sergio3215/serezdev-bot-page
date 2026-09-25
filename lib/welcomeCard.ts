import {
    WELCOME_CARD_VERSION,
    WelcomeCardConfig,
    WelcomeCardSample,
    WelcomeCardSetup,
    RenderImages,
    RenderOptions,
    LayerHit,
} from "@/types/WelcomeCard";
import {
    CANVAS_PRESETS,
    createTextLayer,
    drawCard,
    loadEditorImage,
    newLayerId,
    normalizeAvatar,
    normalizeBackground,
    normalizeCanvas,
    normalizeTexts,
    num,
} from "@/lib/card/engine";
import type { LoadedImage } from "@/lib/card/engine";
import { FONT_OPTIONS } from "@/lib/card/fonts";

// Reexportado para que los componentes sigan importando todo desde este módulo.
export { CANVAS_PRESETS, createTextLayer, loadEditorImage, newLayerId, FONT_OPTIONS };
export type { LoadedImage };

export const API_BASE = `${process.env.NEXT_PUBLIC_URL || "https://server-serez-dev-bot-production.up.railway.app"}/api/v1`;

/**
 * Vive bajo joinServer porque es la otra mitad de lo mismo: qué pasa cuando
 * alguien entra al servidor. `/setup` es el rol; `/setup-card`, la imagen.
 */
export const WELCOME_CARD_API = `${API_BASE}/joinServer/setup-card`;

export const TEMPLATE_VARIABLES = [
    { token: "{user}", description: "Apodo o nombre visible del miembro" },
    { token: "{username}", description: "Usuario de Discord" },
    { token: "{server}", description: "Nombre del servidor" },
    { token: "{count}", description: "Cantidad de miembros" },
    { token: "{mention}", description: "Menciona al miembro (solo en el mensaje)" },
];

export const DEFAULT_SAMPLE: WelcomeCardSample = {
    displayName: "NuevoMiembro",
    username: "nuevomiembro",
    serverName: "Mi Servidor",
    memberCount: 1024,
    avatarUrl: "https://cdn.discordapp.com/embed/avatars/0.png",
};

export function createDefaultConfig(): WelcomeCardConfig {
    return {
        version: WELCOME_CARD_VERSION,
        canvas: { width: 1024, height: 500 },
        background: {
            type: "color",
            color: "#1e1f22",
            gradient: { from: "#1e1f22", to: "#5865F2", angle: 135 },
            imageUrl: null,
            fit: "cover",
            blur: 0,
            overlayColor: "#000000",
            overlayOpacity: 0,
        },
        avatar: {
            enabled: true,
            x: 512,
            y: 168,
            size: 180,
            shape: "circle",
            radius: 32,
            borderWidth: 8,
            borderColor: "#5865F2",
            shadowBlur: 24,
            shadowColor: "#000000",
        },
        texts: [
            createTextLayer({
                label: "Nombre",
                content: "{user}",
                x: 512,
                y: 320,
                fontSize: 56,
                fontWeight: 700,
                shadowBlur: 12,
                maxWidth: 900,
            }),
            createTextLayer({
                label: "Mensaje",
                content: "Te damos la bienvenida a {server}",
                x: 512,
                y: 382,
                fontSize: 28,
                fontWeight: 400,
                color: "#b5bac1",
                maxWidth: 900,
            }),
            createTextLayer({
                label: "Contador",
                content: "Sos el miembro #{count}",
                x: 512,
                y: 436,
                fontSize: 22,
                fontWeight: 400,
                color: "#8a8f98",
                maxWidth: 900,
            }),
        ],
    };
}

export const WELCOME_TEMPLATES: { name: string; build: () => WelcomeCardConfig }[] = [
    { name: "Discord", build: createDefaultConfig },
    {
        name: "Neón",
        build: () => {
            const base = createDefaultConfig();
            base.background = {
                ...base.background,
                type: "gradient",
                gradient: { from: "#0f0c29", to: "#e100ff", angle: 120 },
                overlayColor: "#000000",
                overlayOpacity: 0.25,
            };
            base.avatar = {
                ...base.avatar,
                borderColor: "#00f0ff",
                borderWidth: 6,
                shadowBlur: 40,
                shadowColor: "#00f0ff",
            };
            base.texts = [
                createTextLayer({
                    label: "Nombre",
                    content: "{user}",
                    x: 512,
                    y: 318,
                    fontSize: 60,
                    fontWeight: 900,
                    uppercase: true,
                    letterSpacing: 2,
                    shadowBlur: 24,
                    shadowColor: "#00f0ff",
                    maxWidth: 900,
                }),
                createTextLayer({
                    label: "Mensaje",
                    content: "entró a {server}",
                    x: 512,
                    y: 380,
                    fontSize: 26,
                    fontWeight: 400,
                    color: "#f0c7ff",
                    maxWidth: 900,
                }),
                createTextLayer({
                    label: "Contador",
                    content: "MIEMBRO {count}",
                    x: 512,
                    y: 436,
                    fontSize: 20,
                    fontWeight: 400,
                    letterSpacing: 4,
                    uppercase: true,
                    color: "#00f0ff",
                    maxWidth: 900,
                }),
            ];
            return base;
        },
    },
    {
        name: "Minimal",
        build: () => {
            const base = createDefaultConfig();
            base.background = { ...base.background, type: "color", color: "#f4f4f5" };
            base.avatar = {
                ...base.avatar,
                x: 200,
                y: 250,
                size: 200,
                borderColor: "#18181b",
                borderWidth: 4,
                shadowBlur: 0,
            };
            base.texts = [
                createTextLayer({
                    label: "Nombre",
                    content: "{user}",
                    x: 350,
                    y: 215,
                    align: "left",
                    fontSize: 52,
                    fontWeight: 700,
                    color: "#18181b",
                    maxWidth: 620,
                }),
                createTextLayer({
                    label: "Mensaje",
                    content: "Bienvenido a {server}",
                    x: 350,
                    y: 275,
                    align: "left",
                    fontSize: 26,
                    fontWeight: 400,
                    color: "#52525b",
                    maxWidth: 620,
                }),
                createTextLayer({
                    label: "Contador",
                    content: "Miembro #{count}",
                    x: 350,
                    y: 322,
                    align: "left",
                    fontSize: 18,
                    fontWeight: 400,
                    color: "#a1a1aa",
                    maxWidth: 620,
                }),
            ];
            return base;
        },
    },
];

/* ------------------------------------------------------------------ */
/* Variables                                                           */
/* ------------------------------------------------------------------ */

export function applyVariables(content: string, sample: WelcomeCardSample): string {
    return content
        .replace(/\{user\}/g, sample.displayName)
        .replace(/\{username\}/g, sample.username)
        .replace(/\{server\}/g, sample.serverName)
        .replace(/\{count\}/g, new Intl.NumberFormat("es-AR").format(sample.memberCount))
        .replace(/\{mention\}/g, `@${sample.displayName}`);
}

/* ------------------------------------------------------------------ */
/* Dibujo                                                              */
/* ------------------------------------------------------------------ */

/**
 * Dibuja la tarjeta de bienvenida y devuelve la caja de cada capa. Es un envoltorio
 * fino sobre el motor compartido: solo aporta cómo se resuelven sus variables.
 */
export function drawWelcomeCard(
    ctx: CanvasRenderingContext2D,
    config: WelcomeCardConfig,
    sample: WelcomeCardSample,
    images: RenderImages,
    options: RenderOptions = {}
): LayerHit[] {
    return drawCard(ctx, config, (content) => applyVariables(content, sample), images, options);
}

/* ------------------------------------------------------------------ */
/* Normalización (defensa contra lo que devuelva la DB)                */
/* ------------------------------------------------------------------ */

/**
 * Convierte cualquier cosa que venga de la API en una config válida.
 * Si la DB tiene un esquema viejo o valores raros, el editor igual abre.
 */
export function normalizeConfig(raw: unknown): WelcomeCardConfig {
    const base = createDefaultConfig();
    if (!raw || typeof raw !== "object") return base;

    const input = raw as Record<string, unknown>;
    const { width, height } = normalizeCanvas(input.canvas, base.canvas);

    return {
        version: num(input.version, WELCOME_CARD_VERSION, 1, 999),
        canvas: { width, height },
        background: normalizeBackground(input.background, base.background),
        avatar: normalizeAvatar(input.avatar, base.avatar, width, height),
        texts: normalizeTexts(input.texts, base.texts, width, height),
    };
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

export interface WelcomeCardResponse {
    /** true cuando el endpoint todavía no existe (404). */
    apiMissing: boolean;
    setup: WelcomeCardSetup | null;
    error?: string;
}

/** GET /api/v1/joinServer/setup-card?serverId=... */
export async function fetchWelcomeCard(
    serverId: string,
    signal?: AbortSignal
): Promise<WelcomeCardResponse> {
    try {
        const res = await fetch(`${WELCOME_CARD_API}?serverId=${serverId}`, { signal });

        if (res.status === 404) return { apiMissing: true, setup: null };
        if (!res.ok) return { apiMissing: false, setup: null, error: `Error ${res.status}` };

        const dto = await res.json();
        const row = dto.data?.[0];
        if (!row) return { apiMissing: false, setup: null };

        return {
            apiMissing: false,
            setup: {
                // Mongo devuelve _id salvo que el backend lo transforme a id.
                id: row.id ?? row._id ?? null,
                serverId: row.serverId ?? serverId,
                enabled: row.enabled ?? true,
                channelId: row.channelId ?? null,
                messageContent: row.messageContent ?? "",
                // La DB puede devolverlo como jsonb (objeto) o como texto.
                config: normalizeConfig(typeof row.config === "string" ? JSON.parse(row.config) : row.config),
            },
        };
    } catch (err) {
        if (signal?.aborted) return { apiMissing: false, setup: null };
        console.error("Error al obtener la tarjeta de bienvenida:", err);
        return { apiMissing: false, setup: null, error: "No se pudo conectar con el servidor." };
    }
}

export interface SaveResult {
    ok: boolean;
    apiMissing: boolean;
    message: string;
    id?: string | null;
}

/**
 * POST si todavía no existe la fila, PUT si ya existe.
 * Mismo criterio que joinServer y birthday.
 */
export async function saveWelcomeCard(setup: WelcomeCardSetup): Promise<SaveResult> {
    const isUpdate = Boolean(setup.id);

    const payload = {
        ...(isUpdate ? { id: setup.id } : {}),
        serverId: setup.serverId,
        enabled: setup.enabled,
        channelId: setup.channelId,
        messageContent: setup.messageContent,
        config: { ...setup.config, version: WELCOME_CARD_VERSION },
    };

    try {
        const res = await fetch(WELCOME_CARD_API, {
            method: isUpdate ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (res.status === 404) {
            return { ok: false, apiMissing: true, message: "El endpoint todavía no existe en el backend." };
        }

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            return { ok: false, apiMissing: false, message: data.message || `Error ${res.status} al guardar.` };
        }

        return {
            ok: true,
            apiMissing: false,
            message: data.message || (isUpdate ? "¡Diseño actualizado!" : "¡Diseño guardado!"),
            id: data.data?.id ?? data.data?._id ?? data.id ?? data._id ?? setup.id ?? null,
        };
    } catch (err) {
        console.error("Error al guardar la tarjeta de bienvenida:", err);
        return { ok: false, apiMissing: false, message: "Ocurrió un error al conectar con el servidor." };
    }
}
