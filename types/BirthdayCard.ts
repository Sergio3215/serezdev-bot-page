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
 *    `channelId` y `message`), así que acá solo vive el diseño. La imagen viaja
 *    adjunta a ese mismo mensaje, que se sigue editando en su pestaña.
 * 2. **Tiene adornos.** Confeti, globos, estrellas o corazones dibujados por
 *    código, con semilla, para que la imagen sea festiva sin depender de que el
 *    admin consiga un fondo.
 *
 * Este archivo es independiente del de bienvenida a propósito: las dos tarjetas
 * se parecen hoy, pero cada una puede cambiar sin arrastrar a la otra.
 */

/** Subila cada vez que cambies la forma del JSON, para poder migrar lo guardado. */
export const BIRTHDAY_CARD_VERSION = 1;

export type BackgroundType = "color" | "gradient" | "image";
export type BackgroundFit = "cover" | "contain" | "stretch";
export type AvatarShape = "circle" | "rounded" | "square";
export type TextAlign = "left" | "center" | "right";
export type DecorationType = "none" | "confetti" | "balloons" | "stars" | "hearts";

export interface BirthdayCanvas {
    /** Medidas del lienzo en píxeles. Todas las coordenadas son relativas a esto. */
    width: number;
    height: number;
}

export interface BirthdayBackground {
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

export interface BirthdayAvatar {
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

export interface BirthdayTextLayer {
    id: string;
    /** Nombre de la capa en el editor. No lo usa el bot. */
    label: string;
    /** Puede incluir variables: $nombre, $usuario, $edad, $servidor, $fecha. */
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

export interface BirthdayCardConfig {
    version: number;
    canvas: BirthdayCanvas;
    background: BirthdayBackground;
    decoration: BirthdayDecoration;
    avatar: BirthdayAvatar;
    texts: BirthdayTextLayer[];
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
