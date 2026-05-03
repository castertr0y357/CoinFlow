"use client";

import { useEffect } from "react";
import Button from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Runtime Error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-fade-in">
      <div className="glass p-12 rounded-3xl max-w-md w-full border border-danger/20">
        <div className="text-6xl mb-6">⚠️</div>
        <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
        <p className="text-dim mb-8">
          {error.message || "An unexpected error occurred while rendering this page."}
        </p>
        <div className="flex gap-4 justify-center">
          <Button onClick={() => reset()} variant="primary">
            Try Again
          </Button>
          <Button onClick={() => window.location.href = '/'} variant="glass">
            Back to Dashboard
          </Button>
        </div>
        {error.digest && (
          <p className="mt-8 text-xs text-muted">Error ID: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
