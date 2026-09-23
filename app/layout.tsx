import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { Toaster } from "@/components/landing/toaster";
import { getPublicCounts } from "@/lib/supabase/catalog";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "WELL LUPS AUTO TYRES LIMITED",
    template: "%s | WELL LUPS AUTO TYRES LIMITED",
  },
  description:
    "Tyres, alloy wheels, batteries, auto parts and professional garage services. Quote-based pricing.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const counts = await getPublicCounts();
  return (
    <html lang="en" className={plusJakartaSans.variable}>
      <body className="min-h-[100dvh] bg-background text-foreground font-sans flex flex-col">
        <SiteHeader
          productCount={counts.products}
          serviceCount={counts.services}
          branchCount={counts.branches}
        />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        <Toaster />
      </body>
    </html>
  );
}
