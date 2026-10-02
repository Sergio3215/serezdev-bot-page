import Link from "next/link";
import CodeBlock, { TextBlock } from "./CodeBlock";
import { FormatRules, FunctionCatalog, TypeCatalog } from "./ContractCatalog";

const SECTIONS = [
    { id: "introduccion", title: "Qué es un comando" },
    { id: "activacion", title: "Cómo se activa" },
    { id: "estructura", title: "Estructura del código" },
    { id: "valores", title: "Valores" },
    { id: "variables", title: "Variables" },
    { id: "propiedades", title: "Propiedades y operadores" },
    { id: "condiciones", title: "Condiciones" },
    { id: "miembros", title: "Miembros y menciones" },
    { id: "recorridos", title: "Recorrer listas" },
    { id: "ids", title: "IDs de Discord" },
    { id: "funciones", title: "Funciones" },
    { id: "tipos", title: "Tipos y configuraciones" },
    { id: "recetas", title: "Recetas" },
    { id: "errores", title: "Errores frecuentes" },
    { id: "formato", title: "Formato" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function Section({ id, children }: { id: SectionId; children: React.ReactNode }) {
    const title = SECTIONS.find((section) => section.id === id)?.title;
    return (
        <section id={id} className="scroll-mt-24 space-y-4 border-t border-white/5 pt-10 first:border-t-0 first:pt-0">
            <h2 className="group text-2xl font-bold tracking-tight text-white">
                <a href={`#${id}`} className="hover:underline underline-offset-4">
                    {title}
                    <span className="ml-2 text-zinc-600 opacity-0 group-hover:opacity-100">#</span>
                </a>
            </h2>
            {children}
        </section>
    );
}

function Sub({ children }: { children: React.ReactNode }) {
    return <h3 className="pt-2 text-lg font-semibold text-white">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
    return <p className="text-sm leading-relaxed text-zinc-300">{children}</p>;
}

function C({ children }: { children: React.ReactNode }) {
    return <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[12.5px] text-zinc-100">{children}</code>;
}

function Note({ tone = "info", children }: { tone?: "info" | "warning"; children: React.ReactNode }) {
    const styles = tone === "warning"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
        : "border-[#5865F2]/30 bg-[#5865F2]/10 text-[#c9cdff]";
    return <div className={`rounded-xl border p-3.5 text-sm leading-relaxed ${styles}`}>{children}</div>;
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-xs">
                <thead className="bg-white/5 text-zinc-400">
                    <tr>{head.map((cell) => <th key={cell} className="px-3 py-2 font-semibold">{cell}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-zinc-300">
                    {rows.map((row, index) => (
                        <tr key={index}>{row.map((cell, i) => <td key={i} className="px-3 py-2">{cell}</td>)}</tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function CommandGuide() {
    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white selection:bg-[#5865F2]">
            <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0a0a0f]/90 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
                    <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white">&larr; Volver al panel</Link>
                    <span className="text-sm font-semibold text-zinc-200">Guía de comandos personalizados</span>
                </div>
            </header>

            <div className="mx-auto flex max-w-6xl gap-10 px-4 py-10">
                <nav aria-label="Contenido de la guía" className="sticky top-20 hidden h-[calc(100vh-6rem)] w-52 shrink-0 overflow-y-auto lg:block">
                    <ol className="space-y-1 text-sm">
                        {SECTIONS.map((section) => (
                            <li key={section.id}>
                                <a href={`#${section.id}`} className="block rounded-lg px-2.5 py-1.5 text-zinc-400 hover:bg-white/5 hover:text-white">
                                    {section.title}
                                </a>
                            </li>
                        ))}
                    </ol>
                </nav>

                <main className="min-w-0 max-w-3xl flex-1 space-y-10">
                    <div className="space-y-3">
                        <h1 className="text-4xl font-extrabold tracking-tight">Modo avanzado</h1>
                        <p className="text-base text-zinc-400">
                            Todo lo que necesitás para escribir comandos personalizados a mano. Si solo querés mandar un mensaje, una tarjeta o dar un rol, el modo simple lo hace sin código.
                        </p>
                    </div>

                    <Section id="introduccion">
                        <P>
                            Un comando personalizado es un pequeño programa que el bot ejecuta cuando alguien escribe un texto en tu servidor, por ejemplo <C>!hola</C>. El lenguaje se parece a JavaScript, pero es mucho más chico: tiene solo lo necesario para mandar mensajes y tarjetas, consultar miembros y dar roles.
                        </P>
                        <CodeBlock code={`
ReplyMessage({
    message: "¡Hola! Soy el bot de este servidor",
})
`} />
                    </Section>

                    <Section id="activacion">
                        <P>
                            El comando se activa cuando un mensaje contiene su texto de activación. Si el comando usa menciones, el texto puede ir antes o después de la mención:
                        </P>
                        <TextBlock text={`
!darrol @Serez Dev
@Serez Dev !darrol
`} />
                        <P>
                            Distingue mayúsculas y minúsculas. Si varios comandos coinciden, se ejecuta el de texto más largo. Las menciones de roles, <C>@everyone</C> y <C>@here</C> no cuentan como menciones de miembros.
                        </P>
                    </Section>

                    <Section id="estructura">
                        <P>Un programa tiene una o más instrucciones, normalmente una por línea. El punto y coma es opcional; el formatter lo quita.</P>
                        <CodeBlock code={`
const role = Role("371826690424569866")
const member = GetMember("123456789012345678")
`} />
                        <P>Los saltos de línea dentro de paréntesis, objetos y arrays no terminan la instrucción, así que podés repartir una llamada larga en varias líneas.</P>
                        <Sub>Mayúsculas y minúsculas</Sub>
                        <P>Los nombres distinguen mayúsculas: <C>GetMember</C> existe, <C>getMember</C> no.</P>
                        <Sub>Comentarios</Sub>
                        <CodeBlock code={`
// Comentario de una línea
/*
 * Comentario de varias líneas.
 * No pueden anidarse.
 */
ReplyMessage({
    message: "Hola",
})
`} />
                    </Section>

                    <Section id="valores">
                        <Sub>Texto (strings)</Sub>
                        <P>Con comillas dobles o simples; el formatter las pasa a dobles. Para unir textos se usa <C>+</C>.</P>
                        <CodeBlock code={`
const first = "Hola"
const second = 'Mundo'
const greeting = first + ", " + second
`} />
                        <Table
                            head={["Escritura", "Resultado"]}
                            rows={[
                                [<C key="a">{"\\n"}</C>, "Salto de línea"],
                                [<C key="b">{"\\t"}</C>, "Tabulación"],
                                [<C key="c">{"\\\""}</C>, "Comilla doble"],
                                [<C key="d">{"\\'"}</C>, "Comilla simple"],
                                [<C key="e">{"\\\\"}</C>, "Barra invertida"],
                                [<C key="f">{"\\uFFFF"}</C>, "Carácter Unicode (cuatro dígitos hexadecimales)"],
                            ]}
                        />
                        <Sub>Números, booleanos y null</Sub>
                        <CodeBlock code={`
const attempts = 0
const average = 4.5
const offset = -5
const enabled = true
const nothing = null
`} />
                        <P>No hay notación exponencial (<C>1e6</C>). <C>null</C> representa la ausencia de un valor.</P>
                        <Sub>Objetos</Sub>
                        <P>Las propiedades van sin comillas. La coma final es válida y recomendada.</P>
                        <CodeBlock code={`
const card = {
    title: "Panel informativo",
    description: "Contenido del panel",
}

SendEmbed(card)
`} />
                        <Sub>Arrays</Sub>
                        <P>Los elementos se leen por posición, empezando en cero.</P>
                        <CodeBlock code={`
const roleIds = ["371826690424569866", "371826690424569867"]
AddRole(GetAuthor(), Role(roleIds[0]))
`} />
                    </Section>

                    <Section id="variables">
                        <P><C>let</C> crea una variable que se puede cambiar; <C>const</C>, una que no. Las dos necesitan un valor inicial.</P>
                        <CodeBlock code={`
let attempts = 0
attempts += 1
attempts++

const message = "Hola"
`} />
                        <CodeBlock expect="invalid" errorCode="CONST_REASSIGNMENT" code={`
const message = "Hola"
message = "Otro mensaje"
`} />
                        <P>Una variable existe solo dentro del bloque <C>{"{ }"}</C> donde se declaró.</P>
                        <P>Un objeto guardado en una <C>const</C> sí puede cambiar sus propiedades; lo que no se puede es reemplazarlo entero:</P>
                        <CodeBlock code={`
const config = {
    message: "Mensaje inicial",
}

config.message = "Mensaje actualizado"
SendMessage(config)
`} />
                    </Section>

                    <Section id="propiedades">
                        <P>Las propiedades se leen con punto o con corchetes, y se pueden encadenar.</P>
                        <CodeBlock code={`
const author = GetAuthor()

ReplyMessage({
    message: "Hola, " + author.displayName + ". Tu ID es " + author.id,
})
`} />
                        <Sub>Operadores</Sub>
                        <Table
                            head={["Operadores", "Uso"]}
                            rows={[
                                [<C key="a">+ - * / %</C>, "Aritmética. + también une textos (dos textos o dos números)."],
                                [<C key="b">=== !==</C>, "Igualdad estricta. No existen == ni !=."],
                                [<C key="c">{"< <= > >="}</C>, "Comparación entre dos números o dos textos."],
                                [<C key="d">{"&& || !"}</C>, "Lógicos, solo con valores verdadero o falso."],
                                [<C key="e">= += -=</C>, "Asignación."],
                                [<C key="f">++ --</C>, "Sumar o restar 1 a una variable numérica."],
                                [<C key="g">( )</C>, "Agrupar para cambiar el orden de evaluación."],
                            ]}
                        />
                    </Section>

                    <Section id="condiciones">
                        <P>Los paréntesis y las llaves son obligatorios.</P>
                        <CodeBlock code={`
const author = GetAuthor()
const role = Role("371826690424569866")

if (author.bot) {
    ReplyMessage({
        message: "Los bots no pueden usar este comando",
    })
} else if (HasRole(author, role)) {
    ReplyMessage({
        message: "Ya tenés el rol",
    })
} else {
    AddRole(author, role)
}
`} />
                    </Section>

                    <Section id="miembros">
                        <Sub>Quién escribió y a quién mencionó</Sub>
                        <P>
                            <C>GetAuthor()</C> devuelve a quien escribió el comando. <C>GetMentionedMember()</C> devuelve al primer miembro mencionado y <C>GetMentionedMembers()</C>, a todos. Las tres siempre devuelven un valor, así que se usan directamente.
                        </P>
                        <CodeBlock code={`
AddRole(GetMentionedMember(), Role("371826690424569866"))
ReplyMessage({
    message: "Rol entregado",
})
`} />
                        <Note tone="warning">
                            <strong>Mención obligatoria.</strong> Si el código usa <C>GetMentionedMember</C> o <C>GetMentionedMembers</C> en cualquier parte, aunque sea dentro de un <C>if</C>, el comando exige una mención. Sin ella, el bot responde con un error y no ejecuta nada, así que un comando nunca queda hecho a medias.
                        </Note>
                        <Sub>Buscar a un miembro por su ID</Sub>
                        <P>
                            <C>GetMember(&quot;id&quot;)</C> puede devolver <C>null</C> si la persona no está en el servidor. Antes de usar el resultado hay que descartarlo; dentro del <C>if</C>, el editor ya sabe que existe.
                        </P>
                        <CodeBlock code={`
const member = GetMember("123456789012345678")

if (member === null) {
    ReplyMessage({
        message: "No se encontró el miembro",
    })
} else {
    AddRole(member, Role("371826690424569866"))
}
`} />
                        <CodeBlock expect="invalid" errorCode="INCOMPATIBLE_ARGUMENT" code={`
const member = GetMember("123456789012345678")
AddRole(member, Role("371826690424569866"))
`} />
                        <Note>
                            La comprobación de <C>null</C> tiene que ser la condición completa del <C>if</C>. Si además necesitás otra condición, anidá los <C>if</C> en vez de unirlas con <C>&&</C>.
                        </Note>
                    </Section>

                    <Section id="recorridos">
                        <P>El único bucle es <C>for...of</C>: recorre una lista. <C>continue</C> pasa al siguiente elemento y <C>break</C> termina el recorrido.</P>
                        <CodeBlock code={`
for (const member of GetMentionedMembers()) {
    if (member.bot) {
        continue
    }

    AddRole(member, Role("371826690424569866"))
}
`} />
                        <CodeBlock code={`
let found = false

for (const member of GetMembers()) {
    if (member.id === "123456789012345678") {
        found = true
        break
    }
}

if (found) {
    ReplyMessage({
        message: "Miembro encontrado",
    })
}
`} />
                    </Section>

                    <Section id="ids">
                        <P>
                            Los IDs de canales, roles y usuarios se escriben como texto, entre comillas, y tienen entre 17 y 20 dígitos. Para copiar un ID en Discord, activá el modo desarrollador y usá «Copiar ID».
                        </P>
                        <CodeBlock code={`
SendMessage({
    channel: Channel("123456789012345678"),
    message: "Anuncio",
})
`} />
                        <CodeBlock expect="invalid" errorCode="INCOMPATIBLE_ARGUMENT" code={`
Channel(123456789012345678)
`} />
                    </Section>

                    <Section id="funciones">
                        <P>Estas son todas las funciones disponibles. Los nombres se escriben exactamente así.</P>
                        <FunctionCatalog />
                    </Section>

                    <Section id="tipos">
                        <Sub>Valores del servidor</Sub>
                        <P>Los devuelven las funciones y son de solo lectura: se pueden leer, pero no modificar.</P>
                        <TypeCatalog readOnly />
                        <Sub>Configuraciones de mensajes y tarjetas</Sub>
                        <P>
                            Son los objetos que reciben <C>SendMessage</C>, <C>SendEmbed</C> y las demás acciones. Solo admiten las propiedades de la tabla. Los colores usan el formato <C>#RRGGBB</C> y los enlaces tienen que empezar con <C>http://</C> o <C>https://</C>.
                        </P>
                        <TypeCatalog readOnly={false} />
                    </Section>

                    <Section id="recetas">
                        <Sub>Mensaje en otro canal</Sub>
                        <CodeBlock code={`
SendMessage({
    channel: Channel("123456789012345678"),
    message: "El evento comienza en diez minutos",
})
`} />
                        <Sub>Tarjeta con texto e imagen</Sub>
                        <CodeBlock code={`
SendEmbed({
    title: "Actualización",
    description: "Se publicó una nueva versión",
    color: "#5865F2",
    image: "https://example.com/release.png",
    footer: {
        text: "Servidor oficial",
    },
})
`} />
                        <Sub>Dar un rol a quien escribe, si todavía no lo tiene</Sub>
                        <CodeBlock code={`
const author = GetAuthor()
const role = Role("371826690424569866")

if (HasRole(author, role)) {
    ReplyMessage({
        message: "Ya tenés el rol",
    })
} else {
    AddRole(author, role)
    ReplyMessage({
        message: "Rol agregado",
    })
}
`} />
                        <Sub>Mencionar a alguien en el mensaje</Sub>
                        <P>
                            Discord muestra como mención cualquier texto con la forma <C>{"<@ID>"}</C>. Se arma uniendo el ID con <C>+</C>. Funciona en el mensaje y en la descripción de una tarjeta. En el modo simple es lo mismo que escribir <C>{"{autor}"}</C> o <C>{"{mencionado}"}</C>.
                        </P>
                        <CodeBlock code={`
AddRole(GetMentionedMember(), Role("371826690424569866"))
ReplyMessage({
    message: "<@" + GetAuthor().id + "> le dio el rol a <@" + GetMentionedMember().id + ">",
})
`} />
                        <Sub>Solo un rol puede usar el comando</Sub>
                        <P>La autorización se comprueba sobre quien escribe (<C>GetAuthor()</C>), nunca sobre la persona mencionada.</P>
                        <CodeBlock code={`
if (HasRole(GetAuthor(), Role("111111111111111111"))) {
    AddRole(GetMentionedMember(), Role("371826690424569866"))
} else {
    ReplyMessage({
        message: "No tenés permiso para usar este comando",
    })
}
`} />
                    </Section>

                    <Section id="errores">
                        <P>El editor marca estos errores mientras escribís. Debajo de cada ejemplo está el mensaje exacto que vas a ver.</P>
                        <Sub>Claves entre comillas</Sub>
                        <CodeBlock expect="invalid" errorCode="QUOTED_OBJECT_KEY" code={`
SendMessage({
    "message": "Hola",
})
`} />
                        <Sub>Tarjeta sin contenido propio</Sub>
                        <P><C>message</C> y <C>channel</C> no cuentan como contenido de la tarjeta.</P>
                        <CodeBlock expect="invalid" errorCode="EMPTY_EMBED" code={`
SendEmbed({
    message: "Solo texto externo",
})
`} />
                        <Sub>Propiedad que no existe</Sub>
                        <CodeBlock expect="invalid" errorCode="UNKNOWN_CONFIG_PROPERTY" code={`
SendEmbed({
    title: "Hola",
    thumbnail: "https://example.com/icon.png",
})
`} />
                        <Sub>Función escrita con otro nombre</Sub>
                        <CodeBlock expect="invalid" errorCode="UNKNOWN_NATIVE_FUNCTION" code={`
sendMessage({
    message: "Hola",
})
`} />
                        <Sub>Igualdad con == o template strings</Sub>
                        <CodeBlock expect="invalid" errorCode="UNSUPPORTED_OPERATOR" code={`
const same = 1 == 1
`} />
                        <CodeBlock expect="invalid" errorCode="TEMPLATE_STRING_NOT_SUPPORTED" code={"const greeting = `Hola ${name}`"} />
                    </Section>

                    <Section id="formato">
                        <P>El botón Formatear del editor (o Shift+Alt+F) ordena el código con estas reglas, sin cambiar lo que hace ni borrar comentarios:</P>
                        <FormatRules />
                    </Section>
                </main>
            </div>
        </div>
    );
}
