import Home from "@/Components/Home";

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://bot.serez.dev/#website",
        "url": "https://bot.serez.dev",
        "name": "Serez Dev Bot",
        "description":
          "Panel web oficial de Serez Dev Bot para personalización de servidores de Discord, configuración web, automatización y funciones avanzadas.",
        "inLanguage": "es",
        "publisher": {
          "@type": "Organization",
          "@id": "https://serez.dev/#organization",
          "name": "Serez Dev",
          "url": "https://serez.dev",
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://bot.serez.dev/#software",
        "name": "Serez Dev Bot",
        "applicationCategory": "UtilitiesApplication",
        "operatingSystem": "Discord, Web Browser",
        "url": "https://bot.serez.dev",
        "description":
          "Bot de Discord y panel web de administración para personalizar funcionalidades, automatizar comunidades y gestionar servidores.",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
        },
        "author": {
          "@type": "Organization",
          "name": "Serez Dev",
          "url": "https://serez.dev",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Home />
    </>
  );
}