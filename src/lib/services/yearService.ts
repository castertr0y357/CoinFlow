import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface HistoricalYearSummary {
  id: string;
  year: number;
  transactionCount: number;
  categoryCount: number;
  totalSpent: number;
}

export interface DeleteYearResult {
  year: number;
  transactionsDeleted: number;
  yearlyCategoriesDeleted: number;
  archivedCategoriesCleaned: number;
}

const REFERENCE_LEDGER_NAMES = [
  "Historical Income",
  "Direct Debits",
  "Uncategorized Charges",
];

export async function getHistoricalYearSummaries(
  currentYear: number = new Date().getFullYear()
): Promise<HistoricalYearSummary[]> {
  const pastYears = await prisma.budgetYear.findMany({
    where: { year: { lt: currentYear } },
    orderBy: { year: "desc" },
    include: {
      configs: {
        where: {
          category: {
            name: { notIn: REFERENCE_LEDGER_NAMES },
          },
        },
        select: { id: true },
      },
    },
  });

  const summaries = await Promise.all(
    pastYears.map(async (by) => {
      const start = new Date(Date.UTC(by.year, 0, 1));
      const end = new Date(Date.UTC(by.year + 1, 0, 1));

      const [txCount, spentAgg] = await Promise.all([
        prisma.transaction.count({
          where: { date: { gte: start, lt: end } },
        }),
        prisma.transactionSplit.aggregate({
          where: {
            amount: { lt: 0 },
            category: {
              name: { notIn: REFERENCE_LEDGER_NAMES },
            },
            transaction: {
              date: { gte: start, lt: end },
              isHidden: false,
            },
          },
          _sum: { amount: true },
        }),
      ]);

      return {
        id: by.id,
        year: by.year,
        transactionCount: txCount,
        categoryCount: by.configs.length,
        totalSpent: Math.abs(Number(spentAgg._sum.amount ?? 0)),
      };
    })
  );

  return summaries;
}

export async function deleteHistoricalYear(
  year: number,
  options: { cleanupEmptyArchivedCategories?: boolean; currentYear?: number } = {}
): Promise<DeleteYearResult> {
  const currentYear = options.currentYear ?? new Date().getFullYear();
  if (!Number.isInteger(year) || year >= currentYear) {
    throw new Error(
      `Cannot delete year ${year}. Only past years (before ${currentYear}) can be removed.`
    );
  }

  const budgetYear = await prisma.budgetYear.findUnique({
    where: { year },
  });

  if (!budgetYear) {
    throw new Error(`Budget year ${year} not found.`);
  }

  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  const result = await prisma.$transaction(async (tx) => {
    // 1. Delete all transactions dated in this calendar year (splits cascade)
    const txDel = await tx.transaction.deleteMany({
      where: { date: { gte: start, lt: end } },
    });

    // 2. Delete yearly category configs for this year
    const ycDel = await tx.yearlyCategory.deleteMany({
      where: { yearId: budgetYear.id },
    });

    // 3. Delete the BudgetYear record itself
    await tx.budgetYear.delete({
      where: { id: budgetYear.id },
    });

    // 4. Optionally prune archived categories that now have 0 references
    let archivedCategoriesCleaned = 0;
    if (options.cleanupEmptyArchivedCategories) {
      const catDel = await tx.category.deleteMany({
        where: {
          isArchived: true,
          splits: { none: {} },
          commitments: { none: {} },
          savingsGoals: { none: {} },
          configs: { none: {} },
        },
      });
      archivedCategoriesCleaned = catDel.count;
    }

    return {
      year,
      transactionsDeleted: txDel.count,
      yearlyCategoriesDeleted: ycDel.count,
      archivedCategoriesCleaned,
    };
  });

  logger.info("YearService", `Deleted historical year ${year}`, {
    action: "year.delete",
    context: result,
  });

  return result;
}
