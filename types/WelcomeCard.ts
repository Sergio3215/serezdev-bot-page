/**
 * Esquema de la tarjeta de bienvenida.
 *
 * Lo que se guarda en la base de datos NO es una imagen: es esta "receta"
 * declarativa. El bot la lee cuando entra un miembro y dibuja el PNG en ese
 * momento, ya con el avatar y el nombre reales.
 *
 * Las piezas comunes con la tarjeta de cumpleaños (lienzo, fondo, avatar, capa de
 * texto y tipos de render) viven en `@/lib/card/types`; acá solo lo propio de la
 * bienvenida.
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
export const WELCOME_CARD_VERSION = 1;

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

export type WelcomeCanvas = CardCanvas;
export type WelcomeBackground = CardBackground;
export type WelcomeAvatar = CardAvatar;
/** Igual que la capa base; sus variables son {user}, {username}, {server}, {count}. */
export type WelcomeTextLayer = CardTextLayer;
export type WelcomeCardConfig = BaseCardConfig;

/** El objeto completo que viaja a la API y se persiste. */
export interface WelcomeCardSetup {
    id?: string | null;
    serverId: string;
    enabled: boolean;
    /** Canal donde el bot publica la bienvenida. null = todavía sin elegir. */
    channelId: string | null;
    /** Texto que acompaña a la imagen. Acepta las mismas variables + {mention}. */
    messageContent: string;
    config: WelcomeCardConfig;
}

/** Datos de mentira para la vista previa. En producción los completa el bot. */
export interface WelcomeCardSample {
    displayName: string;
    username: string;
    serverName: string;
    memberCount: number;
    avatarUrl: string;
}

/* ---------- props de los componentes del editor ---------- */

export interface welcomeCanvasType {
    config: WelcomeCardConfig;
    sample: WelcomeCardSample;
    images: RenderImages;
    selection: SelectionTarget | null;
    onSelect: (target: SelectionTarget | null) => void;
    onMove: (target: SelectionTarget, x: number, y: number) => void;
    canvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

export interface welcomeInspectorType {
    config: WelcomeCardConfig;
    selection: SelectionTarget | null;
    onCanvasChange: (patch: Partial<WelcomeCanvas>) => void;
    onBackgroundChange: (patch: Partial<WelcomeBackground>) => void;
    onAvatarChange: (patch: Partial<WelcomeAvatar>) => void;
    onTextChange: (id: string, patch: Partial<WelcomeTextLayer>) => void;
    onTextDelete: (id: string) => void;
    /** Tipos de fondo que permite el plan del servidor. */
    allowedBackgrounds?: BackgroundType[];
}
