import {
    BIRTHDAY_CARD_VERSION,
    BirthdayCardConfig,
    BirthdayCardSample,
    BirthdayCardSetup,
    BirthdayDecoration,
    DecorationType,
    LayerHit,
    RenderImages,
    RenderOptions,
} from "@/types/BirthdayCard";
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
    oneOf,
    resetEffects,
} from "@/lib/card/engine";
import type { LoadedImage } from "@/lib/card/engine";
import { FONT_OPTIONS } from "@/lib/card/fonts";

// Reexportado para que los componentes sigan importando todo desde este módulo.
export { CANVAS_PRESETS, createTextLayer, loadEditorImage, newLayerId, FONT_OPTIONS };
export type { LoadedImage };

export const API_BASE = `${process.env.NEXT_PUBLIC_URL || "https://server-serez-dev-bot-production.up.railway.app"}/api/v1`;

/**
 * Al lado de `/setup`, que es el mensaje de texto. Acá solo vive el diseño de la
 * imagen: el canal y el mensaje ya están guardados en la configuración de
 * cumpleaños, así que la imagen siempre viaja adjunta a ese mismo saludo.
 */
export const BIRTHDAY_CARD_API = `${API_BASE}/birthday/setup-card`;

/**
 * Las que ofrece el editor para insertar en una capa. Cuáles usa cada tarjeta lo
 * decide quien la diseña; van con `$`, como las que ya acepta el mensaje.
 */
export const BIRTHDAY_VARIABLES = [
    { token: "$nombre", description: "Apodo o nombre visible del cumpleañero" },
    { token: "$usuario", description: "Usuario de Discord" },
    { token: "$edad", description: "Edad que cumple (vacío si no cargó el año)" },
    { token: "$servidor", description: "Nombre del servidor" },
    { token: "$fecha", description: "Fecha de hoy" },
];

export const DEFAULT_BIRTHDAY_SAMPLE: BirthdayCardSample = {
    displayName: "Cumpleañero",
    username: "cumpleanero",
    serverName: "Mi Servidor",
    age: 24,
    avatarUrl: "https://cdn.discordapp.com/embed/avatars/0.png",
    date: "",
};

/** "21 de septiembre", igual que lo tiene que escribir el bot. */
export function formatBirthdayDate(date: Date): string {
    return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long" }).format(date);
}

export const DECORATION_OPTIONS: { label: string; value: DecorationType }[] = [
    { label: "Sin adornos", value: "none" },
    { label: "Confeti", value: "confetti" },
    { label: "Globos", value: "balloons" },
    { label: "Estrellas", value: "stars" },
    { label: "Corazones", value: "hearts" },
];

export function createDecoration(patch: Partial<BirthdayDecoration> = {}): BirthdayDecoration {
    return {
        type: "confetti",
        amount: 70,
        colors: ["#f0b232", "#5865F2", "#eb459e", "#57f287"],
        seed: 1337,
        opacity: 0.9,
        size: 18,
        ...patch,
    };
}

export function createDefaultConfig(): BirthdayCardConfig {
    return {
        version: BIRTHDAY_CARD_VERSION,
        canvas: { width: 1024, height: 500 },
        background: {
            type: "color",
            color: "#1e1f22",
            gradient: { from: "#241a4f", to: "#f0b232", angle: 135 },
            imageUrl: null,
            fit: "cover",
            blur: 0,
            overlayColor: "#000000",
            overlayOpacity: 0,
        },
        decoration: createDecoration(),
        avatar: {
            enabled: true,
            x: 512,
            y: 152,
            size: 160,
            shape: "circle",
            radius: 32,
            borderWidth: 8,
            borderColor: "#f0b232",
            shadowBlur: 28,
            shadowColor: "#000000",
        },
        texts: [
            createTextLayer({
                label: "Saludo",
                content: "🎂 ¡Feliz cumpleaños! 🎉",
                x: 512,
                y: 272,
                fontSize: 44,
                fontWeight: 800,
                letterSpacing: 1,
                shadowBlur: 14,
                maxWidth: 900,
            }),
            createTextLayer({
                label: "Nombre",
                content: "$nombre",
                x: 512,
                y: 338,
                fontSize: 54,
                fontWeight: 700,
                color: "#f0b232",
                shadowBlur: 10,
                maxWidth: 900,
            }),
            createTextLayer({
                label: "Edad",
                content: "Hoy cumple $edad años",
                x: 512,
                y: 398,
                fontSize: 26,
                fontWeight: 400,
                color: "#ffe9c2",
                maxWidth: 900,
            }),
            createTextLayer({
                label: "Pie",
                content: "$servidor · $fecha",
                x: 512,
                y: 446,
                fontSize: 20,
                fontWeight: 400,
                color: "#e4d3b0",
                maxWidth: 900,
            }),
        ],
    };
}

export const BIRTHDAY_TEMPLATES: { name: string; build: () => BirthdayCardConfig }[] = [
    { name: "Fiesta", build: createDefaultConfig },
    {
        name: "Globos",
        build: () => {
            const base = createDefaultConfig();
            base.background = {
                ...base.background,
                gradient: { from: "#1d2b64", to: "#f8cdda", angle: 160 },
                overlayOpacity: 0.1,
            };
            base.decoration = createDecoration({
                type: "balloons",
                amount: 16,
                size: 40,
                opacity: 0.95,
                colors: ["#eb459e", "#5865F2", "#57f287", "#ffffff"],
                seed: 4242,
            });
            base.avatar = { ...base.avatar, borderColor: "#ffffff", shadowBlur: 20 };
            base.texts = [
                createTextLayer({
                    label: "Saludo",
                    content: "¡Feliz cumple, $nombre!",
                    x: 512,
                    y: 292,
                    fontSize: 50,
                    fontWeight: 800,
                    shadowBlur: 16,
                    maxWidth: 900,
                }),
                createTextLayer({
                    label: "Edad",
                    content: "$edad años y los que faltan 🎈",
                    x: 512,
                    y: 360,
                    fontSize: 28,
                    fontWeight: 400,
                    color: "#ffe6f2",
                    maxWidth: 900,
                }),
                createTextLayer({
                    label: "Pie",
                    content: "Te queremos en $servidor",
                    x: 512,
                    y: 430,
                    fontSize: 22,
                    fontWeight: 400,
                    color: "#f8cdda",
                    maxWidth: 900,
                }),
            ];
            return base;
        },
    },
    {
        name: "Dorado",
        build: () => {
            const base = createDefaultConfig();
            base.background = { ...base.background, type: "color", color: "#0f0f12", overlayOpacity: 0 };
            base.decoration = createDecoration({
                type: "stars",
                amount: 90,
                size: 14,
                opacity: 0.55,
                colors: ["#f0b232", "#ffd97d", "#ffffff"],
                seed: 777,
            });
            base.avatar = {
                ...base.avatar,
                borderColor: "#f0b232",
                borderWidth: 5,
                shadowBlur: 45,
                shadowColor: "#f0b232",
            };
            base.texts = [
                createTextLayer({
                    label: "Saludo",
                    content: "FELIZ CUMPLEAÑOS",
                    x: 512,
                    y: 278,
                    fontSize: 40,
                    fontWeight: 900,
                    uppercase: true,
                    letterSpacing: 8,
                    color: "#f0b232",
                    maxWidth: 900,
                }),
                createTextLayer({
                    label: "Nombre",
                    content: "$nombre",
                    x: 512,
                    y: 344,
                    fontSize: 56,
                    fontWeight: 700,
                    shadowBlur: 20,
                    shadowColor: "#f0b232",
                    maxWidth: 900,
                }),
                createTextLayer({
                    label: "Edad",
                    content: "$edad años",
                    x: 512,
                    y: 410,
                    fontSize: 24,
                    fontWeight: 400,
                    letterSpacing: 3,
                    uppercase: true,
                    color: "#8a8f98",
                    maxWidth: 900,
                }),
            ];
            return base;
        },
    },
    {
        name: "Pastel",
        build: () => {
            const base = createDefaultConfig();
            base.background = { ...base.background, type: "color", color: "#fdf2f8", overlayOpacity: 0 };
            base.decoration = createDecoration({
                type: "hearts",
                amount: 45,
                size: 20,
                opacity: 0.35,
                colors: ["#f472b6", "#fbbf24", "#a78bfa"],
                seed: 99,
            });
            base.avatar = {
                ...base.avatar,
                x: 210,
                y: 250,
                size: 190,
                borderColor: "#f472b6",
                borderWidth: 6,
                shadowBlur: 0,
            };
            base.texts = [
                createTextLayer({
                    label: "Saludo",
                    content: "¡Feliz cumpleaños!",
                    x: 370,
                    y: 200,
                    align: "left",
                    fontSize: 44,
                    fontWeight: 700,
                    color: "#831843",
                    maxWidth: 600,
                }),
                createTextLayer({
                    label: "Nombre",
                    content: "$nombre",
                    x: 370,
                    y: 262,
                    align: "left",
                    fontSize: 38,
                    fontWeight: 700,
                    color: "#db2777",
                    maxWidth: 600,
                }),
                createTextLayer({
                    label: "Edad",
                    content: "Hoy cumple $edad años",
                    x: 370,
                    y: 316,
                    align: "left",
                    fontSize: 22,
                    fontWeight: 400,
                    color: "#9d174d",
                    maxWidth: 600,
                }),
                createTextLayer({
                    label: "Pie",
                    content: "$servidor · $fecha",
                    x: 370,
                    y: 356,
                    align: "left",
                    fontSize: 17,
                    fontWeight: 400,
                    color: "#be185d",
                    maxWidth: 600,
                }),
            ];
            return base;
        },
    },
];

/* ------------------------------------------------------------------ */
/* Variables                                                           */
/* ------------------------------------------------------------------ */

export function applyVariables(content: string, sample: BirthdayCardSample): string {
    const edad = sample.age == null ? "" : String(sample.age);
    const fecha = sample.date || formatBirthdayDate(new Date());

    return (
        content
            .replace(/\$nombre/g, sample.displayName)
            .replace(/\$usuario/g, sample.username)
            .replace(/\$servidor/g, sample.serverName)
            .replace(/\$fecha/g, fecha)
            .replace(/\$edad/g, edad)
            // Si el miembro no cargó el año, `$edad` se va y deja un hueco:
            // "Hoy cumple  años" pasa a "Hoy cumple años".
            .replace(/[ \t]{2,}/g, " ")
            .replace(/[ \t]+\n/g, "\n")
    );
}

/* ------------------------------------------------------------------ */
/* Adornos                                                             */
/* ------------------------------------------------------------------ */

/**
 * Generador pseudoaleatorio con semilla (mulberry32).
 *
 * Es lo que hace que el editor y el bot dibujen exactamente el mismo confeti: con
 * `Math.random()` cada dibujado daría otra distribución y la vista previa sería
 * una mentira.
 */
function mulberry32(seed: number) {
    let t = seed >>> 0;
    return () => {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

function starPath(ctx: CanvasRenderingContext2D, size: number) {
    const outer = size / 2;
    const inner = outer * 0.45;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? outer : inner;
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
}

function heartPath(ctx: CanvasRenderingContext2D, size: number) {
    const s = size / 2;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.8);
    ctx.bezierCurveTo(-s * 1.4, -s * 0.3, -s * 0.5, -s * 1.15, 0, -s * 0.4);
    ctx.bezierCurveTo(s * 0.5, -s * 1.15, s * 1.4, -s * 0.3, 0, s * 0.8);
    ctx.closePath();
}

function drawBalloon(ctx: CanvasRenderingContext2D, size: number) {
    const rx = size * 0.36;
    const ry = size * 0.46;

    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // El nudo.
    ctx.beginPath();
    ctx.moveTo(-rx * 0.2, ry * 0.95);
    ctx.lineTo(rx * 0.2, ry * 0.95);
    ctx.lineTo(0, ry * 1.25);
    ctx.closePath();
    ctx.fill();

    // El hilo.
    ctx.beginPath();
    ctx.moveTo(0, ry * 1.25);
    ctx.quadraticCurveTo(rx * 0.8, ry * 1.9, 0, ry * 2.7);
    ctx.lineWidth = Math.max(1, size * 0.035);
    ctx.stroke();
}

/**
 * Dibuja los adornos sobre el fondo. Va antes que el avatar y que los textos, así
 * que nunca tapa lo que importa.
 */
export function drawDecoration(
    ctx: CanvasRenderingContext2D,
    decoration: BirthdayDecoration,
    width: number,
    height: number
) {
    if (decoration.type === "none" || decoration.amount <= 0 || decoration.opacity <= 0) return;

    const colors = decoration.colors.length > 0 ? decoration.colors : ["#ffffff"];
    const random = mulberry32(decoration.seed || 1);

    ctx.save();
    resetEffects(ctx);
    ctx.globalAlpha = decoration.opacity;

    for (let i = 0; i < decoration.amount; i++) {
        const color = colors[Math.floor(random() * colors.length) % colors.length];
        const x = random() * width;
        // Los globos flotan: se juntan arriba en vez de repartirse por todo el lienzo.
        const y = decoration.type === "balloons" ? random() * height * 0.72 : random() * height;
        const size = decoration.size * (0.6 + random() * 0.8);
        const angle = (random() - 0.5) * Math.PI;

        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = color;
        ctx.strokeStyle = color;

        if (decoration.type === "confetti") {
            ctx.rotate(angle);
            // Mitad tiras, mitad puntos: sin la mezcla parece una grilla.
            if (i % 3 === 0) {
                ctx.beginPath();
                ctx.arc(0, 0, size * 0.22, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillRect(-size / 2, -size * 0.18, size, size * 0.36);
            }
        } else if (decoration.type === "balloons") {
            drawBalloon(ctx, size * 1.6);
        } else if (decoration.type === "stars") {
            ctx.rotate(angle * 0.3);
            starPath(ctx, size);
            ctx.fill();
        } else {
            ctx.rotate(angle * 0.2);
            heartPath(ctx, size);
            ctx.fill();
        }

        ctx.restore();
    }

    ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Dibujo                                                              */
/* ------------------------------------------------------------------ */

/**
 * Dibuja la tarjeta de cumpleaños y devuelve la caja de cada capa. Reusa el motor
 * compartido; lo propio es cómo resuelve sus variables y la capa de adornos que
 * inyecta sobre el fondo.
 */
export function drawBirthdayCard(
    ctx: CanvasRenderingContext2D,
    config: BirthdayCardConfig,
    sample: BirthdayCardSample,
    images: RenderImages,
    options: RenderOptions = {}
): LayerHit[] {
    return drawCard(
        ctx,
        config,
        (content) => applyVariables(content, sample),
        images,
        options,
        (c, width, height) => drawDecoration(c, config.decoration, width, height)
    );
}

/* ------------------------------------------------------------------ */
/* Normalización (defensa contra lo que devuelva la DB)                */
/* ------------------------------------------------------------------ */

function normalizeDecoration(raw: unknown, base: BirthdayDecoration): BirthdayDecoration {
    const input = (raw ?? {}) as Record<string, unknown>;

    const colors = Array.isArray(input.colors)
        ? input.colors.filter((c): c is string => typeof c === "string" && c.length > 0).slice(0, 6)
        : [];

    return {
        type: oneOf(input.type, ["none", "confetti", "balloons", "stars", "hearts"] as const, base.type),
        amount: Math.round(num(input.amount, base.amount, 0, 200)),
        colors: colors.length > 0 ? colors : base.colors,
        seed: Math.round(num(input.seed, base.seed, 1, 999999)),
        opacity: num(input.opacity, base.opacity, 0, 1),
        size: Math.round(num(input.size, base.size, 4, 120)),
    };
}

/**
 * Convierte cualquier cosa que venga de la API en una config válida.
 * Si la DB tiene un esquema viejo o valores raros, el editor igual abre.
 */
export function normalizeConfig(raw: unknown): BirthdayCardConfig {
    const base = createDefaultConfig();
    if (!raw || typeof raw !== "object") return base;

    const input = raw as Record<string, unknown>;
    const { width, height } = normalizeCanvas(input.canvas, base.canvas);

    return {
        version: num(input.version, BIRTHDAY_CARD_VERSION, 1, 999),
        canvas: { width, height },
        background: normalizeBackground(input.background, base.background),
        decoration: normalizeDecoration(input.decoration, base.decoration),
        avatar: normalizeAvatar(input.avatar, base.avatar, width, height),
        texts: normalizeTexts(input.texts, base.texts, width, height),
    };
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

export interface BirthdayCardResponse {
    /** true cuando el endpoint todavía no existe (404). */
    apiMissing: boolean;
    setup: BirthdayCardSetup | null;
    error?: string;
}

/** GET /api/v1/birthday/setup-card?serverId=... */
export async function fetchBirthdayCard(
    serverId: string,
    signal?: AbortSignal
): Promise<BirthdayCardResponse> {
    try {
        const res = await fetch(`${BIRTHDAY_CARD_API}?serverId=${serverId}`, { signal });

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
                // La DB puede devolverlo como objeto o como texto.
                config: normalizeConfig(typeof row.config === "string" ? JSON.parse(row.config) : row.config),
            },
        };
    } catch (err) {
        if (signal?.aborted) return { apiMissing: false, setup: null };
        console.error("Error al obtener la tarjeta de cumpleaños:", err);
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
export async function saveBirthdayCard(setup: BirthdayCardSetup): Promise<SaveResult> {
    const isUpdate = Boolean(setup.id);

    const payload = {
        ...(isUpdate ? { id: setup.id } : {}),
        serverId: setup.serverId,
        enabled: setup.enabled,
        config: { ...setup.config, version: BIRTHDAY_CARD_VERSION },
    };

    try {
        const res = await fetch(BIRTHDAY_CARD_API, {
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
        console.error("Error al guardar la tarjeta de cumpleaños:", err);
        return { ok: false, apiMissing: false, message: "Ocurrió un error al conectar con el servidor." };
    }
}
