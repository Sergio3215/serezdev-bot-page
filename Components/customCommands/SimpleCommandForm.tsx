"use client"

import ChannelDropdown from "@/Components/ui/ChannelDropdown";
import MemberSearch from "@/Components/ui/MemberSearch";
import RoleDropdown from "@/Components/ui/RoleDropdown";
import { contextSources, languageService, queryResolver, simpleShape, sourceOf, type Diagnostic, type Program, type SimpleAction, type SimpleValue } from "@/lib/custom-command-language";
import type { ObjectType, PropertyDefinition, Type } from "@/lib/custom-command-language/contract/model";
import type { DiscordChannel, DiscordRole } from "@/types/DiscordTypes";

const FUNCTION_LABELS: Record<string, string> = {
    SendMessage: "Enviar un mensaje",
    ReplyMessage: "Responder al mensaje",
    SendEmbed: "Enviar una tarjeta",
    ReplyEmbed: "Responder con una tarjeta",
    AddRole: "Agregar un rol",
};

const FUNCTION_DESCRIPTIONS: Record<string, string> = {
    SendMessage: "Publica un mensaje de texto en el canal que elijas, o en el mismo canal donde se escribió el comando.",
    ReplyMessage: "Responde con texto al mensaje que escribió el comando.",
    SendEmbed: "Publica una tarjeta con título, descripción, color o imagen en el canal que elijas.",
    ReplyEmbed: "Responde al mensaje del comando con una tarjeta con título, descripción, color o imagen.",
    AddRole: "Le da un rol a un miembro del servidor. El rol tiene que estar por debajo del rol del bot.",
};

/** Origen de un miembro tomado del mensaje que activa el comando. */
const SOURCE_LABELS: Record<string, string> = {
    GetAuthor: "Quien escribe el comando",
    GetMentionedMember: "Solo una mención",
    GetMentionedMembers: "Varias menciones",
};

const FIXED_MEMBER = "fixed";

/** Grupos opcionales que no se muestran hasta que el usuario los agrega. */
const ADD_LABELS: Record<string, string> = {
    author: "Agregar autor",
    footer: "Agregar pie de tarjeta",
};

const PROPERTY_LABELS: Record<string, string> = {
    channel: "Canal",
    message: "Mensaje",
    title: "Título",
    description: "Descripción",
    color: "Color",
    url: "Enlace del título",
    image: "Imagen (enlace)",
    author: "Autor",
    footer: "Pie de tarjeta",
    name: "Nombre",
    icon: "Ícono (enlace)",
    text: "Texto",
    member: "Miembro",
    role: "Rol",
};

const contract = languageService.contract;

/**
 * El modo simple solo representa los orígenes de miembro que ofrece en pantalla. Un comando que
 * use otro (p. ej. recorrer `GetMembers()`) se abre en modo avanzado.
 */
export function canShowInSimpleMode(actions: SimpleAction[]): boolean {
    return actions.every((action) => Object.values(action.values).every((value) => {
        const source = sourceOf(value);
        return source === null || source in SOURCE_LABELS;
    }));
}

/** Funciones que el modo simple puede generar: mensajes y tarjetas con su configuración, y acciones con parámetros elegibles. */
export const SIMPLE_FUNCTIONS = [...contract.functionByName.values()].filter((definition) => simpleShape(contract, definition) !== null);

function configType(functionName: string): ObjectType | null {
    const type = contract.functionByName.get(functionName)?.parameters[0]?.type;
    return type?.kind === "object" ? type : null;
}

/** Campos que muestra una acción: las propiedades de su configuración, o sus parámetros. */
function actionFields(functionName: string): ObjectType | null {
    const definition = contract.functionByName.get(functionName);
    const shape = definition ? simpleShape(contract, definition) : null;
    if (!definition || !shape) return null;
    if (shape.kind === "config") return shape.type;
    return {
        kind: "object",
        name: definition.name,
        readOnly: false,
        additionalProperties: false,
        properties: new Map(shape.parameters.map((parameter) => [
            parameter.name,
            { name: parameter.name, type: parameter.type, required: parameter.required, readOnly: false },
        ])),
        requiresAny: [],
        aggregateConstraints: [],
    };
}

/** Recurso dinámico (channels, roles) que genera el tipo de referencia indicado. */
function resourceFor(typeName: string): string | null {
    for (const resource of contract.dynamicResources.values()) {
        if (contract.functionByName.get(resource.functionName)?.returns.name === typeName) return resource.name;
    }
    return null;
}

const labelOf = (name: string): string => FUNCTION_LABELS[name] ?? PROPERTY_LABELS[name] ?? name;

function joinWithOr(items: string[]): string {
    return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} o ${items[items.length - 1]}`;
}

/** Redacta un diagnóstico con los nombres que ve el usuario del modo simple, sin funciones ni tipos del lenguaje. */
export function simpleDiagnosticMessage(diagnostic: Diagnostic, program: Program, actions: SimpleAction[]): string {
    const offset = diagnostic.loc.start.offset;
    const statementIndex = program.body.findIndex((statement) => statement.loc.start.offset <= offset && offset <= statement.loc.end.offset);
    const index = program.body
        .slice(0, statementIndex + 1)
        .filter((statement, i, all) => statement.type === "ExpressionStatement" || statement.type === "ForOfStatement"
            || (statement.type === "VariableDeclaration" && all[i - 1]?.type !== "VariableDeclaration"))
        .length - 1;
    const functionName = actions[index]?.functionName ?? null;
    const target = String(diagnostic.params.target ?? "");
    const name = String(diagnostic.params.name ?? "");

    let text: string;
    switch (diagnostic.code) {
        case "EMPTY_EMBED": {
            const fields = (configType(target)?.requiresAny ?? []).map((field) => labelOf(field).toLowerCase());
            text = `La tarjeta necesita contenido: completá ${joinWithOr(fields)}.`;
            break;
        }
        case "MISSING_CONFIG_PROPERTY":
            text = target in PROPERTY_LABELS
                ? `Completá "${labelOf(name)}" en ${labelOf(target).toLowerCase()}.`
                : `Completá "${labelOf(name)}".`;
            break;
        case "STRING_TOO_LONG":
            text = `"${labelOf(target)}" supera los ${diagnostic.params.maximum} caracteres.`;
            break;
        case "STRING_TOO_SHORT":
            text = `"${labelOf(target)}" no puede quedar vacío.`;
            break;
        case "INVALID_COLOR":
            text = `"${labelOf(target)}" tiene que ser un color con el formato #RRGGBB.`;
            break;
        case "INVALID_URL":
            text = `"${labelOf(target)}" tiene que ser un enlace que empiece con http:// o https://.`;
            break;
        case "INVALID_SNOWFLAKE":
            text = target === "userId" ? "Elegí un miembro." : target === "roleId" ? "Elegí un rol." : "Elegí un canal de la lista.";
            break;
        case "EMBED_TOO_LONG":
            text = `El texto de la tarjeta supera el máximo de ${diagnostic.params.maximum ?? 6000} caracteres.`;
            break;
        default:
            text = diagnostic.message;
    }
    if (actions.length <= 1 || index < 0) return text;
    return `Acción ${index + 1}${functionName ? ` (${labelOf(functionName)})` : ""}: ${text}`;
}

/** Elige de dónde sale el miembro: del mensaje (autor, menciones) o uno específico del servidor. */
function MemberField({ type, value, onChange }: { type: Type; value: SimpleValue; onChange: (value: SimpleValue) => void }) {
    const sources = contextSources(contract, type).filter(({ definition }) => definition.name in SOURCE_LABELS);
    const canPickFixed = queryResolver(contract, type) !== null;
    const source = sourceOf(value);
    const current = source ?? (typeof value === "string" ? FIXED_MEMBER : null);
    const options = [
        ...sources.map(({ definition }) => ({ id: definition.name, label: SOURCE_LABELS[definition.name] })),
        ...(canPickFixed ? [{ id: FIXED_MEMBER, label: "Un miembro específico" }] : []),
    ];
    const requiresMention = sources.some(({ definition }) => definition.name === source && definition.requires.includes("mention"));

    return (
        <div className="space-y-2">
            <div role="radiogroup" className="flex flex-wrap gap-2">
                {options.map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={current === option.id}
                        onClick={() => onChange(option.id === FIXED_MEMBER ? "" : { source: option.id })}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold cursor-pointer ${current === option.id
                            ? "border-[#5865F2] bg-[#5865F2]/20 text-white"
                            : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"}`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
            {current === FIXED_MEMBER && (
                <MemberSearch value={typeof value === "string" && value ? value : null} onChange={(memberId) => onChange(memberId)} />
            )}
            {requiresMention && (
                <div className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
                    <p>El comando va a exigir que se mencione a alguien, por ejemplo <span className="font-mono">!darrol @usuario</span>. Sin mención, el bot responde un error y no hace nada.</p>
                    <p>Quien use el comando elige a quién se le aplica.</p>
                </div>
            )}
        </div>
    );
}

interface FieldsProps {
    type: ObjectType;
    values: Record<string, SimpleValue>;
    onChange: (values: Record<string, SimpleValue>) => void;
    channels: DiscordChannel[];
    roles: DiscordRole[];
    idPrefix: string;
}

function Field({ property, value, onChange, channels, roles, idPrefix }: {
    property: PropertyDefinition;
    value: SimpleValue;
    onChange: (value: SimpleValue) => void;
    channels: DiscordChannel[];
    roles: DiscordRole[];
    idPrefix: string;
}) {
    const label = `${PROPERTY_LABELS[property.name] ?? property.name}${property.required ? " *" : ""}`;
    const id = `${idPrefix}-${property.name}`;
    const type = property.type;

    if (type.kind === "object" && type.readOnly) {
        const resource = resourceFor(type.name);
        const selected = typeof value === "string" ? value : null;
        return (
            <div className="space-y-1.5">
                <span className="text-xs font-semibold text-zinc-300">{label}</span>
                {resource === "channels" && (
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="min-w-[220px] flex-1">
                            <ChannelDropdown channels={channels} value={selected} onChange={(channelId) => onChange(channelId)} />
                        </div>
                        {!property.required && (
                            <button
                                type="button"
                                onClick={() => onChange(null)}
                                aria-pressed={selected === null}
                                className={`rounded-lg border px-3 py-2 text-xs font-semibold cursor-pointer ${selected === null
                                    ? "border-[#5865F2] bg-[#5865F2]/20 text-white"
                                    : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"}`}
                            >
                                Canal actual
                            </button>
                        )}
                    </div>
                )}
                {resource === "channels" && !property.required && (
                    <p className="text-[11px] text-zinc-500">
                        {selected === null
                            ? "Sin canal elegido: se envía en el mismo canal donde se escribió el comando."
                            : "Elegí \"Canal actual\" para enviarlo en el mismo canal donde se escribió el comando."}
                    </p>
                )}
                {resource === "roles" && (
                    <RoleDropdown roles={roles} value={selected ?? ""} onChange={(roleId) => onChange(roleId)} />
                )}
                {!resource && <MemberField type={type} value={value} onChange={onChange} />}
            </div>
        );
    }

    if (type.kind === "object") {
        const added = typeof value === "object" && value !== null;
        if (!added && !property.required) {
            return (
                <button
                    type="button"
                    onClick={() => onChange({})}
                    className="rounded-lg border border-dashed border-white/15 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 cursor-pointer"
                >
                    + {ADD_LABELS[property.name] ?? `Agregar ${label.toLowerCase()}`}
                </button>
            );
        }
        return (
            <fieldset className="space-y-3 rounded-xl border border-white/10 p-3">
                <legend className="flex items-center gap-2 px-1 text-xs font-semibold text-zinc-300">
                    {label}
                    {!property.required && (
                        <button type="button" onClick={() => onChange(undefined)} className="font-normal text-zinc-500 hover:text-red-300 cursor-pointer">
                            Quitar
                        </button>
                    )}
                </legend>
                <Fields type={type} values={added ? value : {}} onChange={onChange} channels={channels} roles={roles} idPrefix={id} />
            </fieldset>
        );
    }

    const text = typeof value === "string" ? value : "";
    const long = (property.maxLength ?? 0) > 256;
    const inputClass = "w-full rounded-lg border border-white/10 bg-[#111214] px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-[#5865F2] focus:outline-none";
    return (
        <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
                <label htmlFor={id} className="text-xs font-semibold text-zinc-300">{label}</label>
                {property.maxLength !== undefined && (
                    <span className={`text-[10px] ${Array.from(text).length > property.maxLength ? "text-red-400" : "text-zinc-500"}`}>
                        {Array.from(text).length}/{property.maxLength}
                    </span>
                )}
            </div>
            {property.format === "hex-color" ? (
                <div className="flex items-center gap-2">
                    <input
                        type="color"
                        aria-label={`${label}: selector`}
                        value={/^#[0-9A-Fa-f]{6}$/.test(text) ? text : "#5865F2"}
                        onChange={(event) => onChange(event.target.value.toUpperCase())}
                        className="h-9 w-12 cursor-pointer rounded border border-white/10 bg-transparent"
                    />
                    <input id={id} value={text} placeholder="#RRGGBB" onChange={(event) => onChange(event.target.value)} className={inputClass} />
                    {text && (
                        <button type="button" onClick={() => onChange("")} className="text-xs text-zinc-400 hover:text-white cursor-pointer">Quitar</button>
                    )}
                </div>
            ) : long ? (
                <textarea id={id} rows={3} value={text} onChange={(event) => onChange(event.target.value)} className={`${inputClass} resize-y`} />
            ) : (
                <input
                    id={id}
                    value={text}
                    placeholder={property.format === "http-url" ? "https://" : undefined}
                    onChange={(event) => onChange(event.target.value)}
                    className={inputClass}
                />
            )}
        </div>
    );
}

function isCollapsedGroup(property: PropertyDefinition, value: SimpleValue): boolean {
    return property.type.kind === "object" && !property.type.readOnly && !property.required && (typeof value !== "object" || value === null);
}

function Fields({ type, values, onChange, channels, roles, idPrefix }: FieldsProps) {
    const properties = [...type.properties.values()];
    const renderField = (property: PropertyDefinition) => (
        <Field
            key={property.name}
            property={property}
            value={values[property.name]}
            onChange={(value) => onChange({ ...values, [property.name]: value })}
            channels={channels}
            roles={roles}
            idPrefix={idPrefix}
        />
    );
    const collapsed = properties.filter((property) => isCollapsedGroup(property, values[property.name]));
    return (
        <div className="space-y-3">
            {properties.filter((property) => !collapsed.includes(property)).map(renderField)}
            {collapsed.length > 0 && <div className="flex flex-wrap gap-2">{collapsed.map(renderField)}</div>}
        </div>
    );
}

interface SimpleCommandFormProps {
    actions: SimpleAction[];
    onChange: (actions: SimpleAction[]) => void;
    channels: DiscordChannel[];
    roles: DiscordRole[];
}

export default function SimpleCommandForm({ actions, onChange, channels, roles }: SimpleCommandFormProps) {
    const update = (index: number, action: SimpleAction) => onChange(actions.map((item, i) => (i === index ? action : item)));

    return (
        <div className="mx-auto w-full max-w-xl space-y-4">
            {actions.map((action, index) => {
                const type = actionFields(action.functionName);
                return (
                    <div key={index} className="space-y-3 rounded-xl border border-white/10 bg-[#1e1f22] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                                Acción {index + 1}
                                <select
                                    value={action.functionName}
                                    onChange={(event) => update(index, { functionName: event.target.value, values: {} })}
                                    className="rounded-lg border border-white/10 bg-[#111214] px-2 py-1.5 text-xs text-white focus:border-[#5865F2] focus:outline-none"
                                >
                                    {SIMPLE_FUNCTIONS.map((definition) => (
                                        <option key={definition.name} value={definition.name}>
                                            {FUNCTION_LABELS[definition.name] ?? definition.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            {actions.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => onChange(actions.filter((_, i) => i !== index))}
                                    className="text-xs text-zinc-400 hover:text-red-300 cursor-pointer"
                                >
                                    Quitar acción
                                </button>
                            )}
                        </div>
                        <p className="text-[11px] text-zinc-500">{FUNCTION_DESCRIPTIONS[action.functionName] ?? contract.functionByName.get(action.functionName)?.description}</p>
                        {type && (
                            <Fields
                                type={type}
                                values={action.values}
                                onChange={(values) => update(index, { ...action, values })}
                                channels={channels}
                                roles={roles}
                                idPrefix={`action-${index}`}
                            />
                        )}
                    </div>
                );
            })}
            <button
                type="button"
                onClick={() => onChange([...actions, { functionName: SIMPLE_FUNCTIONS[0]?.name ?? "", values: {} }])}
                className="rounded-lg border border-dashed border-white/20 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/5 cursor-pointer"
            >
                + Agregar acción
            </button>
        </div>
    );
}
