import prisma from "@/lib/prisma";
import Card from "@/components/ui/Card";
import ApiKeyManager from "../ApiKeyManager";
import IntegrationsClient from "./IntegrationsClient";

export default async function IntegrationsSettingsPage() {
  const [settings, apiKeys] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "global" } }),
    prisma.apiKey.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, lastUsed: true },
    }),
  ]);

  return (
    <div className="subpage-container animate-fade-in">
      <IntegrationsClient
        initialSimpleFinToken={settings?.simpleFinToken || ""}
        initialRentcastApiKey={settings?.rentcastApiKey || ""}
      />

      <Card className="settings-form">
        <div className="form-section">
          <h2>API Access Keys</h2>
          <p className="text-muted">
            Generate keys for the CoinFlow browser extension or external scripts.
          </p>
          <ApiKeyManager initialKeys={apiKeys} />
        </div>
      </Card>
    </div>
  );
}
