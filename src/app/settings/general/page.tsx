import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default async function GeneralSettingsPage() {
  const settings = await prisma.settings.findUnique({ where: { id: 'global' } });
  
  const categories = await prisma.category.findMany({
    orderBy: [
      { displayOrder: 'asc' },
      { name: 'asc' }
    ],
    select: { id: true, name: true }
  });

  async function updateSettings(formData: FormData) {
    "use server";
    
    const target = parseFloat(formData.get("savingsTarget") as string);
    const income = parseFloat(formData.get("expectedMonthlyIncome") as string);
    const retention = parseInt(formData.get("backupRetentionDays") as string);
    const savingsCategoryId = formData.get("savingsCategoryId") as string;
    let token = formData.get("simpleFinToken") as string;

    const paycheckEnabled = formData.get("paycheckEnabled") === "on";
    const paycheckFrequency = formData.get("paycheckFrequency") as string;
    const paycheckAmount = parseFloat(formData.get("paycheckAmount") as string);
    const paycheckNextDateStr = formData.get("paycheckNextDate") as string;
    const paycheckNextDate = paycheckNextDateStr ? new Date(paycheckNextDateStr + "T00:00:00") : null;

    if (token && !token.startsWith('https://user:')) { 
      let claimUrl = token;
      if (!token.startsWith('https://')) {
        try {
          const decoded = Buffer.from(token, 'base64').toString('utf-8');
          if (decoded.startsWith('https://')) {
            claimUrl = decoded;
          }
        } catch {}
      }

      if (claimUrl.includes('/claim/')) {
        try {
          const claimResponse = await fetch(claimUrl, { method: 'POST' });
          if (claimResponse.ok) {
            const accessUrl = await claimResponse.text();
            if (accessUrl && accessUrl.startsWith('https')) {
              token = accessUrl;
            }
          }
        } catch {}
      }
    }

    await prisma.settings.upsert({
      where: { id: 'global' },
      update: {
        savingsTarget: isNaN(target) ? 0 : target,
        monthlyIncome: isNaN(income) ? 5000 : income,
        backupRetentionDays: isNaN(retention) ? 30 : retention,
        savingsCategoryId: savingsCategoryId || null,
        simpleFinToken: token || null,
        paycheckEnabled,
        paycheckFrequency: paycheckFrequency || "BI_WEEKLY",
        paycheckAmount: isNaN(paycheckAmount) ? 0 : paycheckAmount,
        paycheckNextDate,
      },
      create: {
        id: 'global',
        savingsTarget: isNaN(target) ? 0 : target,
        monthlyIncome: isNaN(income) ? 5000 : income,
        backupRetentionDays: isNaN(retention) ? 30 : retention,
        savingsCategoryId: savingsCategoryId || null,
        simpleFinToken: token || null,
        paycheckEnabled,
        paycheckFrequency: paycheckFrequency || "BI_WEEKLY",
        paycheckAmount: isNaN(paycheckAmount) ? 0 : paycheckAmount,
        paycheckNextDate,
      }
    });

    revalidatePath("/settings/general");
    revalidatePath("/");
  }

  return (
    <div className="subpage-container animate-fade-in">
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
              <p className="help-text">If selected, your savings target will automatically match this category&apos;s monthly provision.</p>
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

            <Input 
              label="Backup Retention (Days)"
              type="number" 
              id="backupRetentionDays" 
              name="backupRetentionDays" 
              defaultValue={settings?.backupRetentionDays || 30} 
              helpText="How many days of automated and pre-import backups to keep on the server."
              required 
            />

            {/* Paycheck Forecasting Section */}
            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--glass-border)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)' }}>Paycheck-Based Forecasting</h3>
              <p className="help-text" style={{ marginBottom: '1.25rem' }}>
                Track your exact payroll schedule to generate high-precision cash flow projections, rather than assuming a flat monthly income amount.
              </p>
              
              <div className="form-group checkbox-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  id="paycheckEnabled" 
                  name="paycheckEnabled" 
                  defaultChecked={settings?.paycheckEnabled || false}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent)' }}
                />
                <label htmlFor="paycheckEnabled" style={{ cursor: 'pointer', margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                  Enable Paycheck Forecasting
                </label>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Paycheck Frequency</label>
                <select 
                  name="paycheckFrequency" 
                  defaultValue={settings?.paycheckFrequency || "BI_WEEKLY"}
                  className="settings-select"
                >
                  <option value="WEEKLY">Weekly (Every 7 days)</option>
                  <option value="BI_WEEKLY">Bi-Weekly (Every 14 days)</option>
                  <option value="SEMI_MONTHLY">Semi-Monthly (Twice a month, e.g. 1st & 15th)</option>
                  <option value="MONTHLY">Monthly (Once a month)</option>
                </select>
                <p className="help-text" style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Select how often you receive your paycheck.</p>
              </div>

              <Input 
                label="Paycheck Net Amount ($)"
                type="number" 
                id="paycheckAmount" 
                name="paycheckAmount" 
                step="0.01" 
                defaultValue={settings?.paycheckAmount ? Number(settings.paycheckAmount) : 2500.00} 
                helpText="The net amount of each individual paycheck."
              />

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Reference Paycheck Date</label>
                <input 
                  type="date" 
                  id="paycheckNextDate" 
                  name="paycheckNextDate" 
                  defaultValue={settings?.paycheckNextDate ? new Date(settings.paycheckNextDate).toISOString().split('T')[0] : ""} 
                  className="settings-input"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    color: 'var(--text-main)',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                />
                <p className="help-text" style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Any past or upcoming paycheck date. Used as an anchor to calculate your pay cycle schedule.</p>
              </div>
            </div>
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
            
            <div className="integration-help">
               <h3>How to get your Bridge URL:</h3>
               <ol className="help-steps">
                  <li>Go to <a href="https://simplefin.org/" target="_blank" rel="noopener noreferrer">SimpleFIN.org</a> and sign up for a <strong>Bridge</strong> account.</li>
                  <li>Connect your bank accounts via their secure portal.</li>
                  <li>Look for the &quot;Setup an App&quot; or &quot;Claim URL&quot; button.</li>
                  <li>Copy the long URL and paste it here.</li>
               </ol>
            </div>
          </div>

          <div className="form-actions">
            <Button type="submit">Save Changes</Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
