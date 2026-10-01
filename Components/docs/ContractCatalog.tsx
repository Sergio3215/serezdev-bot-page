import { languageService } from "@/lib/custom-command-language";
import type { FunctionDefinition, ObjectType, PropertyDefinition, Type } from "@/lib/custom-command-language/contract/model";
import CodeBlock from "./CodeBlock";

const contract = languageService.contract;

const KIND_LABELS: Record<string, { label: string; className: string }> = {
    reference: { label: "Referencia", className: "border-[#ffcb6b]/30 bg-[#ffcb6b]/10 text-[#ffcb6b]" },
    query: { label: "Consulta", className: "border-[#82aaff]/30 bg-[#82aaff]/10 text-[#82aaff]" },
    action: { label: "Acción", className: "border-[#8c96ff]/30 bg-[#8c96ff]/10 text-[#aab1ff]" },
};

const FORMAT_LABELS: Record<string, string> = {
    snowflake: "ID de Discord (17 a 20 dígitos)",
    "hex-color": "Color #RRGGBB",
    "http-url": "URL http:// o https://",
};

const REQUIREMENT_LABELS: Record<string, string> = {
    mention: "El comando exige que el mensaje mencione al menos a un miembro.",
};

function TypeName({ type }: { type: Type }) {
    return <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[12px] text-[#82aaff]">{type.name}</code>;
}

function PropertyRules({ property }: { property: PropertyDefinition }) {
    const rules: string[] = [];
    if (property.minLength !== undefined || property.maxLength !== undefined) {
        rules.push(`${property.minLength ?? 0} a ${property.maxLength ?? "∞"} caracteres`);
    }
    if (property.format) rules.push(FORMAT_LABELS[property.format] ?? property.format);
    if (property.readOnly) rules.push("Solo lectura");
    return <span className="text-zinc-400">{rules.join(" · ") || "—"}</span>;
}

function PropertiesTable({ type }: { type: ObjectType }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-xs">
                <thead className="bg-white/5 text-zinc-400">
                    <tr>
                        <th className="px-3 py-2 font-semibold">Propiedad</th>
                        <th className="px-3 py-2 font-semibold">Tipo</th>
                        <th className="px-3 py-2 font-semibold">Obligatoria</th>
                        <th className="px-3 py-2 font-semibold">Reglas</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {[...type.properties.values()].map((property) => (
                        <tr key={property.name}>
                            <td className="px-3 py-2 font-mono text-[#f07178]">{property.name}</td>
                            <td className="px-3 py-2"><TypeName type={property.type} /></td>
                            <td className="px-3 py-2 text-zinc-300">{property.required ? "Sí" : "No"}</td>
                            <td className="px-3 py-2"><PropertyRules property={property} /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function FunctionCard({ definition }: { definition: FunctionDefinition }) {
    const kind = KIND_LABELS[definition.kind];
    return (
        <article id={`fn-${definition.name}`} className="scroll-mt-24 rounded-2xl border border-white/10 bg-[#12141e] p-5">
            <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-mono text-base font-semibold text-white">{definition.name}</h3>
                {kind && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${kind.className}`}>{kind.label}</span>}
            </div>
            <p className="mt-2 text-sm text-zinc-300">{definition.description}</p>
            {definition.signatures.map((signature) => (
                <pre key={signature} className="mt-3 overflow-x-auto rounded-lg bg-[#111214] px-3 py-2 font-mono text-[12px] text-zinc-200">{signature}</pre>
            ))}
            <dl className="mt-3 grid gap-1 text-xs text-zinc-400">
                <div>
                    <dt className="inline font-semibold text-zinc-300">Devuelve: </dt>
                    <dd className="inline">
                        <TypeName type={definition.returns} />
                        {definition.nullable && " — puede ser null: descartalo antes de usarlo."}
                    </dd>
                </div>
                {definition.parameters.length > 0 && (
                    <div>
                        <dt className="inline font-semibold text-zinc-300">Parámetros: </dt>
                        <dd className="inline">
                            {definition.parameters.map((parameter, index) => (
                                <span key={parameter.name}>
                                    {index > 0 && ", "}
                                    <span className="font-mono text-zinc-200">{parameter.name}</span> <TypeName type={parameter.type} />
                                    {parameter.format && ` (${FORMAT_LABELS[parameter.format] ?? parameter.format})`}
                                </span>
                            ))}
                        </dd>
                    </div>
                )}
                {definition.requires.map((requirement) => (
                    <div key={requirement} className="text-amber-300">{REQUIREMENT_LABELS[requirement] ?? requirement}</div>
                ))}
            </dl>
            {definition.examples.map((example) => (
                <CodeBlock key={example} code={example} expect="fragment" title="Ejemplo" />
            ))}
        </article>
    );
}

export function FunctionCatalog() {
    const groups = [...contract.functionCategories.entries()].map(([kind, description]) => ({
        kind,
        description,
        functions: [...contract.functionByName.values()].filter((definition) => definition.kind === kind),
    }));
    return (
        <div className="space-y-8">
            {groups.map((group) => (
                <div key={group.kind} className="space-y-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white">{KIND_LABELS[group.kind]?.label ?? group.kind}</h3>
                        <p className="text-sm text-zinc-400">{group.description}</p>
                    </div>
                    {group.functions.map((definition) => <FunctionCard key={definition.name} definition={definition} />)}
                </div>
            ))}
        </div>
    );
}

export function TypeCatalog({ readOnly }: { readOnly: boolean }) {
    const types = [...contract.typeByName.values()].filter((type): type is ObjectType => type.kind === "object" && type.readOnly === readOnly);
    return (
        <div className="space-y-6">
            {types.map((type) => (
                <div key={type.name} id={`type-${type.name}`} className="scroll-mt-24 space-y-2">
                    <h3 className="font-mono text-base font-semibold text-white">{type.name}</h3>
                    {type.requiresAny.length > 0 && (
                        <p className="text-xs text-zinc-400">
                            Requiere al menos una de: {type.requiresAny.map((name) => <code key={name} className="mx-0.5 font-mono text-[#f07178]">{name}</code>)}
                        </p>
                    )}
                    <PropertiesTable type={type} />
                </div>
            ))}
        </div>
    );
}

export function FormatRules() {
    const formatter = contract.formatter;
    const rules = [
        `Indentación de ${formatter.indent === "\t" ? "un tab" : `${formatter.indent.length} espacios`}.`,
        `Strings con comillas ${formatter.quote === "\"" ? "dobles" : "simples"}.`,
        formatter.semicolons ? "Punto y coma al final de cada instrucción." : "Sin punto y coma.",
        "Una instrucción por línea.",
        "Espacios alrededor de los operadores y después de cada coma.",
        "Objetos con propiedades en varias líneas, una propiedad por línea, con coma final.",
        "Llave de apertura en la misma línea; else junto a la llave de cierre.",
        `Hasta ${formatter.maxBlankLines} líneas en blanco seguidas.`,
    ];
    return (
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">
            {rules.map((rule) => <li key={rule}>{rule}</li>)}
        </ul>
    );
}
