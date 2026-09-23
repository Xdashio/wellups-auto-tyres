import type { MetadataRoute } from "next";

// Indexing is open (public storefront). The Sitemap line is emitted only
// once NEXT_PUBLIC_SITE_URL is set at domain time — see app/sitemap.ts.
export default function robots(): MetadataRoute.Robots {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    ...(raw === "" ? {} : { sitemap: `${raw}/sitemap.xml` }),
  };
}
