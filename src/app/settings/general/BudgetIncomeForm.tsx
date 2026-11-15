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
          <h2>Savings & Income Targets</h2>

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
              If selected, your savings target will automatically match this category&apos;s monthly provision.
            </p>
          </div>

          <Input
            label="Fallback/Manual Savings Target ($)"
            type="number"
            id="savingsTarget"
            name="savingsTarget"
            step="0.01"
            defaultValue={initialSettings.savingsTarget}
            helpText="Used if no category is selected or if the selected category has no budget."
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

        <div className="form-section">
          <h2>Paycheck-Based Forecasting</h2>
          <p className="help-text">
            Track your exact payroll schedule to generate high-precision cash flow projections, rather than assuming a flat monthly income amount.
          </p>

          <div
            className="form-group checkbox-group"
            style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}
          >
            <input
              type="checkbox"
              id="paycheckEnabled"
              name="paycheckEnabled"
              checked={paycheckEnabled}
              onChange={(e) => setPaycheckEnabled(e.target.checked)}
              style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "var(--accent)" }}
            />
            <label
              htmlFor="paycheckEnabled"
              style={{ cursor: "pointer", margin: 0, fontWeight: 600, fontSize: "0.95rem", color: "var(--text-main)" }}
            >
              Enable Paycheck Forecasting
            </label>
          </div>

          {paycheckEnabled && (
            <div className="flex flex-col gap-6 animate-fade-in">
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
                <p className="help-text">Select how often you receive your paycheck.</p>
              </div>

              <Input
                label="Paycheck Net Amount ($)"
                type="number"
                id="paycheckAmount"
                name="paycheckAmount"
                step="0.01"
                defaultValue={initialSettings.paycheckAmount}
                helpText="The net amount of each individual paycheck."
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
                  Any past or upcoming paycheck date. Used as an anchor to calculate your pay cycle schedule.
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
