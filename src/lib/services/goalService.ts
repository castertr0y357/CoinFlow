import prisma from "@/lib/prisma";
import { getMonthlyTally } from "./budgetService";

function safeNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

export interface GoalPayload {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: Date | null;
  categoryId: string | null;
  categoryName?: string;
  isCompleted: boolean;
  progressPercentage: number;
  monthsRemaining: number;
  recommendedMonthlyRate: number;
  icon: string;
}

// Auto-detect a beautiful icon based on goal name keywords
export function getGoalIcon(name: string): string {
  const lowerName = name.toLowerCase();
  if (lowerName.match(/trip|travel|flight|vacation|japan|europe|beach|hotel|holiday|vacay/)) return "✈️";
  if (lowerName.match(/car|auto|vehicle|drive|tesla|truck|motorcycle/)) return "🚗";
  if (lowerName.match(/house|home|rent|mortgage|apartment|furniture|couch|bed|renovation|kitchen/)) return "🏠";
  if (lowerName.match(/computer|laptop|pc|mac|phone|iphone|tech|ipad|tv|oled|playstation|xbox|game|console|hardware/)) return "💻";
  if (lowerName.match(/wedding|anniversary|marry|ring/)) return "💍";
  if (lowerName.match(/gift|christmas|present|birthday|party/)) return "🎁";
  if (lowerName.match(/education|school|college|course|class|degree|book|tuition/)) return "🎓";
  if (lowerName.match(/emergency|medical|health|dentist|doctor|insurance/)) return "🏥";
  if (lowerName.match(/investment|stock|crypto|fund|savings|save|shares|cash/)) return "💰";
  return "🎯";
}

export async function getGoals(): Promise<GoalPayload[]> {
  const goals = await prisma.savingsGoal.findMany({
    include: { category: true },
    orderBy: [
      { isCompleted: "asc" },
      { targetDate: "asc" },
      { name: "asc" }
    ]
  });

  const tally = await getMonthlyTally();
  const categoryMap = new Map(tally.categories.map(c => [c.id, c]));

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  return goals.map(g => {
    const targetAmount = safeNumber(g.targetAmount);
    let currentAmount = safeNumber(g.currentAmount);
    let categoryName: string | undefined = undefined;

    if (g.categoryId) {
      const cat = categoryMap.get(g.categoryId);
      if (cat) {
        currentAmount = Math.max(0, cat.remaining);
        categoryName = cat.name;
      }
    }

    const progressPercentage = targetAmount > 0 
      ? Math.min(100, Math.round((currentAmount / targetAmount) * 100))
      : 0;

    let monthsRemaining = 0;
    let recommendedMonthlyRate = 0;

    if (g.targetDate) {
      const targetDate = new Date(g.targetDate);
      targetDate.setHours(0, 0, 0, 0);
      
      const diffTime = targetDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 0) {
        monthsRemaining = Math.max(1, Math.ceil(diffDays / 30.43));
      } else {
        monthsRemaining = 0;
      }
      
      if (!g.isCompleted && currentAmount < targetAmount) {
        const remainingToSave = targetAmount - currentAmount;
        recommendedMonthlyRate = monthsRemaining > 0 
          ? Math.ceil(remainingToSave / monthsRemaining)
          : remainingToSave;
      }
    }

    return {
      id: g.id,
      name: g.name,
      targetAmount,
      currentAmount,
      targetDate: g.targetDate,
      categoryId: g.categoryId,
      categoryName,
      isCompleted: g.isCompleted,
      progressPercentage,
      monthsRemaining,
      recommendedMonthlyRate,
      icon: getGoalIcon(g.name)
    };
  });
}

export async function addGoal(data: {
  name: string;
  targetAmount: number;
  currentAmount?: number;
  targetDate?: Date | null;
  categoryId?: string | null;
  createCategory?: boolean;
}) {
  let categoryId = data.categoryId || null;

  if (data.createCategory && !categoryId) {
    // Dynamically provision a category with this name if it doesn't already exist
    let category = await prisma.category.findUnique({
      where: { name: data.name }
    });

    if (!category) {
      category = await prisma.category.create({
        data: {
          name: data.name,
          displayOrder: 100 // place near bottom or default
        }
      });
      
      // Also seed yearly category configuration for the current year
      const activeYear = new Date().getFullYear();
      let budgetYear = await prisma.budgetYear.findUnique({
        where: { year: activeYear }
      });
      if (!budgetYear) {
        budgetYear = await prisma.budgetYear.create({
          data: { year: activeYear }
        });
      }

      await prisma.yearlyCategory.create({
        data: {
          yearId: budgetYear.id,
          categoryId: category.id,
          monthlyBudget: 0,
          rollover: 0
        }
      });
    }

    categoryId = category.id;
  }

  return prisma.savingsGoal.create({
    data: {
      name: data.name,
      targetAmount: data.targetAmount,
      currentAmount: data.currentAmount || 0,
      targetDate: data.targetDate || null,
      categoryId,
      isCompleted: false
    }
  });
}

export async function updateGoal(id: string, data: {
  name?: string;
  targetAmount?: number;
  targetDate?: Date | null;
  categoryId?: string | null;
  isCompleted?: boolean;
}) {
  return prisma.savingsGoal.update({
    where: { id },
    data
  });
}

export async function deleteGoal(id: string) {
  return prisma.savingsGoal.delete({
    where: { id }
  });
}

export async function adjustManualGoalAmount(id: string, amount: number) {
  const goal = await prisma.savingsGoal.findUniqueOrThrow({
    where: { id }
  });

  const currentAmount = safeNumber(goal.currentAmount);
  const newAmount = Math.max(0, currentAmount + amount);

  return prisma.savingsGoal.update({
    where: { id },
    data: { currentAmount: newAmount }
  });
}
