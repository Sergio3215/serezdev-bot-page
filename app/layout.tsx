import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://bot.serez.dev"),
  title: {
    default: "Serez Dev Bot | Personaliza y Configura tu Servidor de Discord",
    template: "%s | Serez Dev Bot",
  },
  description:
    "Panel web oficial de Serez Dev Bot. Personaliza comandos, configura servidores de Discord, gestiona automatizaciones y accede a opciones premium para tu comunidad.",
  applicationName: "Serez Dev Bot",
  authors: [{ name: "Serez Dev", url: "https://serez.dev" }],
  generator: "Next.js",
  keywords: [
    "bot para Discord",
    "bot de Discord",
    "bot configurable para Discord",
    "personalizar bot de Discord",
    "personalizar servidor de Discord",
    "configuración de Discord",
    "herramientas para servidor de Discord",
    "automatización de Discord",
    "Serez Dev Bot",
  ],
  creator: "Serez Dev",
  publisher: "Serez Dev",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "https://bot.serez.dev",
    siteName: "Serez Dev Bot",
    title: "Serez Dev Bot | Personaliza y Configura tu Servidor de Discord",
    description:
      "Panel de control y personalización avanzada para tu servidor de Discord. Configuración web intuitiva, herramientas de comunidad y funciones premium.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Serez Dev Bot | Personaliza y Configura tu Servidor de Discord",
    description:
      "Panel de control y personalización avanzada para tu servidor de Discord. Configuración web intuitiva, herramientas de comunidad y funciones premium.",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
