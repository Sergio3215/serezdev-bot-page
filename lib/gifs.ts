const DEFAULT_GIF_BASE = "https://raw.githubusercontent.com/Sergio3215/bot-serezdev/main/static";

/** URL original de un GIF por defecto: la carpeta de la interacción en el repo del bot y su número de orden. */
export function defaultGifUrl(interactionName: string, order: number): string {
    return `${DEFAULT_GIF_BASE}/${interactionName}/${order}.gif`;
}
