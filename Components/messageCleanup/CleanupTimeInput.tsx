"use client"

import { CLEANUP_TIME_UNITS, timeInputStep } from "@/lib/messageCleanup";
import type { CleanupTimeUnit } from "@/types/MessageCleanup";

interface CleanupTimeInputProps {
    id: string;
    label: string;
    value: string;
    unit: CleanupTimeUnit;
    error?: string;
    onValueChange: (value: string) => void;
    onUnitChange: (unit: CleanupTimeUnit) => void;
}

/** `[ 0.5 ] [ Horas ▼ ]`: número + unidad. El `step` ayuda al navegador; la validación real está en lib/messageCleanup. */
export default function CleanupTimeInput({ id, label, value, unit, error, onValueChange, onUnitChange }: CleanupTimeInputProps) {
    const errorId = `${id}-error`;
    return (
        <div className="space-y-1.5">
            <label htmlFor={id} className="text-xs font-semibold text-zinc-300">{label} *</label>
            <div className="flex gap-2">
                <input
                    id={id}
                    type="number"
                    inputMode="decimal"
                    min={timeInputStep(unit)}
                    step={timeInputStep(unit)}
                    value={value}
                    onChange={(event) => onValueChange(event.target.value)}
                    placeholder={unit === "hours" ? "0.5" : "3"}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    className={`w-28 rounded-lg border bg-[#111214] px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-[#5865F2] focus:outline-none ${error ? "border-red-500/50" : "border-white/10"}`}
                />
                <select
                    aria-label="Unidad de tiempo"
                    value={unit}
                    onChange={(event) => onUnitChange(event.target.value as CleanupTimeUnit)}
                    className="rounded-lg border border-white/10 bg-[#111214] px-3 py-2 text-sm text-white focus:border-[#5865F2] focus:outline-none cursor-pointer"
                >
                    {CLEANUP_TIME_UNITS.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                </select>
            </div>
            {error && <p id={errorId} className="text-[11px] text-red-300">{error}</p>}
        </div>
    );
}
