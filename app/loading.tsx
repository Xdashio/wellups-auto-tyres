import { LoadingState } from "@/components/ui/loading-state";

// Root loading boundary (Next.js App Router convention): page-level
// Suspense fallbacks render the single shared LoadingState.
export default function RootLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <LoadingState text="Loading…" />
    </div>
  );
}
