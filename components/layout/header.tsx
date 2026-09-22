import Link from "next/link";
import Image from "next/image";
import { getPrimaryBranch } from "@/lib/supabase/catalog";

export async function Header() {
  const branch = await getPrimaryBranch();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
      {(branch?.phone || branch?.whatsapp) && (
        <div className="bg-navy text-navy-foreground text-xs">
          <div className="container mx-auto px-4 py-1.5 flex justify-end gap-4">
            {branch?.phone && <span>Call: {branch.phone}</span>}
            {branch?.whatsapp && <span>WhatsApp: {branch.whatsapp}</span>}
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image
            src="/images/wellups_logo_no_bg.png"
            alt={branch?.name || "WELL LUPS AUTO TYRES LIMITED"}
            width={40}
            height={40}
            className="h-9 w-9 object-contain"
          />
          <span className="font-extrabold tracking-tight text-sm sm:text-base leading-tight">
            WELL LUPS
            <span className="block text-[10px] sm:text-xs font-medium text-text-secondary tracking-wide">
              AUTO TYRES LIMITED
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/products"
            className="px-3 sm:px-4 py-2 rounded-md text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary-hover transition-colors"
          >
            Shop
          </Link>
          <Link
            href="/services"
            className="px-3 sm:px-4 py-2 rounded-md text-sm font-semibold bg-secondary text-secondary-foreground hover:opacity-90 transition-opacity"
          >
            Book a Service
          </Link>
        </nav>
      </div>
    </header>
  );
}
