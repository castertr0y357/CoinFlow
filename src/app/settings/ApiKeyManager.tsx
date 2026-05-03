"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { generateNewKey, revokeKey } from "./api-actions";

interface ApiKey {
  id: string;
  name: string;
  lastUsed: Date | null;
}

export default function ApiKeyManager({ initialKeys }: { initialKeys: ApiKey[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName) return;

    const rawKey = await generateNewKey(newKeyName);
    setRevealedKey(rawKey);
    setNewKeyName("");
    // Re-fetching or updating state would happen here in a real app, 
    // but revalidatePath handles it for the server component.
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this key?")) return;
    await revokeKey(id);
  };

  return (
    <div className="api-key-manager">
      <h3>Active API Keys</h3>
      <div className="key-list">
        {initialKeys.map(key => (
          <div key={key.id} className="key-item glass">
            <div className="key-info">
              <span className="key-name">{key.name}</span>
              <span className="key-meta">
                Last used: {key.lastUsed ? new Date(key.lastUsed).toLocaleString() : "Never"}
              </span>
            </div>
            <Button variant="danger" size="sm" onClick={() => handleRevoke(key.id)}>
              Revoke
            </Button>
          </div>
        ))}
      </div>

      <form onSubmit={handleGenerate} className="generate-key-form">
        <Input 
          label="New Key Name"
          placeholder="e.g. Wife's iPhone"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
        />
        <Button type="submit" variant="secondary">Generate Key</Button>
      </form>

      {revealedKey && (
        <div className="revealed-key glass animate-fade-in">
          <p><strong>Success!</strong> Copy this key now. You won't be able to see it again.</p>
          <code className="key-code">{revealedKey}</code>
          <Button variant="ghost" size="sm" onClick={() => setRevealedKey(null)}>Close</Button>
        </div>
      )}
    </div>
  );
}
