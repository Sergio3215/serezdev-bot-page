/**
 * Esquema de la tarjeta de bienvenida.
 *
 * Lo que se guarda en la base de datos NO es una imagen: es esta "receta"
 * declarativa. El bot la lee cuando entra un miembro y dibuja el PNG en ese
 * momento, ya con el avatar y el nombre reales.
 */

/** Subila cada vez que cambies la forma del JSON, para poder migrar lo guardado. */
export const WELCOME_CARD_VERSION = 1;

export type BackgroundType = "color" | "gradient" | "image";
export type BackgroundFit = "cover" | "contain" | "stretch";
export type AvatarShape = "circle" | "rounded" | "square";
export type TextAlign = "left" | "center" | "right";

export interface WelcomeCanvas {
    /** Medidas del lienzo en píxeles. Todas las coordenadas son relativas a esto. */
    width: number;
    height: number;
}

export interface WelcomeBackground {
    type: BackgroundType;
    /** type === "color" */
    color: string;
    /** type === "gradient" */
    gradient: { from: string; to: string; angle: number };
    /** type === "image" */
    imageUrl: string | null;
    fit: BackgroundFit;
    /** Desenfoque del fondo en px (0 = sin desenfoque). */
    blur: number;
    /** Capa de color por encima del fondo, para que el texto se lea. */
    overlayColor: string;
    overlayOpacity: number;
}

export interface WelcomeAvatar {
    enabled: boolean;
    /** Centro del avatar. */
    x: number;
    y: number;
    /** Diámetro / lado en px. */
    size: number;
    shape: AvatarShape;
    /** Radio de las esquinas cuando shape === "rounded". */
    radius: number;
    borderWidth: number;
    borderColor: string;
    shadowBlur: number;
    shadowColor: string;
}

export interface WelcomeTextLayer {
    id: string;
    /** Nombre de la capa en el editor. No lo usa el bot. */
    label: string;
    /** Puede incluir variables: {user}, {username}, {server}, {count}. */
    content: string;
    /** Punto de anclaje: x depende de `align`, y es siempre el centro vertical. */
    x: number;
    y: number;
    align: TextAlign;
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    italic: boolean;
    uppercase: boolean;
    color: string;
    opacity: number;
    letterSpacing: number;
    /** Multiplicador del alto de línea (1.2 = 120% del tamaño de fuente). */
    lineHeight: number;
    /** Si el texto es más ancho, se achica la fuente hasta entrar. null = sin límite. */
    maxWidth: number | null;
    strokeWidth: number;
    strokeColor: string;
    shadowBlur: number;
    shadowOffsetX: number;
    shadowOffsetY: number;
    shadowColor: string;
}

export interface WelcomeCardConfig {
    version: number;
    canvas: WelcomeCanvas;
    background: WelcomeBackground;
    avatar: WelcomeAvatar;
    texts: WelcomeTextLayer[];
}

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

export type SelectionTarget =
    | { kind: "avatar" }
    | { kind: "text"; id: string };

export interface HitBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface LayerHit {
    target: SelectionTarget;
    box: HitBox;
}

export interface RenderImages {
    background: CanvasImageSource | null;
    avatar: CanvasImageSource | null;
}

export interface RenderOptions {
    /** Dibuja el marco de selección. El bot nunca pasa esto. */
    selection?: SelectionTarget | null;
    guides?: { vertical: boolean; horizontal: boolean };
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
}
