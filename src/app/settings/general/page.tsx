import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default async function GeneralSettingsPage() {
  const settings = await prisma.settings.findUnique({ where: { id: 'global' } });
  const currentYear = new Date().getFullYear();
  
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
    const savingsCategoryId = formData.get("savingsCategoryId") as string;
    let token = formData.get("simpleFinToken") as string;

    if (token && !token.startsWith('https://user:')) { 
      let claimUrl = token;
      if (!token.startsWith('https://')) {
        try {
          const decoded = Buffer.from(token, 'base64').toString('utf-8');
          if (decoded.startsWith('https://')) {
            claimUrl = decoded;
          }
        } catch (e) {}
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
        } catch (err) {}
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
            
            <div className="integration-help">
               <h3>How to get your Bridge URL:</h3>
               <ol className="help-steps">
                  <li>Go to <a href="https://simplefin.org/" target="_blank" rel="noopener noreferrer">SimpleFIN.org</a> and sign up for a <strong>Bridge</strong> account.</li>
                  <li>Connect your bank accounts via their secure portal.</li>
                  <li>Look for the <strong>"Setup an App"</strong> or <strong>"Claim URL"</strong> button.</li>
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
