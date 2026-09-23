"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_LINKS = [
  { href: "/admin/quotes", label: "Quotes" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/products/import", label: "Import Products" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/services/import", label: "Import Services" },
  { href: "/admin/staff", label: "Staff" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div>
      <div className="border-b border-border bg-muted/40">
        <nav aria-label="Admin sections" className="container mx-auto px-4 flex gap-1 overflow-x-auto">
          {ADMIN_LINKS.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  active
                    ? "text-primary border-primary"
                    : "text-muted-foreground border-transparent hover:text-primary hover:border-primary"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
