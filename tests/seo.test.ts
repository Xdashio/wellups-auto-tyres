import { describe, it, expect, afterEach } from "vitest";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";

// No live DB: without NEXT_PUBLIC_SITE_URL the sitemap is empty and robots
// carries no Sitemap line (no guessed domain); with it, static routes
// resolve against the configured base. Catalog rows need Supabase and are
// covered by the empty-catalog contract, not here.
const KEY = "NEXT_PUBLIC_SITE_URL";
const saved = process.env[KEY];

afterEach(() => {
  if (saved === undefined) delete process.env[KEY];
  else process.env[KEY] = saved;
});

describe("seo routes", () => {
  it("emits an empty sitemap and bare robots without a configured domain", async () => {
    delete process.env[KEY];
    await expect(sitemap()).resolves.toEqual([]);
    expect(robots()).toEqual({ rules: [{ userAgent: "*", allow: "/" }] });
  });

  it("resolves static routes against the configured domain", async () => {
    process.env[KEY] = "https://example.invalid/";
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain("https://example.invalid/");
    expect(urls).toContain("https://example.invalid/products");
    expect(urls).toContain("https://example.invalid/services");
    expect(robots()).toEqual({
      rules: [{ userAgent: "*", allow: "/" }],
      sitemap: "https://example.invalid/sitemap.xml",
    });
  });
});
