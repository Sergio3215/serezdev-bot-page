"use client"

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
    RenderImages,
    SelectionTarget,
    WelcomeAvatar,
    WelcomeBackground,
    WelcomeCanvas,
    WelcomeCardConfig,
    WelcomeCardSample,
    WelcomeCardSetup,
    WelcomeTextLayer,
} from "@/types/WelcomeCard";
import {
    DEFAULT_SAMPLE,
    TEMPLATE_VARIABLES,
    WELCOME_TEMPLATES,
    createDefaultConfig,
    createTextLayer,
    fetchWelcomeCard,
    loadEditorImage,
    newLayerId,
    saveWelcomeCard,
} from "@/lib/welcomeCard";
import WelcomeCardCanvas from "./WelcomeCardCanvas";
import WelcomeCardInspector from "./WelcomeCardInspector";
import ChannelDropdown from "./ChannelDropdown";
import { DiscordChannel } from "@/types/DiscordTypes";
import { normalizeImageUrl } from "@/lib/imageUrl";
import DiscordRefreshButton from "./DiscordRefreshButton";

/** Lo que realmente se persiste, serializado, para saber si hay cambios sin guardar. */
function snapshot(setup: Omit<WelcomeCardSetup, "id" | "serverId">) {
    return JSON.stringify({
        enabled: setup.enabled,
        channelId: setup.channelId,
        messageContent: setup.messageContent,
        config: setup.config,
    });
}

export default function WelcomeCardEditor() {
    const params = useParams();
    const idServer = (params?.server as string) || "";

    const [config, setConfig] = useState<WelcomeCardConfig>(() => createDefaultConfig());
    const [sample, setSample] = useState<WelcomeCardSample>(DEFAULT_SAMPLE);
    const [selection, setSelection] = useState<SelectionTarget | null>(null);

    const [rowId, setRowId] = useState<string | null>(null);
    const [enabled, setEnabled] = useState<boolean>(true);
    const [channelId, setChannelId] = useState<string | null>(null);
    const [messageContent, setMessageContent] = useState<string>("¡Bienvenido {mention}! 🎉");

    // Guardamos la imagen junto a la URL que la produjo: así, mientras carga una
    // nueva, no se sigue dibujando la anterior.
    const [loadedBackground, setLoadedBackground] = useState<{ url: string; img: HTMLImageElement } | null>(null);
    const [loadedAvatar, setLoadedAvatar] = useState<{ url: string; img: HTMLImageElement } | null>(null);

    const [channels, setChannels] = useState<DiscordChannel[]>([]);
    const [loadingChannels, setLoadingChannels] = useState<boolean>(true);
    const [channelsError, setChannelsError] = useState<string | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [apiMissing, setApiMissing] = useState<boolean>(false);
    const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

    const savedRef = useRef<string>("");
    const [dirty, setDirty] = useState<boolean>(false);

    /* ---------------- carga inicial ---------------- */

    useEffect(() => {
        if (!idServer) return;

        const controller = new AbortController();

        fetchWelcomeCard(idServer, controller.signal).then((res) => {
            if (controller.signal.aborted) return;

            if (res.apiMissing) {
                setApiMissing(true);
                setFeedback({
                    type: "info",
                    text: "El endpoint del backend todavía no existe. Podés diseñar y exportar el JSON igual.",
                });
            } else if (res.error) {
                setFeedback({ type: "error", text: res.error });
            } else if (res.setup) {
                setRowId(res.setup.id ?? null);
                setEnabled(res.setup.enabled);
                setChannelId(res.setup.channelId);
                setMessageContent(res.setup.messageContent);
                setConfig(res.setup.config);
                savedRef.current = snapshot(res.setup);
            }

            // Si el servidor todavía no tiene diseño, la plantilla por defecto
            // cuenta como cambio: así se puede guardar sin tocar nada.
            if (!res.setup) setDirty(true);

            setIsLoading(false);
        });

        return () => controller.abort();
    }, [idServer]);

    /* ---------------- canales del servidor ---------------- */

    const loadChannels = useCallback(async (signal: AbortSignal) => {
        // Mantiene los cambios de estado fuera del cuerpo síncrono del effect inicial.
        await Promise.resolve();
        if (signal.aborted) return;

        setLoadingChannels(true);
        setChannelsError(null);

        try {
            const res = await fetch(`/api/guilds/${idServer}/channels`, {
                signal,
                cache: "no-store",
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(
                    res.status === 429
                        ? "Discord alcanzó el límite de solicitudes. Esperá unos segundos y volvé a actualizar."
                        : data.error || `No se pudieron cargar los canales (error ${res.status}).`
                );
            }

            if (!signal.aborted) setChannels(data.channels || []);
        } catch (err) {
            if (signal.aborted) return;
            console.error("Error al obtener los canales:", err);
            setChannelsError(
                err instanceof Error ? err.message : "No se pudieron cargar los canales del servidor."
            );
        } finally {
            if (!signal.aborted) setLoadingChannels(false);
        }
    }, [idServer]);

    useEffect(() => {
        if (!idServer) return;

        const controller = new AbortController();
        // Los setState de loadChannels ocurren después de un await, no durante el effect.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadChannels(controller.signal);

        return () => controller.abort();
    }, [idServer, loadChannels]);

    const refreshChannels = () => {
        const controller = new AbortController();
        void loadChannels(controller.signal);
    };

    /* ---------------- imágenes del lienzo ---------------- */

    const backgroundUrl = config.background.type === "image" ? config.background.imageUrl : null;

    useEffect(() => {
        if (!backgroundUrl) return;

        let cancelled = false;

        loadEditorImage(backgroundUrl)
            // `tainted` acá no importa: solo afectaba a la exportación desde el
            // navegador. El bot baja la imagen desde el servidor, sin CORS de por medio.
            .then(({ img }) => {
                if (!cancelled) setLoadedBackground({ url: backgroundUrl, img });
            })
            .catch(() => {
                if (cancelled) return;

                // Drive y OneDrive devuelven la pantalla de login cuando el archivo
                // no es público, así que el motivo casi siempre es el permiso.
                const { source } = normalizeImageUrl(backgroundUrl);

                setFeedback({
                    type: "error",
                    text:
                        source === "drive" || source === "onedrive"
                            ? "No se pudo cargar el fondo. Abrí el archivo en Drive/OneDrive y compartilo como \"Cualquier persona con el enlace\": si está restringido, devuelve la pantalla de inicio de sesión en vez de la imagen."
                            : "Esa URL no devolvió una imagen. Tiene que ser el enlace directo al archivo (jpg, png, webp, gif…), no la página que lo muestra.",
                });
            });

        return () => {
            cancelled = true;
        };
    }, [backgroundUrl]);

    useEffect(() => {
        const url = sample.avatarUrl;
        if (!url) return;

        let cancelled = false;

        loadEditorImage(url)
            .then(({ img }) => {
                if (!cancelled) setLoadedAvatar({ url, img });
            })
            .catch(() => {
                /* avatar roto: el lienzo dibuja el marcador de posición */
            });

        return () => {
            cancelled = true;
        };
    }, [sample.avatarUrl]);

    const images: RenderImages = {
        background: backgroundUrl && loadedBackground?.url === backgroundUrl ? loadedBackground.img : null,
        avatar: loadedAvatar?.url === sample.avatarUrl ? loadedAvatar.img : null,
    };

    /* ---------------- edición ---------------- */

    const markDirty = useCallback(() => {
        setDirty(true);
        setFeedback(null);
    }, []);

    const patchCanvas = (patch: Partial<WelcomeCanvas>) => {
        setConfig((prev) => ({ ...prev, canvas: { ...prev.canvas, ...patch } }));
        markDirty();
    };

    const patchBackground = (patch: Partial<WelcomeBackground>) => {
        setConfig((prev) => ({ ...prev, background: { ...prev.background, ...patch } }));
        markDirty();
    };

    const patchAvatar = (patch: Partial<WelcomeAvatar>) => {
        setConfig((prev) => ({ ...prev, avatar: { ...prev.avatar, ...patch } }));
        markDirty();
    };

    const patchText = (id: string, patch: Partial<WelcomeTextLayer>) => {
        setConfig((prev) => ({
            ...prev,
            texts: prev.texts.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }));
        markDirty();
    };

    const handleMove = (target: SelectionTarget, x: number, y: number) => {
        if (target.kind === "avatar") patchAvatar({ x, y });
        else patchText(target.id, { x, y });
    };

    const addText = () => {
        const layer = createTextLayer({
            label: `Texto ${config.texts.length + 1}`,
            x: Math.round(config.canvas.width / 2),
            y: Math.round(config.canvas.height / 2),
            maxWidth: config.canvas.width - 80,
        });
        setConfig((prev) => ({ ...prev, texts: [...prev.texts, layer] }));
        setSelection({ kind: "text", id: layer.id });
        markDirty();
    };

    const duplicateText = (id: string) => {
        const source = config.texts.find((t) => t.id === id);
        if (!source) return;

        const copy: WelcomeTextLayer = {
            ...source,
            id: newLayerId(),
            label: `${source.label} (copia)`,
            y: source.y + 40,
        };
        setConfig((prev) => ({ ...prev, texts: [...prev.texts, copy] }));
        setSelection({ kind: "text", id: copy.id });
        markDirty();
    };

    const deleteText = (id: string) => {
        setConfig((prev) => ({ ...prev, texts: prev.texts.filter((t) => t.id !== id) }));
        setSelection(null);
        markDirty();
    };

    /** Mueve una capa en el orden de dibujo: la última se dibuja al frente. */
    const reorderText = (id: string, direction: -1 | 1) => {
        setConfig((prev) => {
            const index = prev.texts.findIndex((t) => t.id === id);
            const target = index + direction;
            if (index === -1 || target < 0 || target >= prev.texts.length) return prev;

            const texts = [...prev.texts];
            [texts[index], texts[target]] = [texts[target], texts[index]];
            return { ...prev, texts };
        });
        markDirty();
    };

    const applyTemplate = (build: () => WelcomeCardConfig) => {
        setConfig(build());
        setSelection(null);
        markDirty();
    };

    /* ---------------- guardar / exportar ---------------- */

    const currentSetup = (): WelcomeCardSetup => ({
        id: rowId,
        serverId: idServer,
        enabled,
        channelId,
        messageContent,
        config,
    });

    const handleSave = async () => {
        if (!idServer) {
            setFeedback({ type: "error", text: "No se encontró el ID del servidor." });
            return;
        }

        // Sin canal el bot no tiene dónde publicar; solo importa si está activada.
        if (enabled && !channelId) {
            setFeedback({ type: "error", text: "Elegí el canal donde se publica la bienvenida." });
            return;
        }

        setIsSaving(true);
        setFeedback(null);

        const setup = currentSetup();
        const result = await saveWelcomeCard(setup);

        if (result.ok) {
            if (result.id) setRowId(result.id);
            savedRef.current = snapshot(setup);
            setDirty(false);
            setApiMissing(false);
            setFeedback({ type: "success", text: result.message });
        } else {
            setApiMissing(result.apiMissing);
            setFeedback({
                type: result.apiMissing ? "info" : "error",
                text: result.apiMissing
                    ? "Todavía no existe POST/PUT /api/v1/joinServer/setup-card en el backend. Usá \"Copiar JSON\" mientras tanto."
                    : result.message,
            });
        }

        setIsSaving(false);
    };

    const copyJson = async () => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(currentSetup(), null, 2));
            setFeedback({ type: "success", text: "JSON copiado al portapapeles." });
        } catch {
            setFeedback({ type: "error", text: "El navegador no dejó copiar al portapapeles." });
        }
    };

    const discard = () => {
        if (!savedRef.current) {
            setConfig(createDefaultConfig());
        } else {
            const saved = JSON.parse(savedRef.current);
            setConfig(saved.config);
            setEnabled(saved.enabled);
            setChannelId(saved.channelId);
            setMessageContent(saved.messageContent);
        }
        setSelection(null);
        setDirty(false);
        setFeedback(null);
    };

    /* ---------------- render ---------------- */

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center space-y-3 py-16 text-zinc-400">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#5865F2] border-t-transparent"></div>
                <p className="text-sm font-medium">Cargando el editor de bienvenida...</p>
            </div>
        );
    }

    return (
        <div className="my-6 space-y-4">
            {/* Barra superior */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#1e1f22] p-4 shadow-xl">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        aria-label="Activar la bienvenida"
                        onClick={() => {
                            setEnabled(!enabled);
                            markDirty();
                        }}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${enabled ? "bg-emerald-500" : "bg-zinc-600"
                            }`}
                    >
                        {/* left-0.5 explícito: sin él el knob nace centrado (los button
                            traen text-align: center) y se sale del riel al desplazarse. */}
                        <span
                            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : "translate-x-0"
                                }`}
                        />
                    </button>
                    <div>
                        <p className="text-sm font-semibold text-white">
                            {enabled ? "Bienvenida activada" : "Bienvenida desactivada"}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                            {enabled
                                ? "El bot va a publicar esta imagen cuando entre alguien."
                                : "El diseño se guarda, pero el bot no publica nada."}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={copyJson}
                        className="rounded-xl border border-white/10 bg-[#111214] px-3.5 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:border-white/25 hover:text-white cursor-pointer"
                    >
                        Copiar JSON
                    </button>
                    {dirty && (
                        <button
                            type="button"
                            onClick={discard}
                            disabled={isSaving}
                            className="px-3 py-2 text-xs font-semibold text-zinc-400 transition-colors hover:text-white disabled:opacity-50 cursor-pointer"
                        >
                            Descartar
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving || !dirty}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5865F2] px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#5865F2]/20 transition-all hover:bg-[#4752c4] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    >
                        {isSaving ? (
                            <>
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                                <span>Guardando...</span>
                            </>
                        ) : (
                            <span>{dirty ? "Guardar diseño" : "Sin cambios"}</span>
                        )}
                    </button>
                </div>
            </div>

            {feedback && (
                <div
                    className={`rounded-xl border p-3.5 text-sm ${feedback.type === "success"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                        : feedback.type === "info"
                            ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                            : "border-red-500/20 bg-red-500/10 text-red-400"
                        }`}
                >
                    {feedback.type === "success" ? "✅" : feedback.type === "info" ? "ℹ️" : "⚠️"} {feedback.text}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                {/* Columna izquierda: lienzo, capas, datos de prueba */}
                <div className="space-y-4">
                    <WelcomeCardCanvas
                        config={config}
                        sample={sample}
                        images={images}
                        selection={selection}
                        onSelect={setSelection}
                        onMove={handleMove}
                    />

                    {/* Plantillas */}
                    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-[#1e1f22] p-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Plantillas</span>
                        {WELCOME_TEMPLATES.map((tpl) => (
                            <button
                                key={tpl.name}
                                type="button"
                                onClick={() => applyTemplate(tpl.build)}
                                className="rounded-lg border border-white/10 bg-[#111214] px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition-colors hover:border-[#5865F2]/50 hover:text-white cursor-pointer"
                            >
                                {tpl.name}
                            </button>
                        ))}
                    </div>

                    {/* Capas */}
                    <div className="space-y-2 rounded-2xl border border-white/10 bg-[#1e1f22] p-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Capas</h3>
                            <button
                                type="button"
                                onClick={addText}
                                className="rounded-lg bg-[#5865F2] px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#4752c4] cursor-pointer"
                            >
                                + Texto
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => setSelection({ kind: "avatar" })}
                            className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer ${selection?.kind === "avatar"
                                ? "border-[#5865F2] bg-[#5865F2]/10"
                                : "border-white/10 bg-[#111214] hover:border-white/20"
                                }`}
                        >
                            <span className="text-sm">🖼️</span>
                            <span className="flex-1 truncate text-xs font-medium text-white">Avatar</span>
                            <span className="text-[10px] text-zinc-500">{config.avatar.enabled ? "visible" : "oculto"}</span>
                        </button>

                        {[...config.texts].reverse().map((layer) => {
                            const isSelected = selection?.kind === "text" && selection.id === layer.id;
                            return (
                                <div
                                    key={layer.id}
                                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 transition-colors ${isSelected ? "border-[#5865F2] bg-[#5865F2]/10" : "border-white/10 bg-[#111214]"
                                        }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setSelection({ kind: "text", id: layer.id })}
                                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left cursor-pointer"
                                    >
                                        <span className="text-sm">T</span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-xs font-medium text-white">{layer.label}</span>
                                            <span className="block truncate text-[10px] text-zinc-500">{layer.content}</span>
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        title="Subir en el orden de dibujo"
                                        onClick={() => reorderText(layer.id, 1)}
                                        className="px-1 text-[10px] text-zinc-500 hover:text-white cursor-pointer"
                                    >
                                        &#9650;
                                    </button>
                                    <button
                                        type="button"
                                        title="Bajar en el orden de dibujo"
                                        onClick={() => reorderText(layer.id, -1)}
                                        className="px-1 text-[10px] text-zinc-500 hover:text-white cursor-pointer"
                                    >
                                        &#9660;
                                    </button>
                                    <button
                                        type="button"
                                        title="Duplicar"
                                        onClick={() => duplicateText(layer.id)}
                                        className="px-1 text-[10px] text-zinc-500 hover:text-white cursor-pointer"
                                    >
                                        &#10697;
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Canal de destino y mensaje que acompaña a la imagen */}
                    <div className="space-y-2 rounded-2xl border border-white/10 bg-[#1e1f22] p-4">
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                            Canal de bienvenida <span className="text-red-400">*</span>
                        </h3>
                        <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                                <ChannelDropdown
                                    channels={channels}
                                    value={channelId}
                                    onChange={(id) => {
                                        setChannelId(id);
                                        markDirty();
                                    }}
                                    disabled={isSaving}
                                    loading={loadingChannels}
                                    error={channelsError}
                                />
                            </div>
                            <DiscordRefreshButton
                                resource="canales"
                                loading={loadingChannels}
                                disabled={isSaving || loadingChannels || !idServer}
                                onRefresh={refreshChannels}
                            />
                        </div>
                        {!loadingChannels && !channelsError && channels.length === 0 && (
                            <p className="text-[10px] leading-relaxed text-amber-400">
                                El bot no ve ningún canal de texto en este servidor.
                            </p>
                        )}
                        {channels.some((c) => !c.canSend) && (
                            <p className="text-[10px] leading-relaxed text-zinc-500">
                                Los canales en gris están deshabilitados: al bot le falta ver el canal, escribir
                                o adjuntar archivos.
                            </p>
                        )}

                        <h3 className="pt-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                            Mensaje del canal
                        </h3>
                        <textarea
                            value={messageContent}
                            onChange={(e) => {
                                setMessageContent(e.target.value);
                                markDirty();
                            }}
                            rows={2}
                            maxLength={500}
                            placeholder="¡Bienvenido {mention}!"
                            className="w-full resize-y rounded-xl border border-white/10 bg-[#111214] px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-[#5865F2] focus:outline-none"
                        />
                        <div className="flex flex-wrap gap-1.5">
                            {TEMPLATE_VARIABLES.map((v) => (
                                <span
                                    key={v.token}
                                    title={v.description}
                                    className="rounded-md border border-white/10 bg-[#111214] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400"
                                >
                                    {v.token}
                                </span>
                            ))}
                        </div>
                        <p className="text-[10px] leading-relaxed text-zinc-500">
                            Este texto acompaña a la imagen. Dejalo vacío si querés que el bot publique solo la imagen.
                        </p>
                    </div>

                    {/* Datos de prueba */}
                    <div className="space-y-3 rounded-2xl border border-white/10 bg-[#1e1f22] p-4">
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                            Datos de prueba <span className="font-normal normal-case">(no se guardan)</span>
                        </h3>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <input
                                type="text"
                                value={sample.displayName}
                                onChange={(e) => setSample({ ...sample, displayName: e.target.value })}
                                placeholder="Nombre visible"
                                className="rounded-lg border border-white/10 bg-[#111214] px-2.5 py-1.5 text-xs text-white focus:border-[#5865F2] focus:outline-none"
                            />
                            <input
                                type="text"
                                value={sample.username}
                                onChange={(e) => setSample({ ...sample, username: e.target.value })}
                                placeholder="Usuario"
                                className="rounded-lg border border-white/10 bg-[#111214] px-2.5 py-1.5 text-xs text-white focus:border-[#5865F2] focus:outline-none"
                            />
                            <input
                                type="text"
                                value={sample.serverName}
                                onChange={(e) => setSample({ ...sample, serverName: e.target.value })}
                                placeholder="Nombre del servidor"
                                className="rounded-lg border border-white/10 bg-[#111214] px-2.5 py-1.5 text-xs text-white focus:border-[#5865F2] focus:outline-none"
                            />
                            <input
                                type="number"
                                value={sample.memberCount}
                                onChange={(e) => setSample({ ...sample, memberCount: Number(e.target.value) })}
                                placeholder="Miembros"
                                className="rounded-lg border border-white/10 bg-[#111214] px-2.5 py-1.5 text-xs text-white focus:border-[#5865F2] focus:outline-none"
                            />
                            <input
                                type="url"
                                value={sample.avatarUrl}
                                onChange={(e) => setSample({ ...sample, avatarUrl: e.target.value })}
                                placeholder="URL del avatar de prueba"
                                className="sm:col-span-2 rounded-lg border border-white/10 bg-[#111214] px-2.5 py-1.5 text-xs text-white focus:border-[#5865F2] focus:outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Columna derecha: propiedades */}
                <div className="lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
                    <WelcomeCardInspector
                        config={config}
                        selection={selection}
                        onCanvasChange={patchCanvas}
                        onBackgroundChange={patchBackground}
                        onAvatarChange={patchAvatar}
                        onTextChange={patchText}
                        onTextDelete={deleteText}
                    />
                </div>
            </div>

            {apiMissing && (
                <div className="rounded-2xl border border-white/10 bg-[#111214] p-4 text-[11px] leading-relaxed text-zinc-400">
                    <p className="mb-1 font-semibold text-zinc-300">Falta el backend</p>
                    <p>
                        El editor ya arma el objeto completo. Cuando exista{" "}
                        <code className="font-mono text-[#5865F2]">/api/v1/joinServer/setup-card</code> (GET, POST y PUT),
                        el botón &quot;Guardar diseño&quot; funciona sin tocar nada más. La forma exacta de la tabla y
                        de cada endpoint está en <code className="font-mono text-zinc-300">docs/welcome-card.md</code>.
                    </p>
                </div>
            )}
        </div>
    );
}
