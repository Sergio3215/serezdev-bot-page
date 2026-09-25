/**
 * Fuentes de las tarjetas.
 *
 * Fuentes seguras: el bot tiene que tener registradas las mismas familias
 * (o un TTF equivalente) o la imagen no va a coincidir con la vista previa.
 */
export const FONT_OPTIONS = [
    { label: "Arial", value: "Arial, Helvetica, sans-serif" },
    { label: "Ubuntu", value: "Ubuntu, sans-serif" },
    { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
    { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
    { label: "Georgia", value: "Georgia, serif" },
    { label: "Times New Roman", value: "'Times New Roman', serif" },
    { label: "Courier New", value: "'Courier New', monospace" },
    { label: "Impact", value: "Impact, Charcoal, sans-serif" },
    { label: "Comic Sans MS", value: "'Comic Sans MS', cursive" },
];

/**
 * Espera a que las familias de FONT_OPTIONS estén cargadas en el navegador.
 *
 * El canvas dibuja con la fuente que haya en ese instante: si Ubuntu todavía no
 * bajó, el primer trazo sale con la de reserva y la vista previa miente. El editor
 * usa esta promesa para forzar un redibujado cuando terminan de cargar.
 *
 * En SSR (sin `document.fonts`) resuelve al toque, así que es seguro llamarla
 * siempre.
 */
export function loadCardFonts(): Promise<unknown> {
    if (typeof document === "undefined" || !document.fonts) return Promise.resolve();

    const cargas = FONT_OPTIONS.flatMap((opcion) => {
        const familia = opcion.value.split(",")[0].trim();
        return ["400", "700", "italic 400", "italic 700"].map((estilo) =>
            document.fonts.load(`${estilo} 40px ${familia}`).catch(() => null)
        );
    });

    return Promise.all(cargas);
}
