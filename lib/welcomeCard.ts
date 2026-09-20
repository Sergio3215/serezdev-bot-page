import {
    WELCOME_CARD_VERSION,
    WelcomeCardConfig,
    WelcomeCardSample,
    WelcomeCardSetup,
    WelcomeTextLayer,
    RenderImages,
    RenderOptions,
    LayerHit,
    BackgroundFit,
} from "@/types/WelcomeCard";

export const API_BASE = `${process.env.NEXT_PUBLIC_URL || "https://server-serez-dev-bot-production.up.railway.app"}/api/v1`;

/**
 * Vive bajo joinServer porque es la otra mitad de lo mismo: qué pasa cuando
 * alguien entra al servidor. `/setup` es el rol; `/setup-card`, la imagen.
 */
export const WELCOME_CARD_API = `${API_BASE}/joinServer/setup-card`;

export const CANVAS_PRESETS = [
    { label: "Banner 1024 × 500", width: 1024, height: 500 },
    { label: "Compacto 800 × 350", width: 800, height: 350 },
    { label: "Cuadrado 800 × 800", width: 800, height: 800 },
];

/**
 * Fuentes seguras: el bot tiene que tener registradas las mismas familias
 * (o un TTF equivalente) o la imagen no va a coincidir con la vista previa.
 */
export const FONT_OPTIONS = [
    { label: "Arial", value: "Arial, Helvetica, sans-serif" },
    { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
    { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
    { label: "Georgia", value: "Georgia, serif" },
    { label: "Times New Roman", value: "'Times New Roman', serif" },
    { label: "Courier New", value: "'Courier New', monospace" },
    { label: "Impact", value: "Impact, Charcoal, sans-serif" },
    { label: "Comic Sans MS", value: "'Comic Sans MS', cursive" },
];

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

/** Id corto y único para una capa de texto. */
export function newLayerId(): string {
    return `txt_${Math.random().toString(36).slice(2, 10)}`;
}

export function createTextLayer(patch: Partial<WelcomeTextLayer> = {}): WelcomeTextLayer {
    return {
        id: newLayerId(),
        label: "Texto",
        content: "Texto nuevo",
        x: 512,
        y: 250,
        align: "center",
        fontFamily: FONT_OPTIONS[0].value,
        fontSize: 40,
        fontWeight: 700,
        italic: false,
        uppercase: false,
        color: "#ffffff",
        opacity: 1,
        letterSpacing: 0,
        lineHeight: 1.2,
        maxWidth: null,
        strokeWidth: 0,
        strokeColor: "#000000",
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        shadowColor: "#000000",
        ...patch,
    };
}

export function createDefaultConfig(): WelcomeCardConfig {
    return {
        version: WELCOME_CARD_VERSION,
        canvas: { width: 1024, height: 500 },
        background: {
            type: "gradient",
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

export interface LoadedImage {
    img: HTMLImageElement;
    /** true si el host no manda cabeceras CORS: se ve, pero no se puede exportar el PNG. */
    tainted: boolean;
}

function rawLoad(url: string, anonymous: boolean): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        // Solo en el primer intento: si el host no responde con CORS, el navegador
        // descarta la imagen entera en vez de dibujarla.
        if (anonymous) img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`No se pudo cargar la imagen: ${url}`));
        img.src = url;
    });
}

/**
 * Carga una imagen para la vista previa, sin importar el formato (jpg, png, webp,
 * gif, avif: lo que soporte el navegador).
 *
 * Primero prueba con CORS, para que el lienzo quede "limpio" y se pueda exportar el
 * PNG. Si el host no manda `Access-Control-Allow-Origin` — la mayoría de los bancos
 * de imágenes — reintenta sin CORS: la imagen se ve igual, pero el lienzo queda
 * "tainted" y `toDataURL()` deja de funcionar.
 *
 * Al bot no le afecta nunca: descarga la imagen desde el servidor, donde CORS no existe.
 */
export async function loadEditorImage(url: string): Promise<LoadedImage> {
    try {
        return { img: await rawLoad(url, true), tainted: false };
    } catch {
        return { img: await rawLoad(url, false), tainted: true };
    }
}

function fitRect(iw: number, ih: number, w: number, h: number, fit: BackgroundFit) {
    if (fit === "stretch" || !iw || !ih) return { dx: 0, dy: 0, dw: w, dh: h };
    const scale = fit === "cover" ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    return { dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh };
}

function sourceSize(img: CanvasImageSource) {
    if (typeof HTMLImageElement !== "undefined" && img instanceof HTMLImageElement) {
        return { w: img.naturalWidth, h: img.naturalHeight };
    }
    const anyImg = img as { width?: number; height?: number };
    return { w: anyImg.width || 0, h: anyImg.height || 0 };
}

function hexToRgba(hex: string, alpha: number): string {
    const clean = hex.replace("#", "");
    const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
    const n = parseInt(full, 16);
    if (Number.isNaN(n)) return `rgba(0,0,0,${alpha})`;
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function gradientFor(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    angle: number,
    from: string,
    to: string
) {
    // 0° = de abajo hacia arriba, 90° = de izquierda a derecha (igual que CSS).
    const rad = ((angle - 90) * Math.PI) / 180;
    const cx = w / 2;
    const cy = h / 2;
    const len = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
    const dx = (Math.cos(rad) * len) / 2;
    const dy = (Math.sin(rad) * len) / 2;
    const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    grad.addColorStop(0, from);
    grad.addColorStop(1, to);
    return grad;
}

function shapePath(
    ctx: CanvasRenderingContext2D,
    shape: string,
    x: number,
    y: number,
    size: number,
    radius: number
) {
    const half = size / 2;
    ctx.beginPath();
    if (shape === "circle") {
        ctx.arc(x, y, half, 0, Math.PI * 2);
    } else if (shape === "rounded" && typeof ctx.roundRect === "function") {
        ctx.roundRect(x - half, y - half, size, size, Math.min(radius, half));
    } else {
        ctx.rect(x - half, y - half, size, size);
    }
    ctx.closePath();
}

function fontString(layer: WelcomeTextLayer, size: number) {
    return `${layer.italic ? "italic " : ""}${layer.fontWeight} ${size}px ${layer.fontFamily}`;
}

function resetEffects(ctx: CanvasRenderingContext2D) {
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowColor = "transparent";
}

/**
 * Dibuja la tarjeta completa y devuelve la caja de cada capa (el editor las usa
 * para saber qué elemento agarró el mouse).
 *
 * El bot puede reusar esta misma función con @napi-rs/canvas: la API 2D es
 * compatible salvo `filter` y `letterSpacing`, que se ignoran solos.
 */
export function drawWelcomeCard(
    ctx: CanvasRenderingContext2D,
    config: WelcomeCardConfig,
    sample: WelcomeCardSample,
    images: RenderImages,
    options: RenderOptions = {}
): LayerHit[] {
    const { width, height } = config.canvas;
    const bg = config.background;
    const hits: LayerHit[] = [];

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    /* --- fondo --- */
    if (bg.type === "image" && images.background) {
        const { w: iw, h: ih } = sourceSize(images.background);
        const { dx, dy, dw, dh } = fitRect(iw, ih, width, height, bg.fit);
        ctx.fillStyle = bg.color;
        ctx.fillRect(0, 0, width, height);
        if (bg.blur > 0) ctx.filter = `blur(${bg.blur}px)`;
        ctx.drawImage(images.background, dx, dy, dw, dh);
        ctx.filter = "none";
    } else if (bg.type === "gradient") {
        ctx.fillStyle = gradientFor(ctx, width, height, bg.gradient.angle, bg.gradient.from, bg.gradient.to);
        ctx.fillRect(0, 0, width, height);
    } else {
        ctx.fillStyle = bg.color;
        ctx.fillRect(0, 0, width, height);
    }

    if (bg.overlayOpacity > 0) {
        ctx.fillStyle = hexToRgba(bg.overlayColor, bg.overlayOpacity);
        ctx.fillRect(0, 0, width, height);
    }

    /* --- avatar --- */
    const av = config.avatar;
    if (av.enabled) {
        const half = av.size / 2;

        if (av.shadowBlur > 0) {
            ctx.save();
            ctx.shadowBlur = av.shadowBlur;
            ctx.shadowColor = av.shadowColor;
            ctx.fillStyle = "rgba(0,0,0,1)";
            shapePath(ctx, av.shape, av.x, av.y, av.size, av.radius);
            ctx.fill();
            ctx.restore();
        }

        if (images.avatar) {
            ctx.save();
            shapePath(ctx, av.shape, av.x, av.y, av.size, av.radius);
            ctx.clip();
            const { w: iw, h: ih } = sourceSize(images.avatar);
            const { dx, dy, dw, dh } = fitRect(iw, ih, av.size, av.size, "cover");
            ctx.drawImage(images.avatar, av.x - half + dx, av.y - half + dy, dw, dh);
            ctx.restore();
        } else {
            ctx.save();
            shapePath(ctx, av.shape, av.x, av.y, av.size, av.radius);
            ctx.fillStyle = "#2b2d31";
            ctx.fill();
            ctx.restore();
        }

        if (av.borderWidth > 0) {
            ctx.save();
            resetEffects(ctx);
            shapePath(ctx, av.shape, av.x, av.y, av.size, av.radius);
            ctx.lineWidth = av.borderWidth;
            ctx.strokeStyle = av.borderColor;
            ctx.stroke();
            ctx.restore();
        }

        hits.push({
            target: { kind: "avatar" },
            box: { x: av.x - half, y: av.y - half, width: av.size, height: av.size },
        });
    }

    /* --- textos --- */
    for (const layer of config.texts) {
        const raw = applyVariables(layer.content, sample);
        const text = layer.uppercase ? raw.toUpperCase() : raw;
        const lines = text.split("\n");

        ctx.save();
        const spacingCtx = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
        if ("letterSpacing" in spacingCtx) spacingCtx.letterSpacing = `${layer.letterSpacing}px`;

        // Si hay maxWidth y el texto no entra, achicamos la fuente hasta que entre.
        let size = layer.fontSize;
        ctx.font = fontString(layer, size);
        if (layer.maxWidth && layer.maxWidth > 0) {
            const natural = Math.max(...lines.map((l) => ctx.measureText(l).width), 1);
            if (natural > layer.maxWidth) {
                size = Math.max(8, Math.floor(size * (layer.maxWidth / natural)));
                ctx.font = fontString(layer, size);
            }
        }

        ctx.textAlign = layer.align;
        ctx.textBaseline = "middle";
        ctx.globalAlpha = layer.opacity;

        const lineHeight = size * layer.lineHeight;
        const blockHeight = lineHeight * lines.length;
        const firstY = layer.y - blockHeight / 2 + lineHeight / 2;

        let widest = 0;
        lines.forEach((line, i) => {
            const lineY = firstY + i * lineHeight;
            widest = Math.max(widest, ctx.measureText(line).width);

            if (layer.shadowBlur > 0 || layer.shadowOffsetX !== 0 || layer.shadowOffsetY !== 0) {
                ctx.shadowBlur = layer.shadowBlur;
                ctx.shadowOffsetX = layer.shadowOffsetX;
                ctx.shadowOffsetY = layer.shadowOffsetY;
                ctx.shadowColor = layer.shadowColor;
            }

            if (layer.strokeWidth > 0) {
                ctx.lineJoin = "round";
                ctx.miterLimit = 2;
                ctx.lineWidth = layer.strokeWidth * 2;
                ctx.strokeStyle = layer.strokeColor;
                ctx.strokeText(line, layer.x, lineY);
            }

            resetEffects(ctx); // que la sombra no se dibuje dos veces
            ctx.fillStyle = layer.color;
            ctx.fillText(line, layer.x, lineY);
        });

        ctx.restore();

        const boxX =
            layer.align === "center"
                ? layer.x - widest / 2
                : layer.align === "right"
                  ? layer.x - widest
                  : layer.x;

        hits.push({
            target: { kind: "text", id: layer.id },
            box: { x: boxX, y: layer.y - blockHeight / 2, width: widest, height: blockHeight },
        });
    }

    /* --- ayudas visuales del editor (nunca salen en la imagen del bot) --- */
    if (options.guides?.vertical || options.guides?.horizontal) {
        ctx.save();
        resetEffects(ctx);
        ctx.strokeStyle = "#f0b232";
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 6]);
        if (options.guides.vertical) {
            ctx.beginPath();
            ctx.moveTo(width / 2, 0);
            ctx.lineTo(width / 2, height);
            ctx.stroke();
        }
        if (options.guides.horizontal) {
            ctx.beginPath();
            ctx.moveTo(0, height / 2);
            ctx.lineTo(width, height / 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    const selection = options.selection;
    if (selection) {
        const hit = hits.find((h) =>
            selection.kind === "text"
                ? h.target.kind === "text" && h.target.id === selection.id
                : h.target.kind === "avatar"
        );

        if (hit) {
            ctx.save();
            resetEffects(ctx);
            const pad = 8;
            ctx.strokeStyle = "#5865F2";
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 5]);
            ctx.strokeRect(hit.box.x - pad, hit.box.y - pad, hit.box.width + pad * 2, hit.box.height + pad * 2);
            ctx.restore();
        }
    }

    ctx.restore();
    return hits;
}

/* ------------------------------------------------------------------ */
/* Normalización (defensa contra lo que devuelva la DB)                */
/* ------------------------------------------------------------------ */

function num(value: unknown, fallback: number, min: number, max: number): number {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

function str(value: unknown, fallback: string): string {
    return typeof value === "string" && value.length > 0 ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
    return typeof value === "boolean" ? value : fallback;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
    return allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * Convierte cualquier cosa que venga de la API en una config válida.
 * Si la DB tiene un esquema viejo o valores raros, el editor igual abre.
 */
export function normalizeConfig(raw: unknown): WelcomeCardConfig {
    const base = createDefaultConfig();
    if (!raw || typeof raw !== "object") return base;

    const input = raw as Record<string, unknown>;
    const canvas = (input.canvas ?? {}) as Record<string, unknown>;
    const background = (input.background ?? {}) as Record<string, unknown>;
    const gradient = (background.gradient ?? {}) as Record<string, unknown>;
    const avatar = (input.avatar ?? {}) as Record<string, unknown>;

    const width = num(canvas.width, base.canvas.width, 200, 2048);
    const height = num(canvas.height, base.canvas.height, 200, 2048);

    const texts = Array.isArray(input.texts)
        ? input.texts.slice(0, 12).map((item) => {
              const t = (item ?? {}) as Record<string, unknown>;
              return createTextLayer({
                  id: str(t.id, newLayerId()),
                  label: str(t.label, "Texto"),
                  content: typeof t.content === "string" ? t.content.slice(0, 200) : "Texto",
                  x: num(t.x, width / 2, -width, width * 2),
                  y: num(t.y, height / 2, -height, height * 2),
                  align: oneOf(t.align, ["left", "center", "right"] as const, "center"),
                  fontFamily: str(t.fontFamily, FONT_OPTIONS[0].value),
                  fontSize: num(t.fontSize, 40, 8, 200),
                  fontWeight: num(t.fontWeight, 700, 100, 900),
                  italic: bool(t.italic, false),
                  uppercase: bool(t.uppercase, false),
                  color: str(t.color, "#ffffff"),
                  opacity: num(t.opacity, 1, 0, 1),
                  letterSpacing: num(t.letterSpacing, 0, -20, 40),
                  lineHeight: num(t.lineHeight, 1.2, 0.6, 3),
                  maxWidth: t.maxWidth == null ? null : num(t.maxWidth, width, 20, width * 2),
                  strokeWidth: num(t.strokeWidth, 0, 0, 20),
                  strokeColor: str(t.strokeColor, "#000000"),
                  shadowBlur: num(t.shadowBlur, 0, 0, 80),
                  shadowOffsetX: num(t.shadowOffsetX, 0, -50, 50),
                  shadowOffsetY: num(t.shadowOffsetY, 0, -50, 50),
                  shadowColor: str(t.shadowColor, "#000000"),
              });
          })
        : base.texts;

    return {
        version: num(input.version, WELCOME_CARD_VERSION, 1, 999),
        canvas: { width, height },
        background: {
            type: oneOf(background.type, ["color", "gradient", "image"] as const, base.background.type),
            color: str(background.color, base.background.color),
            gradient: {
                from: str(gradient.from, base.background.gradient.from),
                to: str(gradient.to, base.background.gradient.to),
                angle: num(gradient.angle, base.background.gradient.angle, 0, 360),
            },
            imageUrl: typeof background.imageUrl === "string" ? background.imageUrl : null,
            fit: oneOf(background.fit, ["cover", "contain", "stretch"] as const, "cover"),
            blur: num(background.blur, 0, 0, 40),
            overlayColor: str(background.overlayColor, "#000000"),
            overlayOpacity: num(background.overlayOpacity, 0, 0, 1),
        },
        avatar: {
            enabled: bool(avatar.enabled, true),
            x: num(avatar.x, width / 2, -width, width * 2),
            y: num(avatar.y, height / 3, -height, height * 2),
            size: num(avatar.size, 180, 32, Math.max(width, height)),
            shape: oneOf(avatar.shape, ["circle", "rounded", "square"] as const, "circle"),
            radius: num(avatar.radius, 32, 0, 400),
            borderWidth: num(avatar.borderWidth, 8, 0, 40),
            borderColor: str(avatar.borderColor, "#5865F2"),
            shadowBlur: num(avatar.shadowBlur, 24, 0, 80),
            shadowColor: str(avatar.shadowColor, "#000000"),
        },
        texts,
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
