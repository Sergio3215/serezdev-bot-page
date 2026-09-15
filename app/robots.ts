import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/dashboard/",
          "/api/",
          "/auth/",
        ],
      },
    ],
    sitemap: "https://bot.serez.dev/sitemap.xml",
    host: "https://bot.serez.dev",
  };
}
