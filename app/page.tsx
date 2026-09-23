import type { Metadata } from "next";
import {
  getPrimaryBranch,
  getPublicBranches,
  getPublicProducts,
  getPublicServices,
  getPublicVehicleFitments,
} from "@/lib/supabase/catalog";
import { LandingPage, type LandingContent } from "@/components/landing/landing-page";
import {
  STATIC_VEHICLE_MODELS,
  STATIC_YEARS,
  type LandingBranch,
  type LandingProduct,
  type LandingService,
} from "@/components/landing/landing-data";

export const revalidate = 60;

// Single-sourced branch facts: the title/description below are built from
// the SAME getPrimaryBranch() row that the footer renders — business
// data is never hardcoded a second time. No city is claimed: only the
// stored address/name, falling back to the country context.
export async function generateMetadata(): Promise<Metadata> {
  const branch = await getPrimaryBranch();
  const place = branch?.address ?? branch?.name ?? "Kenya";
  const contact = branch?.phone ?? branch?.whatsapp;
  return {
    title: "Tyre & Auto Parts Specialist",
    description:
      `WELL LUPS AUTO TYRES LIMITED at ${place} — tyres, ` +
      `auto parts and garage services with quote-based pricing.` +
      (contact ? ` Call/WhatsApp ${contact}.` : ""),
  };
}

function LocalBusinessJsonLd({ branch }: { branch: Awaited<ReturnType<typeof getPrimaryBranch>> }) {
  if (!branch) return null;
  // AutoPartsStore (a schema.org LocalBusiness subtype) backed only by
  // real branch fields. NULL fields are omitted, never guessed: no hours,
  // no geo, no ratings, no reviews markup of any kind.
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "AutoPartsStore",
    name: "WELL LUPS AUTO TYRES LIMITED",
  };
  if (branch.name) jsonLd.branchName = branch.name;
  if (branch.address) {
    jsonLd.address = {
      "@type": "PostalAddress",
      streetAddress: branch.address,
    };
  }
  if (branch.phone) jsonLd.telephone = branch.phone;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default async function Home() {
  const [branch, branches, dbProducts, dbServices, fitments] = await Promise.all([
    getPrimaryBranch(),
    getPublicBranches(),
    getPublicProducts(),
    getPublicServices(),
    getPublicVehicleFitments(),
  ]);

  // Landing catalogue is 100% database-driven. The public catalogue carries
  // no imagery or pricing (quote-based), so cards render a neutral
  // placeholder visual until real product photos land. Nothing is
  // hardcoded: empty tables render empty states, never fake items.
  const products: LandingProduct[] = dbProducts.slice(0, 6).map((p) => ({
    id: p.id,
    brand: p.brand || "Well Lups",
    category: "Tyre",
    name: p.name,
    spec: p.size_spec || p.sku,
    stock: p.status === "out_of_stock" ? "out" : p.status === "low_stock" ? "low" : "in",
    image: null,
  }));

  const services: LandingService[] = dbServices.slice(0, 3).map((s) => ({
    id: s.id,
    category: s.vehicle_types?.[0] ?? "Garage Service",
    name: s.name,
    spec: s.description ?? "Quote on inspection",
    image: null,
    cta: "Get a quote",
  }));

  const liveBranches: LandingBranch[] = branches.slice(0, 2).map((b, i) => ({
    num: `Branch 0${i + 1}`,
    name: b.name,
    address: b.address ? [b.address] : [],
    phone: b.phone ?? "",
    phoneHref: b.phone ? `tel:${b.phone.replace(/\s+/g, "")}` : "",
  }));

  const modelsByMake: Record<string, string[]> = {};
  for (const f of fitments) {
    if (!f.make_name) continue;
    if (!modelsByMake[f.make_name]) modelsByMake[f.make_name] = [];
    if (f.model_name && !modelsByMake[f.make_name].includes(f.model_name)) {
      modelsByMake[f.make_name].push(f.model_name);
    }
  }
  const makeNames = Object.keys(modelsByMake);
  const yearSet = new Set<string>();
  for (const f of fitments) {
    if (f.year_start) yearSet.add(String(f.year_start));
    if (f.year_end) yearSet.add(String(f.year_end));
  }
  const yearList = [...yearSet].sort((a, b) => Number(b) - Number(a));

  const featured = products.filter((p) => p.stock !== "out");
  const heroSource = featured[0] ?? products[0] ?? null;

  const primaryWhatsapp =
    branch?.whatsapp ?? branches.find((b) => b.whatsapp)?.whatsapp ?? null;

  const content: LandingContent = {
    products,
    services,
    branches: liveBranches,
    productCount: dbProducts.length,
    serviceCount: dbServices.length,
    branchCount: branches.length,
    whatsapp: primaryWhatsapp,
    makes: makeNames.length ? makeNames : Object.keys(STATIC_VEHICLE_MODELS),
    modelsByMake: makeNames.length ? modelsByMake : STATIC_VEHICLE_MODELS,
    years: yearList.length ? yearList : STATIC_YEARS,
    featured,
    heroProduct: heroSource ? { name: heroSource.name, spec: heroSource.spec } : null,
  };

  return (
    <>
      <LocalBusinessJsonLd branch={branch} />
      <LandingPage content={content} />
    </>
  );
}
