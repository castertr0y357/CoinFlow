import prisma from "@/lib/prisma";
import Card from "@/components/ui/Card";
import ApiKeyManager from "../ApiKeyManager";

export default async function ApiSettingsPage() {
  const apiKeys = await prisma.apiKey.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, lastUsed: true }
  });

  return (
    <div className="subpage-container animate-fade-in">
      <Card className="settings-form">
        <div className="form-section">
          <h2>API Access</h2>
          <p className="text-muted">Generate keys to allow external apps or dashboards to view your budget data.</p>
          <ApiKeyManager initialKeys={apiKeys} />
        </div>
      </Card>
    </div>
  );
}
