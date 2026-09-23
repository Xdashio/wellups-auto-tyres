import type { MetadataRoute } from "next";
import { getPublicProducts, getPublicServices } from "@/lib/supabase/catalog";

// Sitemap of actually-published routes only: the static public pages plus
// one entry per live catalog row. No invented routes.
//
// The site has no production domain yet (see docs/PRODUCTION_DATA_INPUTS
// §H). The base URL comes from NEXT_PUBLIC_SITE_URL when Simon sets it at
// domain time; until then an empty (but valid) sitemap is emitted rather
// than one pointing at a guessed domain.
function siteUrl(): string | null {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  return raw === "" ? null : raw;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  if (!base) return [];
  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/products`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/services`, changeFrequency: "weekly", priority: 0.8 },
  ];
  const [products, services] = await Promise.all([getPublicProducts(), getPublicServices()]);
  for (const p of products) {
    entries.push({ url: `${base}/products/${p.id}`, changeFrequency: "weekly", priority: 0.6 });
  }
  for (const s of services) {
    entries.push({ url: `${base}/services/${s.id}`, changeFrequency: "weekly", priority: 0.6 });
  }
  return entries;
}
