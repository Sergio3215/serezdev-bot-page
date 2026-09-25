/**
 * Esquema de la tarjeta de cumpleaños.
 *
 * Misma idea que la de bienvenida: lo que se guarda NO es una imagen, es esta
 * "receta" declarativa. El bot la lee el día que le toca saludar a alguien y
 * dibuja el PNG en ese momento, ya con el avatar, el nombre y la edad reales.
 *
 * Dos diferencias con la de bienvenida, y son a propósito:
 *
 * 1. **No repite el canal ni el mensaje.** Los dos ya están guardados en el
 *    documento de cumpleaños (`/api/v1/birthday/setup` los devuelve en
 *    `channelId` y `message`), así que acá solo vive el diseño.
 * 2. **Tiene adornos.** Confeti, globos, estrellas o corazones dibujados por
 *    código, con semilla, para que la imagen sea festiva sin depender de un fondo.
 *
 * Las piezas comunes (lienzo, fondo, avatar, capa de texto y tipos de render)
 * viven en `@/lib/card/types`; acá solo lo propio del cumpleaños.
 */

import type {
    BackgroundType,
    BackgroundFit,
    AvatarShape,
    TextAlign,
    BaseCardConfig,
    CardAvatar,
    CardBackground,
    CardCanvas,
    CardTextLayer,
    SelectionTarget,
    HitBox,
    LayerHit,
    RenderImages,
    RenderOptions,
} from "@/lib/card/types";

/** Subila cada vez que cambies la forma del JSON, para poder migrar lo guardado. */
export const BIRTHDAY_CARD_VERSION = 1;

export type {
    BackgroundType,
    BackgroundFit,
    AvatarShape,
    TextAlign,
    SelectionTarget,
    HitBox,
    LayerHit,
    RenderImages,
    RenderOptions,
};

export type DecorationType = "none" | "confetti" | "balloons" | "stars" | "hearts";

export type BirthdayCanvas = CardCanvas;
export type BirthdayBackground = CardBackground;
export type BirthdayAvatar = CardAvatar;
/** Igual que la capa base; sus variables son $nombre, $usuario, $edad, $servidor, $fecha. */
export type BirthdayTextLayer = CardTextLayer;

/** Lo que hace que la tarjeta se vea de cumpleaños sin pedirle un fondo al admin. */
export interface BirthdayDecoration {
    type: DecorationType;
    /** Cantidad de piezas a dibujar. 0 = ninguna. */
    amount: number;
    /** Paleta de la que sale el color de cada pieza. */
    colors: string[];
    /**
     * Semilla del generador pseudoaleatorio. Sin ella, cada dibujado daría otra
     * distribución y la vista previa del editor no coincidiría con la imagen que
     * termina publicando el bot.
     */
    seed: number;
    opacity: number;
    /** Tamaño base de cada pieza en px; cada una sale entre 0,6× y 1,4×. */
    size: number;
}

export interface BirthdayCardConfig extends BaseCardConfig {
    decoration: BirthdayDecoration;
}

/**
 * El objeto completo que viaja a la API y se persiste.
 * Sin `channelId` ni `messageContent`: los aporta la configuración de cumpleaños.
 */
export interface BirthdayCardSetup {
    id?: string | null;
    serverId: string;
    enabled: boolean;
    config: BirthdayCardConfig;
}

/** Datos de mentira para la vista previa. En producción los completa el bot. */
export interface BirthdayCardSample {
    displayName: string;
    username: string;
    serverName: string;
    /** Edad que cumple. null = el miembro no cargó el año de nacimiento. */
    age: number | null;
    avatarUrl: string;
    /** Fecha a mostrar. Vacío = la de hoy, que es lo que va a usar el bot. */
    date: string;
}

/* ---------- props de los componentes del editor ---------- */

export interface birthdayCanvasType {
    config: BirthdayCardConfig;
    sample: BirthdayCardSample;
    images: RenderImages;
    selection: SelectionTarget | null;
    onSelect: (target: SelectionTarget | null) => void;
    onMove: (target: SelectionTarget, x: number, y: number) => void;
    canvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

export interface birthdayInspectorType {
    config: BirthdayCardConfig;
    selection: SelectionTarget | null;
    onCanvasChange: (patch: Partial<BirthdayCanvas>) => void;
    onBackgroundChange: (patch: Partial<BirthdayBackground>) => void;
    onDecorationChange: (patch: Partial<BirthdayDecoration>) => void;
    onAvatarChange: (patch: Partial<BirthdayAvatar>) => void;
    onTextChange: (id: string, patch: Partial<BirthdayTextLayer>) => void;
    onTextDelete: (id: string) => void;
}
