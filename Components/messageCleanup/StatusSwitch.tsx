"use client"

interface StatusSwitchProps {
    checked: boolean;
    label: string;
    disabled?: boolean;
    onChange: () => void;
}

/** Mismo switch que usan las tareas programadas. */
export default function StatusSwitch({ checked, label, disabled = false, onChange }: StatusSwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            title={checked ? "Activo" : "Inactivo"}
            disabled={disabled}
            onClick={onChange}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-60 ${checked ? "bg-[#23a55a]" : "bg-[#4e5058]"}`}
        >
            <span
                aria-hidden="true"
                className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[23px]" : "translate-x-[3px]"}`}
            />
        </button>
    );
}
