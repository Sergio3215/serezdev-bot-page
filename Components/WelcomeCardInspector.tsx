"use client"

import { welcomeInspectorType } from "@/types/WelcomeCard";
import { CANVAS_PRESETS, FONT_OPTIONS, TEMPLATE_VARIABLES } from "@/lib/welcomeCard";

/* ---------- controles reutilizables ---------- */

function Group({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-3 border-b border-white/10 pb-4 last:border-b-0">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{title}</h3>
            {children}
        </div>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <label className="text-xs text-zinc-400 shrink-0">{label}</label>
            <div className="flex items-center gap-2">{children}</div>
        </div>
    );
}

function Slider({
    label,
    value,
    min,
    max,
    step = 1,
    suffix = "",
    onChange,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    suffix?: string;
    onChange: (value: number) => void;
}) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <label className="text-xs text-zinc-400">{label}</label>
                <span className="text-[11px] font-mono text-zinc-300 tabular-nums">
                    {value}
                    {suffix}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full accent-[#5865F2] cursor-pointer"
            />
        </div>
    );
}

function ColorInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    return (
        <div className="flex items-center gap-1.5">
            <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="h-7 w-9 cursor-pointer rounded border border-white/15 bg-transparent p-0.5"
            />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-20 rounded-lg border border-white/10 bg-[#111214] px-2 py-1 text-[11px] font-mono text-white focus:border-[#5865F2] focus:outline-none"
            />
        </div>
    );
}

function Segmented<T extends string>({
    value,
    options,
    onChange,
}: {
    value: T;
    options: { label: string; value: T }[];
    onChange: (value: T) => void;
}) {
    return (
        <div className="flex rounded-lg border border-white/10 bg-[#111214] p-0.5">
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(opt.value)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                        value === opt.value ? "bg-[#5865F2] text-white" : "text-zinc-400 hover:text-white"
                    }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors cursor-pointer ${
                checked ? "bg-[#5865F2]" : "bg-zinc-600"
            }`}
        >
            {/* left-0.5 explícito: sin él el knob nace centrado y se sale del riel. */}
            <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    checked ? "translate-x-4" : "translate-x-0"
                }`}
            />
        </button>
    );
}

const selectClass =
    "rounded-lg border border-white/10 bg-[#111214] px-2 py-1.5 text-xs text-white focus:border-[#5865F2] focus:outline-none cursor-pointer";

/* ---------- panel ---------- */

export default function WelcomeCardInspector({
    config,
    selection,
    onCanvasChange,
    onBackgroundChange,
    onAvatarChange,
    onTextChange,
    onTextDelete,
}: welcomeInspectorType) {
    const bg = config.background;
    const layer = selection?.kind === "text" ? config.texts.find((t) => t.id === selection.id) : undefined;

    return (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-[#1e1f22] p-4 shadow-xl">
            {/* ---- Lienzo ---- */}
            <Group title="Lienzo">
                <select
                    value={`${config.canvas.width}x${config.canvas.height}`}
                    onChange={(e) => {
                        const [width, height] = e.target.value.split("x").map(Number);
                        onCanvasChange({ width, height });
                    }}
                    className={`w-full ${selectClass}`}
                >
                    {CANVAS_PRESETS.map((preset) => (
                        <option key={preset.label} value={`${preset.width}x${preset.height}`}>
                            {preset.label}
                        </option>
                    ))}
                    {!CANVAS_PRESETS.some((p) => p.width === config.canvas.width && p.height === config.canvas.height) && (
                        <option value={`${config.canvas.width}x${config.canvas.height}`}>
                            Personalizado {config.canvas.width} × {config.canvas.height}
                        </option>
                    )}
                </select>
            </Group>

            {/* ---- Fondo ---- */}
            <Group title="Fondo">
                <Segmented
                    value={bg.type}
                    onChange={(type) => onBackgroundChange({ type })}
                    options={[
                        { label: "Color", value: "color" },
                        { label: "Degradado", value: "gradient" },
                        { label: "Imagen", value: "image" },
                    ]}
                />

                {bg.type === "color" && (
                    <Row label="Color">
                        <ColorInput value={bg.color} onChange={(color) => onBackgroundChange({ color })} />
                    </Row>
                )}

                {bg.type === "gradient" && (
                    <>
                        <Row label="Desde">
                            <ColorInput
                                value={bg.gradient.from}
                                onChange={(from) => onBackgroundChange({ gradient: { ...bg.gradient, from } })}
                            />
                        </Row>
                        <Row label="Hasta">
                            <ColorInput
                                value={bg.gradient.to}
                                onChange={(to) => onBackgroundChange({ gradient: { ...bg.gradient, to } })}
                            />
                        </Row>
                        <Slider
                            label="Ángulo"
                            value={bg.gradient.angle}
                            min={0}
                            max={360}
                            suffix="°"
                            onChange={(angle) => onBackgroundChange({ gradient: { ...bg.gradient, angle } })}
                        />
                    </>
                )}

                {bg.type === "image" && (
                    <>
                        <input
                            type="url"
                            value={bg.imageUrl || ""}
                            onChange={(e) => onBackgroundChange({ imageUrl: e.target.value || null })}
                            placeholder="https://.../fondo.png"
                            className="w-full rounded-lg border border-white/10 bg-[#111214] px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:border-[#5865F2] focus:outline-none"
                        />
                        <p className="text-[10px] leading-relaxed text-zinc-500">
                            Enlace directo al archivo, en cualquier formato (jpg, png, webp, gif). Tiene que ser
                            público: el bot lo descarga cada vez que genera la imagen.
                        </p>
                        <Row label="Ajuste">
                            <Segmented
                                value={bg.fit}
                                onChange={(fit) => onBackgroundChange({ fit })}
                                options={[
                                    { label: "Cubrir", value: "cover" },
                                    { label: "Contener", value: "contain" },
                                    { label: "Estirar", value: "stretch" },
                                ]}
                            />
                        </Row>
                        <Slider
                            label="Desenfoque"
                            value={bg.blur}
                            min={0}
                            max={20}
                            suffix="px"
                            onChange={(blur) => onBackgroundChange({ blur })}
                        />
                    </>
                )}

                <Row label="Capa de color">
                    <ColorInput value={bg.overlayColor} onChange={(overlayColor) => onBackgroundChange({ overlayColor })} />
                </Row>
                <Slider
                    label="Opacidad de la capa"
                    value={Math.round(bg.overlayOpacity * 100)}
                    min={0}
                    max={100}
                    suffix="%"
                    onChange={(v) => onBackgroundChange({ overlayOpacity: v / 100 })}
                />
            </Group>

            {/* ---- Avatar ---- */}
            {selection?.kind === "avatar" && (
                <Group title="Avatar">
                    <Row label="Mostrar">
                        <Toggle checked={config.avatar.enabled} onChange={(enabled) => onAvatarChange({ enabled })} />
                    </Row>
                    <Row label="Forma">
                        <Segmented
                            value={config.avatar.shape}
                            onChange={(shape) => onAvatarChange({ shape })}
                            options={[
                                { label: "Círculo", value: "circle" },
                                { label: "Redondeado", value: "rounded" },
                                { label: "Cuadrado", value: "square" },
                            ]}
                        />
                    </Row>
                    {config.avatar.shape === "rounded" && (
                        <Slider
                            label="Radio"
                            value={config.avatar.radius}
                            min={0}
                            max={Math.round(config.avatar.size / 2)}
                            suffix="px"
                            onChange={(radius) => onAvatarChange({ radius })}
                        />
                    )}
                    <Slider
                        label="Tamaño"
                        value={config.avatar.size}
                        min={48}
                        max={Math.min(config.canvas.width, config.canvas.height)}
                        suffix="px"
                        onChange={(size) => onAvatarChange({ size })}
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <Slider label="X" value={config.avatar.x} min={0} max={config.canvas.width} onChange={(x) => onAvatarChange({ x })} />
                        <Slider label="Y" value={config.avatar.y} min={0} max={config.canvas.height} onChange={(y) => onAvatarChange({ y })} />
                    </div>
                    <Slider
                        label="Borde"
                        value={config.avatar.borderWidth}
                        min={0}
                        max={30}
                        suffix="px"
                        onChange={(borderWidth) => onAvatarChange({ borderWidth })}
                    />
                    <Row label="Color del borde">
                        <ColorInput value={config.avatar.borderColor} onChange={(borderColor) => onAvatarChange({ borderColor })} />
                    </Row>
                    <Slider
                        label="Sombra"
                        value={config.avatar.shadowBlur}
                        min={0}
                        max={80}
                        suffix="px"
                        onChange={(shadowBlur) => onAvatarChange({ shadowBlur })}
                    />
                    <Row label="Color de sombra">
                        <ColorInput value={config.avatar.shadowColor} onChange={(shadowColor) => onAvatarChange({ shadowColor })} />
                    </Row>
                </Group>
            )}

            {/* ---- Texto ---- */}
            {layer && (
                <Group title={`Texto · ${layer.label}`}>
                    <input
                        type="text"
                        value={layer.label}
                        onChange={(e) => onTextChange(layer.id, { label: e.target.value })}
                        placeholder="Nombre de la capa"
                        className="w-full rounded-lg border border-white/10 bg-[#111214] px-2.5 py-1.5 text-[11px] text-zinc-400 focus:border-[#5865F2] focus:outline-none"
                    />

                    <textarea
                        value={layer.content}
                        onChange={(e) => onTextChange(layer.id, { content: e.target.value })}
                        rows={2}
                        maxLength={200}
                        className="w-full resize-y rounded-lg border border-white/10 bg-[#111214] px-2.5 py-2 text-sm text-white focus:border-[#5865F2] focus:outline-none"
                    />

                    <div className="flex flex-wrap gap-1">
                        {TEMPLATE_VARIABLES.filter((v) => v.token !== "{mention}").map((v) => (
                            <button
                                key={v.token}
                                type="button"
                                title={v.description}
                                onClick={() => onTextChange(layer.id, { content: `${layer.content}${v.token}` })}
                                className="rounded-md border border-white/10 bg-[#111214] px-1.5 py-0.5 font-mono text-[10px] text-[#5865F2] hover:border-[#5865F2]/50 cursor-pointer"
                            >
                                {v.token}
                            </button>
                        ))}
                    </div>

                    <select
                        value={layer.fontFamily}
                        onChange={(e) => onTextChange(layer.id, { fontFamily: e.target.value })}
                        className={`w-full ${selectClass}`}
                    >
                        {FONT_OPTIONS.map((font) => (
                            <option key={font.value} value={font.value}>
                                {font.label}
                            </option>
                        ))}
                    </select>

                    <Row label="Alineación">
                        <Segmented
                            value={layer.align}
                            onChange={(align) => onTextChange(layer.id, { align })}
                            options={[
                                { label: "Izq.", value: "left" },
                                { label: "Centro", value: "center" },
                                { label: "Der.", value: "right" },
                            ]}
                        />
                    </Row>

                    <Row label="Grosor">
                        <select
                            value={layer.fontWeight}
                            onChange={(e) => onTextChange(layer.id, { fontWeight: Number(e.target.value) })}
                            className={selectClass}
                        >
                            {[300, 400, 500, 600, 700, 800, 900].map((w) => (
                                <option key={w} value={w}>
                                    {w}
                                </option>
                            ))}
                        </select>
                    </Row>

                    <Row label="Estilo">
                        <div className="flex gap-1.5">
                            <button
                                type="button"
                                onClick={() => onTextChange(layer.id, { italic: !layer.italic })}
                                className={`h-7 w-7 rounded-lg border text-xs italic cursor-pointer ${
                                    layer.italic
                                        ? "border-[#5865F2] bg-[#5865F2]/20 text-white"
                                        : "border-white/10 bg-[#111214] text-zinc-400"
                                }`}
                            >
                                I
                            </button>
                            <button
                                type="button"
                                title="MAYÚSCULAS"
                                onClick={() => onTextChange(layer.id, { uppercase: !layer.uppercase })}
                                className={`h-7 w-7 rounded-lg border text-[10px] font-bold cursor-pointer ${
                                    layer.uppercase
                                        ? "border-[#5865F2] bg-[#5865F2]/20 text-white"
                                        : "border-white/10 bg-[#111214] text-zinc-400"
                                }`}
                            >
                                AA
                            </button>
                        </div>
                    </Row>

                    <Slider
                        label="Tamaño"
                        value={layer.fontSize}
                        min={8}
                        max={160}
                        suffix="px"
                        onChange={(fontSize) => onTextChange(layer.id, { fontSize })}
                    />

                    <Row label="Color">
                        <ColorInput value={layer.color} onChange={(color) => onTextChange(layer.id, { color })} />
                    </Row>

                    <div className="grid grid-cols-2 gap-2">
                        <Slider label="X" value={layer.x} min={0} max={config.canvas.width} onChange={(x) => onTextChange(layer.id, { x })} />
                        <Slider label="Y" value={layer.y} min={0} max={config.canvas.height} onChange={(y) => onTextChange(layer.id, { y })} />
                    </div>

                    <Slider
                        label="Espaciado"
                        value={layer.letterSpacing}
                        min={-10}
                        max={30}
                        suffix="px"
                        onChange={(letterSpacing) => onTextChange(layer.id, { letterSpacing })}
                    />
                    <Slider
                        label="Alto de línea"
                        value={layer.lineHeight}
                        min={0.8}
                        max={2.5}
                        step={0.1}
                        onChange={(lineHeight) => onTextChange(layer.id, { lineHeight })}
                    />
                    <Slider
                        label="Opacidad"
                        value={Math.round(layer.opacity * 100)}
                        min={0}
                        max={100}
                        suffix="%"
                        onChange={(v) => onTextChange(layer.id, { opacity: v / 100 })}
                    />

                    <Row label="Ancho máximo">
                        <div className="flex items-center gap-2">
                            <Toggle
                                checked={layer.maxWidth !== null}
                                onChange={(on) => onTextChange(layer.id, { maxWidth: on ? config.canvas.width - 80 : null })}
                            />
                            {layer.maxWidth !== null && (
                                <input
                                    type="number"
                                    value={layer.maxWidth}
                                    min={20}
                                    max={config.canvas.width}
                                    onChange={(e) => onTextChange(layer.id, { maxWidth: Number(e.target.value) })}
                                    className="w-16 rounded-lg border border-white/10 bg-[#111214] px-2 py-1 text-[11px] text-white focus:border-[#5865F2] focus:outline-none"
                                />
                            )}
                        </div>
                    </Row>

                    <Slider
                        label="Contorno"
                        value={layer.strokeWidth}
                        min={0}
                        max={12}
                        suffix="px"
                        onChange={(strokeWidth) => onTextChange(layer.id, { strokeWidth })}
                    />
                    {layer.strokeWidth > 0 && (
                        <Row label="Color del contorno">
                            <ColorInput value={layer.strokeColor} onChange={(strokeColor) => onTextChange(layer.id, { strokeColor })} />
                        </Row>
                    )}

                    <Slider
                        label="Sombra"
                        value={layer.shadowBlur}
                        min={0}
                        max={60}
                        suffix="px"
                        onChange={(shadowBlur) => onTextChange(layer.id, { shadowBlur })}
                    />
                    {layer.shadowBlur > 0 && (
                        <>
                            <div className="grid grid-cols-2 gap-2">
                                <Slider
                                    label="Desp. X"
                                    value={layer.shadowOffsetX}
                                    min={-30}
                                    max={30}
                                    onChange={(shadowOffsetX) => onTextChange(layer.id, { shadowOffsetX })}
                                />
                                <Slider
                                    label="Desp. Y"
                                    value={layer.shadowOffsetY}
                                    min={-30}
                                    max={30}
                                    onChange={(shadowOffsetY) => onTextChange(layer.id, { shadowOffsetY })}
                                />
                            </div>
                            <Row label="Color de sombra">
                                <ColorInput value={layer.shadowColor} onChange={(shadowColor) => onTextChange(layer.id, { shadowColor })} />
                            </Row>
                        </>
                    )}

                    <button
                        type="button"
                        onClick={() => onTextDelete(layer.id)}
                        className="w-full rounded-lg border border-red-500/20 bg-red-500/10 py-2 text-[11px] font-semibold text-red-400 transition-colors hover:bg-red-500/20 cursor-pointer"
                    >
                        Eliminar esta capa
                    </button>
                </Group>
            )}

            {!selection && (
                <p className="py-4 text-center text-xs leading-relaxed text-zinc-500">
                    Elegí un elemento en el lienzo o en la lista de capas para editar sus propiedades.
                </p>
            )}
        </div>
    );
}
