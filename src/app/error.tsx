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

  const isDev = process.env.NODE_ENV === "development";
  const userFriendlyMessage = "A system error occurred while processing your request. Sensitive database and server details have been redacted for security.";

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-fade-in">
      <div className="glass p-12 rounded-3xl max-w-md w-full border border-danger/20">
        <div className="text-6xl mb-6">⚠️</div>
        <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
        <p className="text-dim mb-8" style={{ fontSize: "0.95rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
          {isDev ? (error.message || userFriendlyMessage) : userFriendlyMessage}
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
          <p className="mt-8 text-xs text-muted" style={{ marginTop: "2rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Correlation ID: <code style={{ background: "var(--glass-bg)", padding: "2px 6px", borderRadius: "4px" }}>{error.digest}</code>
          </p>
        )}
      </div>
    </div>
  );
}

