"use client"

import { useEffect, useRef, useState } from "react";
import { LayerHit, SelectionTarget, birthdayCanvasType } from "@/types/BirthdayCard";
import { drawBirthdayCard } from "@/lib/birthdayCard";
import { loadCardFonts } from "@/lib/card/fonts";

/** Distancia en px del lienzo a la que un elemento se pega al centro. */
const SNAP = 8;

function sameTarget(a: SelectionTarget | null, b: SelectionTarget | null) {
    if (!a || !b) return a === b;
    if (a.kind !== b.kind) return false;
    return a.kind !== "text" || (b.kind === "text" && a.id === b.id);
}

export default function BirthdayCardCanvas({
    config,
    sample,
    images,
    selection,
    onSelect,
    onMove,
    canvasRef: externalRef,
}: birthdayCanvasType) {
    const internalRef = useRef<HTMLCanvasElement>(null);
    const canvasRef = externalRef ?? internalRef;

    /** Cajas del último dibujo, para el hit-test del mouse. */
    const hitsRef = useRef<LayerHit[]>([]);
    const dragRef = useRef<{ target: SelectionTarget; offsetX: number; offsetY: number } | null>(null);

    const [guides, setGuides] = useState({ vertical: false, horizontal: false });

    // El canvas dibuja con la fuente que haya en ese instante: si Ubuntu todavía no
    // bajó, el primer trazo sale con la de reserva y la vista previa miente. Al
    // terminar de cargar, este flag fuerza un redibujado.
    const [fuentesListas, setFuentesListas] = useState(false);

    useEffect(() => {
        let cancelled = false;
        loadCardFonts().then(() => {
            if (!cancelled) setFuentesListas(true);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const { width, height } = config.canvas;

    // Redibuja ante cualquier cambio de config, datos de prueba, imágenes o selección.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = width * dpr;
        canvas.height = height * dpr;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        hitsRef.current = drawBirthdayCard(ctx, config, sample, images, { selection, guides });
    }, [config, sample, images, selection, guides, width, height, canvasRef, fuentesListas]);

    /** Coordenadas del puntero convertidas al sistema del lienzo. */
    const toCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        return {
            x: ((e.clientX - rect.left) / rect.width) * width,
            y: ((e.clientY - rect.top) / rect.height) * height,
        };
    };

    const anchorOf = (target: SelectionTarget) => {
        if (target.kind === "avatar") return { x: config.avatar.x, y: config.avatar.y };
        const layer = config.texts.find((t) => t.id === target.id);
        return layer ? { x: layer.x, y: layer.y } : null;
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const point = toCanvasPoint(e);

        // De arriba hacia abajo: el último dibujado es el que está más al frente.
        const hit = [...hitsRef.current].reverse().find((h) => {
            const pad = 8;
            return (
                point.x >= h.box.x - pad &&
                point.x <= h.box.x + h.box.width + pad &&
                point.y >= h.box.y - pad &&
                point.y <= h.box.y + h.box.height + pad
            );
        });

        if (!hit) {
            onSelect(null);
            return;
        }

        const anchor = anchorOf(hit.target);
        if (!anchor) return;

        dragRef.current = {
            target: hit.target,
            offsetX: point.x - anchor.x,
            offsetY: point.y - anchor.y,
        };

        onSelect(hit.target);
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const drag = dragRef.current;
        if (!drag) return;

        const point = toCanvasPoint(e);
        let x = Math.round(point.x - drag.offsetX);
        let y = Math.round(point.y - drag.offsetY);

        const onVertical = Math.abs(x - width / 2) <= SNAP;
        const onHorizontal = Math.abs(y - height / 2) <= SNAP;
        if (onVertical) x = width / 2;
        if (onHorizontal) y = height / 2;

        setGuides({ vertical: onVertical, horizontal: onHorizontal });
        onMove(drag.target, x, y);
    };

    const endDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!dragRef.current) return;
        dragRef.current = null;
        setGuides({ vertical: false, horizontal: false });
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
        if (!selection) return;

        if (e.key === "Escape") {
            onSelect(null);
            return;
        }

        const step = e.shiftKey ? 10 : 1;
        const delta: Record<string, [number, number]> = {
            ArrowUp: [0, -step],
            ArrowDown: [0, step],
            ArrowLeft: [-step, 0],
            ArrowRight: [step, 0],
        };

        const move = delta[e.key];
        if (!move) return;

        e.preventDefault();
        const anchor = anchorOf(selection);
        if (anchor) onMove(selection, anchor.x + move[0], anchor.y + move[1]);
    };

    const selectedLabel = selection
        ? selection.kind === "avatar"
            ? "Avatar"
            : config.texts.find((t) => sameTarget(selection, { kind: "text", id: t.id }))?.label || "Texto"
        : null;

    return (
        <div className="space-y-2">
            <div
                className="rounded-2xl border border-white/10 bg-[#111214] p-3 shadow-xl"
                style={{
                    backgroundImage:
                        "linear-gradient(45deg, #1a1b1e 25%, transparent 25%), linear-gradient(-45deg, #1a1b1e 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1b1e 75%), linear-gradient(-45deg, transparent 75%, #1a1b1e 75%)",
                    backgroundSize: "16px 16px",
                    backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
                }}
            >
                <canvas
                    ref={canvasRef}
                    tabIndex={0}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onKeyDown={handleKeyDown}
                    style={{ aspectRatio: `${width} / ${height}` }}
                    className="block w-full h-auto rounded-xl touch-none cursor-move focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
                />
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1">
                <span>
                    {selectedLabel
                        ? `Seleccionado: ${selectedLabel} · flechas para mover, Shift para 10 px`
                        : "Hacé clic en un elemento para moverlo"}
                </span>
                <span>
                    {width} × {height} px
                </span>
            </div>
        </div>
    );
}
