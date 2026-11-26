"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { updateBudgetIncomeSettingsAction } from "./actions";
import { useNotification } from "@/components/ui/NotificationProvider";

interface BudgetIncomeFormProps {
  categories: { id: string; name: string }[];
  initialSettings: {
    savingsCategoryId: string | null;
    savingsTarget: number;
    monthlyIncome: number;
    paycheckEnabled: boolean;
    paycheckFrequency: string;
    paycheckAmount: number;
    paycheckNextDate: string;
  };
}

export default function BudgetIncomeForm({ categories, initialSettings }: BudgetIncomeFormProps) {
  const [paycheckEnabled, setPaycheckEnabled] = useState(initialSettings.paycheckEnabled);
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useNotification();

  const handleSubmit = async (formData: FormData) => {
    setIsSaving(true);
    try {
      await updateBudgetIncomeSettingsAction(formData);
      showToast("Budget & Income settings saved!", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to save settings", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form action={handleSubmit}>
      <Card className="settings-form">
        <div className="form-section">
          <h2>Savings &amp; Income Targets</h2>

          <div className="settings-grid-3">
            <div className="form-group">
              <label htmlFor="savingsCategoryId">Dynamic Savings Target</label>
              <select
                id="savingsCategoryId"
                name="savingsCategoryId"
                defaultValue={initialSettings.savingsCategoryId || ""}
                className="settings-select"
              >
                <option value="">(Manual Target Only)</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <p className="help-text">
                Automatically matches this category&apos;s monthly provision.
              </p>
            </div>

            <Input
              label="Fallback Savings Target ($)"
              type="number"
              id="savingsTarget"
              name="savingsTarget"
              step="0.01"
              defaultValue={initialSettings.savingsTarget}
              helpText="Used if no category is selected or budgeted."
              required
            />

            <Input
              label="Expected Monthly Income ($)"
              type="number"
              id="expectedMonthlyIncome"
              name="expectedMonthlyIncome"
              step="0.01"
              defaultValue={initialSettings.monthlyIncome}
              helpText="Used for forecasting your month-end cash balance."
              required
            />
          </div>
        </div>

        <div className="form-section">
          <div className="section-header-row">
            <h2>Paycheck-Based Forecasting</h2>
            <label className="settings-toggle" htmlFor="paycheckEnabled">
              <input
                type="checkbox"
                id="paycheckEnabled"
                name="paycheckEnabled"
                checked={paycheckEnabled}
                onChange={(e) => setPaycheckEnabled(e.target.checked)}
              />
              <span className="settings-toggle-slider" />
              <span className="settings-toggle-label">
                {paycheckEnabled ? "Enabled" : "Disabled"}
              </span>
            </label>
          </div>
          <p className="help-text">
            Track your exact payroll schedule to generate high-precision cash flow projections, rather than assuming a flat monthly income amount.
          </p>

          {paycheckEnabled && (
            <div className="settings-grid-3 animate-fade-in">
              <div className="form-group">
                <label htmlFor="paycheckFrequency">Paycheck Frequency</label>
                <select
                  id="paycheckFrequency"
                  name="paycheckFrequency"
                  defaultValue={initialSettings.paycheckFrequency}
                  className="settings-select"
                >
                  <option value="WEEKLY">Weekly (Every 7 days)</option>
                  <option value="BI_WEEKLY">Bi-Weekly (Every 14 days)</option>
                  <option value="SEMI_MONTHLY">Semi-Monthly (Twice a month, e.g. 1st &amp; 15th)</option>
                  <option value="MONTHLY">Monthly (Once a month)</option>
                </select>
                <p className="help-text">How often you receive your paycheck.</p>
              </div>

              <Input
                label="Paycheck Net Amount ($)"
                type="number"
                id="paycheckAmount"
                name="paycheckAmount"
                step="0.01"
                defaultValue={initialSettings.paycheckAmount}
                helpText="Net amount of each individual paycheck."
              />

              <div className="form-group">
                <label htmlFor="paycheckNextDate">Reference Paycheck Date</label>
                <input
                  type="date"
                  id="paycheckNextDate"
                  name="paycheckNextDate"
                  defaultValue={initialSettings.paycheckNextDate}
                  className="settings-input"
                />
                <p className="help-text">
                  Any past or upcoming payday to anchor your cycle.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="form-actions">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </Card>
    </form>
  );
}
