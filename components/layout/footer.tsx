import Link from "next/link";
import { getPrimaryBranch } from "@/lib/supabase/catalog";

export async function Footer() {
  const branch = await getPrimaryBranch();

  return (
    <footer className="border-t border-border bg-navy text-navy-foreground mt-16">
      <div className="container mx-auto px-4 py-10 grid gap-8 sm:grid-cols-3">
        <div>
          <h3 className="font-extrabold tracking-tight text-lg">
            {branch?.name || "WELL LUPS AUTO TYRES LIMITED"}
          </h3>
          <p className="text-sm text-blue-muted mt-2 max-w-xs">
            Quality tyres, alloy wheels, batteries, auto parts, and garage services.
          </p>
        </div>

        <div className="text-sm space-y-1">
          <h4 className="font-semibold uppercase tracking-wide text-xs text-blue-muted mb-2">
            Visit / Contact
          </h4>
          {branch?.address && <p>{branch.address}</p>}
          {branch?.phone && <p>Tel: {branch.phone}</p>}
          {branch?.whatsapp && <p>WhatsApp: {branch.whatsapp}</p>}
          {branch?.opening_hours && <p>{branch.opening_hours}</p>}
          {!branch?.address && !branch?.phone && !branch?.whatsapp && (
            <p className="text-blue-muted">Contact details coming soon.</p>
          )}
        </div>

        <div className="text-sm space-y-2">
          <h4 className="font-semibold uppercase tracking-wide text-xs text-blue-muted mb-2">
            Explore
          </h4>
          <Link href="/products" className="block hover:underline">
            Product Catalogue
          </Link>
          <Link href="/services" className="block hover:underline">
            Garage Services
          </Link>
        </div>
      </div>

      <div className="border-t border-white/10 text-xs text-blue-muted text-center py-4">
        © {new Date().getFullYear()} {branch?.name || "WELL LUPS AUTO TYRES LIMITED"}. All rights reserved.
      </div>
    </footer>
  );
}
