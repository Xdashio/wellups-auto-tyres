import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 py-16 text-center space-y-4">
      <h1 className="text-3xl font-extrabold tracking-tight">Page not found</h1>
      <p className="text-sm text-text-secondary">
        The page you are looking for does not exist or may have been moved.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button asChild>
          <Link href="/products">Browse Products</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/services">Browse Services</Link>
        </Button>
      </div>
    </div>
  );
}
