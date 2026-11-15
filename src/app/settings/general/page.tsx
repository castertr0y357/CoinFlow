import prisma from "@/lib/prisma";
import BudgetIncomeForm from "./BudgetIncomeForm";

export default async function GeneralSettingsPage() {
  const settings = await prisma.settings.findUnique({ where: { id: "global" } });

  const categories = await prisma.category.findMany({
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  return (
    <div className="subpage-container animate-fade-in">
      <BudgetIncomeForm
        categories={categories}
        initialSettings={{
          savingsCategoryId: settings?.savingsCategoryId || null,
          savingsTarget: settings?.savingsTarget ? Number(settings.savingsTarget) : 650.0,
          monthlyIncome: settings?.monthlyIncome ? Number(settings.monthlyIncome) : 5000.0,
          paycheckEnabled: settings?.paycheckEnabled || false,
          paycheckFrequency: settings?.paycheckFrequency || "BI_WEEKLY",
          paycheckAmount: settings?.paycheckAmount ? Number(settings.paycheckAmount) : 2500.0,
          paycheckNextDate: settings?.paycheckNextDate
            ? new Date(settings.paycheckNextDate).toISOString().split("T")[0]
            : "",
        }}
      />
    </div>
  );
}
