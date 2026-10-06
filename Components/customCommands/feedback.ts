export type Feedback = { type: "success" | "error"; text: string } | null;

export const APPLIED_NOTICE = "El bot aplica el cambio en unos segundos.";

export async function readJson(res: Response): Promise<{ message?: string; error?: string; data?: unknown }> {
    return res.json().catch(() => ({}));
}
