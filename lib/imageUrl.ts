/**
 * Convierte links "para compartir" en la URL directa al archivo.
 *
 * Google Drive y OneDrive devuelven una página HTML cuando les pedís el link que
 * copia el botón Compartir. Ni el navegador ni el bot pueden dibujar eso: los dos
 * esperan los bytes de la imagen. Cada servicio tiene un endpoint que sí los
 * entrega, y acá se arma.
 *
 * Esto NO reemplaza el permiso: el archivo tiene que estar en "Cualquier persona
 * con el enlace". Si está restringido, la URL convertida devuelve la pantalla de
 * inicio de sesión igual.
 */

export type ImageUrlSource = "drive" | "onedrive" | "discord" | "plain";

export interface NormalizedImageUrl {
    /** La URL que hay que guardar y usar. */
    url: string;
    source: ImageUrlSource;
    /** true si hubo que reescribirla. */
    changed: boolean;
}

/** IDs de Drive: letras, números, guiones y guiones bajos. */
const DRIVE_ID = "[A-Za-z0-9_-]{10,}";

const DRIVE_PATRONES = [
    new RegExp(`drive\\.google\\.com/file/d/(${DRIVE_ID})`),
    new RegExp(`(?:drive|docs)\\.google\\.com/(?:uc|open)\\?[^\\s]*id=(${DRIVE_ID})`),
    new RegExp(`drive\\.google\\.com/thumbnail\\?[^\\s]*id=(${DRIVE_ID})`),
];

/** base64url sin relleno, que es lo que pide la API de shares de OneDrive. */
function base64Url(value: string): string | null {
    try {
        const base64 =
            typeof btoa === "function"
                ? btoa(value)
                : Buffer.from(value, "utf8").toString("base64");

        return base64.replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
    } catch {
        // btoa explota con caracteres fuera de latin1.
        return null;
    }
}

export function normalizeImageUrl(input: string): NormalizedImageUrl {
    const url = (input || "").trim();

    if (!url) return { url, source: "plain", changed: false };

    // Ya convertidas: no tocar.
    if (/lh3\.googleusercontent\.com\/d\//.test(url) || /api\.onedrive\.com\/v1\.0\/shares\//.test(url)) {
        return { url, source: url.includes("onedrive") ? "onedrive" : "drive", changed: false };
    }

    // Los adjuntos de Discord llevan firma con vencimiento: sirven hoy y no mañana.
    if (/cdn\.discordapp\.com\/attachments\//.test(url)) {
        return { url, source: "discord", changed: false };
    }

    for (const patron of DRIVE_PATRONES) {
        const match = url.match(patron);
        if (match) {
            return {
                url: `https://lh3.googleusercontent.com/d/${match[1]}`,
                source: "drive",
                changed: true,
            };
        }
    }

    if (/(?:1drv\.ms|onedrive\.live\.com|\.sharepoint\.com)\//.test(url)) {
        const codificada = base64Url(url);
        if (codificada) {
            return {
                url: `https://api.onedrive.com/v1.0/shares/u!${codificada}/root/content`,
                source: "onedrive",
                changed: true,
            };
        }
        return { url, source: "onedrive", changed: false };
    }

    return { url, source: "plain", changed: false };
}

/** Aviso a mostrar junto al campo, según de dónde venga la URL. */
export function avisoParaFuente(source: ImageUrlSource): string | null {
    switch (source) {
        case "drive":
            return "Link de Google Drive convertido. El archivo tiene que estar compartido como \"Cualquier persona con el enlace\" o no se va a ver.";
        case "onedrive":
            return "Link de OneDrive convertido. El archivo tiene que estar compartido con \"Cualquier persona con el vínculo\" o no se va a ver.";
        case "discord":
            return "Los enlaces de archivos subidos a Discord vencen a las pocas horas. Usá otro host o la imagen va a desaparecer sola.";
        default:
            return null;
    }
}
