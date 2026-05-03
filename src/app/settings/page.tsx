import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ApiKeyManager from "./ApiKeyManager";
import SubscriptionDetective from "./SubscriptionDetective";
import BackupManager from "./BackupManager";
import CategoryManager from "./CategoryManager";
import YearManager from "./YearManager";
import HistoricalImporter from "./HistoricalImporter";
import "./Settings.css";

export default async function SettingsPage() {
  const settings = await prisma.settings.findUnique({ where: { id: 'global' } });
  const currentYear = new Date().getFullYear();
  const apiKeys = await prisma.apiKey.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, lastUsed: true }
  });

  // Fetch only categories that have a config for the CURRENT year
  const categories = await prisma.category.findMany({
    where: {
      configs: {
        some: { 
          year: { year: currentYear }
        }
      }
    },
    orderBy: [
      { displayOrder: 'asc' },
      { name: 'asc' }
    ],
    select: { id: true, name: true }
  });

  const allYears = await prisma.budgetYear.findMany({
    orderBy: { year: 'desc' }
  });

  async function updateSettings(formData: FormData) {
    "use server";
    
    const target = parseFloat(formData.get("savingsTarget") as string);
    const income = parseFloat(formData.get("expectedMonthlyIncome") as string);
    const savingsCategoryId = formData.get("savingsCategoryId") as string;
    let token = formData.get("simpleFinToken") as string;

    // Auto-claim logic: Handle Setup Tokens (Base64) or direct Claim URLs
    if (token && !token.startsWith('https://user:')) { 
      let claimUrl = token;
      
      console.log("SimpleFIN: Input token detected. Checking for claim...");

      if (!token.startsWith('https://')) {
        try {
          const decoded = Buffer.from(token, 'base64').toString('utf-8');
          console.log("SimpleFIN: Decoded token:", decoded);
          if (decoded.startsWith('https://')) {
            claimUrl = decoded;
          }
        } catch (e) {
          console.log("SimpleFIN: Token is not base64.");
        }
      }

      if (claimUrl.includes('/claim/')) {
        try {
          console.log("SimpleFIN: Attempting to POST to:", claimUrl);
          const claimResponse = await fetch(claimUrl, { method: 'POST' });
          console.log("SimpleFIN: Claim status:", claimResponse.status);
          if (claimResponse.ok) {
            const accessUrl = await claimResponse.text();
            console.log("SimpleFIN: Successfully claimed! Access URL received.");
            if (accessUrl && accessUrl.startsWith('https')) {
              token = accessUrl;
            }
          } else {
            const errText = await claimResponse.text();
            console.error("SimpleFIN: Claim failed with error:", errText);
          }
        } catch (err) {
          console.error("SimpleFIN: Network error during claim:", err);
        }
      } else {
        console.log("SimpleFIN: No claim URL found in token.");
      }
    }

    await prisma.settings.upsert({
      where: { id: 'global' },
      update: {
        savingsTarget: isNaN(target) ? 0 : target,
        monthlyIncome: isNaN(income) ? 5000 : income,
        savingsCategoryId: savingsCategoryId || null,
        simpleFinToken: token || null,
      },
      create: {
        id: 'global',
        savingsTarget: isNaN(target) ? 0 : target,
        monthlyIncome: isNaN(income) ? 5000 : income,
        savingsCategoryId: savingsCategoryId || null,
        simpleFinToken: token || null,
      }
    });

    revalidatePath("/settings");
    revalidatePath("/");
  }

  return (
    <div className="settings-container">
      <header className="page-header">
        <h1 className="animate-fade-in">Settings</h1>
        <p className="text-dim animate-fade-in" style={{ animationDelay: '0.1s' }}>
          Configure your budget targets and integrations.
        </p>
      </header>

      <div className="settings-grid animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <form action={updateSettings}>
          <Card className="settings-form">
            <div className="form-section">
              <h2>Budget Rules</h2>
              
              <div className="form-group">
                <label>Dynamic Savings Target</label>
                <select 
                  name="savingsCategoryId" 
                  defaultValue={settings?.savingsCategoryId || ""}
                  className="settings-select"
                >
                  <option value="">(Manual Target Only)</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <p className="help-text">If selected, your savings target will automatically match this category's monthly provision.</p>
              </div>

              <Input 
                label="Fallback/Manual Savings Target ($)"
                type="number" 
                id="savingsTarget" 
                name="savingsTarget" 
                step="0.01" 
                defaultValue={settings?.savingsTarget ? Number(settings.savingsTarget) : 650.00} 
                helpText="Used if no category is selected or if the selected category has no budget."
                required 
              />

              <Input 
                label="Expected Monthly Income ($)"
                type="number" 
                id="expectedMonthlyIncome" 
                name="expectedMonthlyIncome" 
                step="0.01" 
                defaultValue={settings?.monthlyIncome ? Number(settings.monthlyIncome) : 5000.00} 
                helpText="Used for forecasting your month-end cash balance."
                required 
              />
            </div>

            <div className="form-section">
              <h2>Integrations</h2>
              <Input 
                label="SimpleFIN Bridge URL (Token)"
                type="password" 
                id="simpleFinToken" 
                name="simpleFinToken" 
                defaultValue={settings?.simpleFinToken || ""} 
                placeholder="https://beta-bridge.simplefin.org/simplefin/claim/..." 
                helpText="Your access URL to sync bank transactions securely."
              />
              
              <div className="integration-help glass mt-4">
                 <h3>How to get your Bridge URL:</h3>
                 <ol className="help-steps">
                    <li>Go to <a href="https://simplefin.org/" target="_blank" rel="noopener noreferrer">SimpleFIN.org</a> and sign up for a <strong>Bridge</strong> account.</li>
                    <li>Connect your bank accounts via their secure portal (they use MX or Akoya).</li>
                    <li>Look for the <strong>"Setup an App"</strong> or <strong>"Claim URL"</strong> button in your dashboard.</li>
                    <li>Copy the long URL that looks like <code>https://beta-bridge.simplefin.org/simplefin/claim/...</code> and paste it here.</li>
                 </ol>
                 <p className="text-xs text-muted mt-2">
                    SimpleFIN is a paid service ($1.50/mo) that provides a secure "bridge" to your bank data without giving this app your login credentials.
                 </p>
              </div>
            </div>

            <div className="form-actions">
              <Button type="submit">Save Changes</Button>
            </div>
          </Card>
        </form>

        <Card className="api-access-section" animate={true} delay="0.3s">
          <div className="form-section">
            <h2>API Access</h2>
            <p className="text-muted">Generate keys to allow external apps or dashboards to view your budget data.</p>
            <ApiKeyManager initialKeys={apiKeys} />
          </div>
        </Card>

        <Card className="detective-section" animate={true} delay="0.4s">
          <div className="form-section">
            <h2>Subscription Detective</h2>
            <SubscriptionDetective />
          </div>
        </Card>

        <Card className="year-end-section" animate={true} delay="0.5s">
          <div className="form-section">
            <h2>Year-End Processing</h2>
            <p className="text-muted">Finalize your current year accounting and roll over balances to the next calendar year.</p>
            <YearManager currentYear={new Date().getFullYear()} />
          </div>
        </Card>

        <Card className="category-section" animate={true} delay="0.6s">
          <div className="form-section">
            <h2>Category Management</h2>
            <p className="text-muted">Add or remove budget categories. Categories with existing transactions cannot be deleted.</p>
            <CategoryManager initialCategories={categories} />
          </div>
        </Card>

        <Card className="historical-import-section" animate={true} delay="0.6s">
          <div className="form-section">
            <h2>Historical XLSX Import</h2>
            <p className="text-muted">Ingest data from previous years. AI will help map your spreadsheet sheets to categories.</p>
            <HistoricalImporter />
          </div>
        </Card>

        <Card className="history-archive-section" animate={true} delay="0.7s">
          <div className="form-section">
            <h2>Historical Archives</h2>
            <p className="text-muted">Quick access to finalized budgets from previous years.</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {allYears.filter(y => y.year < currentYear).map(y => (
                <Link 
                  key={y.id} 
                  href={`/history/${y.year}`}
                  className="year-link glass p-3 rounded-lg border border-white/10 hover:border-primary transition-all"
                >
                  📅 {y.year} Budget
                </Link>
              ))}
              {allYears.filter(y => y.year < currentYear).length === 0 && (
                <p className="text-sm italic opacity-50">No historical archives found yet.</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="backup-section" animate={true} delay="0.8s">
          <div className="form-section">
            <h2>Backup & Restore</h2>
            <p className="text-muted">Download your entire financial vault or restore it from a previous backup.</p>
            <BackupManager />
          </div>
        </Card>
      </div>
    </div>
  );
}
