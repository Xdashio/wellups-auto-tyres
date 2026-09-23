import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getPrimaryBranch } from "@/lib/supabase/catalog";

export const revalidate = 0;

// Single-sourced branch facts: the title/description below are built from
// the SAME getPrimaryBranch() row that Header/Footer render — business
// data is never hardcoded a second time.
export async function generateMetadata(): Promise<Metadata> {
  const branch = await getPrimaryBranch();
  const place = branch?.address ?? branch?.name ?? "Kenya";
  const contact = branch?.phone ?? branch?.whatsapp;
  return {
    title: "Tyres, Auto Parts & Garage Services",
    description:
      `WELL LUPS AUTO TYRES LIMITED at ${place} — tyres, alloy wheels, ` +
      `batteries, auto parts and garage services with quote-based pricing.` +
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
  const branch = await getPrimaryBranch();

  return (
    <main>
      <LocalBusinessJsonLd branch={branch} />
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy text-navy-foreground">
        <div className="container mx-auto px-4 py-16 sm:py-24 grid gap-10 sm:grid-cols-2 items-center">
          <div className="space-y-6 text-center sm:text-left">
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              Kenya&apos;s Trusted Tyres, Parts &amp; Garage Services
            </h1>
            <p className="text-blue-muted text-base sm:text-lg max-w-md mx-auto sm:mx-0">
              {branch?.address
                ? `Serving customers from our ${branch.address} branch.`
                : "Quality tyres, alloy wheels, batteries, auto parts and professional garage services."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center sm:justify-start">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/products">Shop the Catalogue</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto border-white/40 text-navy-foreground hover:bg-white/10">
                <Link href="/services">Book a Service</Link>
              </Button>
            </div>
          </div>

          <div className="relative aspect-square w-full max-w-sm mx-auto">
            <Image
              src="/images/hero-wheel.webp"
              alt="Alloy wheel and tyre"
              fill
              className="object-contain drop-shadow-2xl"
              priority
            />
          </div>
        </div>
      </section>

      {/* Shop / Book — equal weight entry points */}
      <section className="container mx-auto px-4 py-12 sm:py-16 grid gap-6 sm:grid-cols-2">
        <Card className="p-6 space-y-4 shadow-sm hover:shadow-md transition-shadow">
          <h2 className="text-2xl font-bold">Product Catalogue</h2>
          <p className="text-sm text-muted-foreground">
            Explore tyres, alloy wheels, batteries, brake pads, and engine fluids. Filter by
            your vehicle make, model, and size — every item is priced by quote.
          </p>
          <Button asChild className="w-full">
            <Link href="/products">Browse Products</Link>
          </Button>
        </Card>

        <Card className="p-6 space-y-4 shadow-sm hover:shadow-md transition-shadow">
          <h2 className="text-2xl font-bold">Garage Services</h2>
          <p className="text-sm text-muted-foreground">
            Professional tyre fitting, wheel alignment, balancing, brake servicing, and
            battery checks{branch?.address ? ` at our ${branch.address} branch` : ""}.
          </p>
          <Button asChild variant="secondary" className="w-full">
            <Link href="/services">Browse Services</Link>
          </Button>
        </Card>
      </section>

      {/* Why us */}
      <section className="container mx-auto px-4 py-4 sm:py-8 pb-16">
        <div className="grid gap-6 sm:grid-cols-3 text-center">
          <div className="space-y-2">
            <h3 className="font-bold">Get a Quote, No Guesswork</h3>
            <p className="text-sm text-muted-foreground">
              Request a quote on any product or service and we&apos;ll respond directly on
              WhatsApp.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-bold">Fitment You Can Trust</h3>
            <p className="text-sm text-muted-foreground">
              Filter the catalogue by your exact make, model, and trim before you buy.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-bold">Book Ahead</h3>
            <p className="text-sm text-muted-foreground">
              Reserve a service slot online. Our team will confirm your appointment.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
