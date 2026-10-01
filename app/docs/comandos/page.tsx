import type { Metadata } from "next";
import CommandGuide from "@/Components/docs/CommandGuide";

export const metadata: Metadata = {
    title: "Guía de comandos personalizados",
    description: "Cómo escribir comandos personalizados para Serez Dev Bot en el modo avanzado: lenguaje, funciones, recetas y errores frecuentes.",
    alternates: { canonical: "/docs/comandos" },
};

export default function CommandGuidePage() {
    return <CommandGuide />;
}
