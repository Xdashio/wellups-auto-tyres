import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 py-8">
      <EmptyState
        heading="Page not found"
        body="The page you are looking for does not exist or may have been moved."
        action={
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild>
              <Link href="/products">Browse Products</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/services">Browse Services</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
