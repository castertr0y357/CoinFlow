"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";

export default function LoginForm() {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [oidcEnabled, setOidcEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/v1/auth/config")
      .then((res) => res.json())
      .then((data) => {
        setOidcEnabled(data.oidcEnabled);
        if (data.oidcEnabled) {
          // If no explicit error in URL, auto-redirect to Authentik OIDC
          const urlParams = new URLSearchParams(window.location.search);
          if (!urlParams.get("error")) {
            window.location.href = data.oidcLoginUrl || "/api/v1/auth/oidc/login";
          }
        }
      })
      .catch(() => setOidcEnabled(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        window.location.href = "/";
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Invalid master password. Please try again.");
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  if (oidcEnabled) {
    return (
      <div className="login-form">
        <p className="text-sm text-gray-300 text-center mb-2">
          Protected Vault — Single Sign-On required.
        </p>
        <Button
          type="button"
          variant="primary"
          className="w-full"
          onClick={() => {
            window.location.href = "/api/v1/auth/oidc/login";
          }}
        >
          Sign in with Authentik
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <div className="form-group">
        <input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
        />
      </div>
      {error && <p className="error-message animate-shake">{error}</p>}
      <Button 
        type="submit" 
        variant="primary" 
        className="w-full"
        disabled={isLoading}
      >
        {isLoading ? "Authenticating..." : "Unlock Vault"}
      </Button>

      <style jsx>{`
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        input {
          width: 100%;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          color: white;
          font-size: 1.1rem;
          text-align: center;
          transition: all 0.3s ease;
        }
        input:focus {
          border-color: var(--primary);
          background: rgba(255, 255, 255, 0.08);
          box-shadow: 0 0 20px rgba(79, 172, 254, 0.2);
          outline: none;
        }
        .error-message {
          color: var(--danger);
          font-size: 0.9rem;
          font-weight: 500;
        }
      `}</style>
    </form>
  );
}
