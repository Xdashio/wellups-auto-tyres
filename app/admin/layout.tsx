import Link from "next/link";

const ADMIN_LINKS = [
  { href: "/admin/quotes", label: "Quotes" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="border-b border-border bg-muted/40">
        <nav className="container mx-auto px-4 flex gap-1 overflow-x-auto">
          {ADMIN_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-4 py-3 text-sm font-medium text-text-secondary hover:text-primary whitespace-nowrap border-b-2 border-transparent hover:border-primary transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
