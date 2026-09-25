/**
 * Tipos compartidos por las dos tarjetas (bienvenida y cumpleaños).
 *
 * Las dos guardan lo mismo: una "receta" declarativa (lienzo, fondo, avatar y
 * capas de texto). El bot la lee y dibuja el PNG en el momento, ya con el avatar
 * y los datos reales. Lo específico de cada tarjeta —el sample, las variables,
 * las plantillas, los adornos de cumpleaños— vive en su propio archivo.
 */

export type BackgroundType = "color" | "gradient" | "image";
export type BackgroundFit = "cover" | "contain" | "stretch";
export type AvatarShape = "circle" | "rounded" | "square";
export type TextAlign = "left" | "center" | "right";

export interface CardCanvas {
    /** Medidas del lienzo en píxeles. Todas las coordenadas son relativas a esto. */
    width: number;
    height: number;
}

export interface CardBackground {
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

export interface CardAvatar {
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

export interface CardTextLayer {
    id: string;
    /** Nombre de la capa en el editor. No lo usa el bot. */
    label: string;
    /** Puede incluir variables; el juego de variables lo define cada tarjeta. */
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

/** Lo común a toda config de tarjeta. Cumpleaños le suma `decoration`. */
export interface BaseCardConfig {
    version: number;
    canvas: CardCanvas;
    background: CardBackground;
    avatar: CardAvatar;
    texts: CardTextLayer[];
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
