import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-16 max-w-4xl space-y-12 text-center">
      <div className="space-y-4">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
          WELL LUPS AUTO TYRES LIMITED
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Kenya&apos;s trusted supplier of quality tyres, alloy wheels, batteries, auto parts, and garage services. Industrial Area, Nairobi.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
        <div className="p-6 border rounded-xl bg-card space-y-4 shadow-sm hover:shadow-md transition-shadow">
          <h2 className="text-2xl font-bold">Product Catalogue</h2>
          <p className="text-sm text-muted-foreground">
            Explore our wide range of tyres, alloy wheels, batteries, brake pads, and engine fluids. Filter by your vehicle make, model, and size.
          </p>
          <Button asChild className="w-full">
            <Link href="/products">Browse Products</Link>
          </Button>
        </div>

        <div className="p-6 border rounded-xl bg-card space-y-4 shadow-sm hover:shadow-md transition-shadow">
          <h2 className="text-2xl font-bold">Garage Services</h2>
          <p className="text-sm text-muted-foreground">
            Professional tyre fitting, 3D wheel alignment, balancing, brake servicing, and battery checks performed at our Industrial Area branch.
          </p>
          <Button asChild variant="secondary" className="w-full">
            <Link href="/services">Browse Services</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
