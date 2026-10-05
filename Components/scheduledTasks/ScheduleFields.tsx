"use client"

import { useId, useMemo } from "react";
import MultiSelectChips from "@/Components/shared/MultiSelectChips";
import { SCHEDULE_TYPES, WEEKDAY_LABELS, WEEKDAY_ORDER, timezoneOptions, type DraftErrors } from "@/lib/scheduledTasks";
import type { ScheduledTaskDraft, ScheduleType } from "@/types/ScheduledTask";

const inputClass = "w-full rounded-lg border border-white/10 bg-[#111214] px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-[#5865F2] focus:outline-none";

const WEEKDAY_ITEMS = WEEKDAY_ORDER.map((day) => ({ id: String(day), label: WEEKDAY_LABELS[day] }));

function FieldError({ message }: { message?: string }) {
    return message ? <p className="text-[11px] text-red-300">{message}</p> : null;
}

interface ScheduleFieldsProps {
    draft: ScheduledTaskDraft;
    errors: DraftErrors;
    onChange: (patch: Partial<ScheduledTaskDraft>) => void;
}

/** Frecuencia, hora, días y zona horaria. Envía una recurrencia estructurada, nunca una expresión cron. */
export default function ScheduleFields({ draft, errors, onChange }: ScheduleFieldsProps) {
    const timezoneListId = useId();
    const timezones = useMemo(() => timezoneOptions(), []);

    const setScheduleType = (scheduleType: ScheduleType) =>
        onChange(scheduleType === "daily" ? { scheduleType, weekdays: [] } : { scheduleType });

    return (
        <div className="space-y-4">
            <fieldset className="space-y-2">
                <legend className="text-xs font-semibold text-zinc-300">Frecuencia *</legend>
                <div className="flex flex-wrap gap-2">
                    {SCHEDULE_TYPES.map((type) => (
                        <label
                            key={type.id}
                            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs ${draft.scheduleType === type.id
                                ? "border-[#5865F2] bg-[#5865F2]/15 text-white"
                                : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"}`}
                        >
                            <input
                                type="radio"
                                name="schedule-type"
                                checked={draft.scheduleType === type.id}
                                onChange={() => setScheduleType(type.id)}
                                className="accent-[#5865F2]"
                            />
                            {type.label}
                        </label>
                    ))}
                </div>
                <FieldError message={errors.scheduleType} />
            </fieldset>

            {draft.scheduleType === "weekly" && (
                <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-zinc-300">Días *</span>
                    <MultiSelectChips
                        items={WEEKDAY_ITEMS}
                        selectedIds={draft.weekdays.map(String)}
                        onChange={(ids) => onChange({ weekdays: ids.map(Number) })}
                        placeholder="+ Agregar día"
                        emptyLabel="Ningún día elegido"
                        keepItemOrder
                    />
                    <FieldError message={errors.weekdays} />
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-zinc-300">Hora *</span>
                    <input
                        type="time"
                        value={draft.time}
                        onChange={(event) => onChange({ time: event.target.value })}
                        className={inputClass}
                    />
                    <FieldError message={errors.time} />
                </label>
                <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-zinc-300">Zona horaria *</span>
                    <input
                        list={timezoneListId}
                        value={draft.timezone}
                        onChange={(event) => onChange({ timezone: event.target.value })}
                        placeholder="America/Argentina/Buenos_Aires"
                        className={inputClass}
                    />
                    <datalist id={timezoneListId}>
                        {timezones.map((timezone) => <option key={timezone} value={timezone} />)}
                    </datalist>
                    <FieldError message={errors.timezone} />
                </label>
            </div>
        </div>
    );
}
