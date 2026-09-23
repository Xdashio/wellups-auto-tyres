"use client";

import { ErrorState } from "@/components/ui/error-state";

// Root error boundary (Next.js App Router convention): unexpected route
// failures render the shared ErrorState with a retry action. Never
// exposes error internals — only a safe message.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <ErrorState
        title="Something went wrong"
        message={
          error.digest
            ? `An unexpected error interrupted this page (reference ${error.digest}). Please try again.`
            : "An unexpected error interrupted this page. Please try again."
        }
        retryLabel="Try again"
        onRetry={reset}
      />
    </div>
  );
}
