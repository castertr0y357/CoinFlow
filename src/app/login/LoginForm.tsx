"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

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
        router.push("/");
        router.refresh();
      } else {
        setError("Invalid master password. Please try again.");
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

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
