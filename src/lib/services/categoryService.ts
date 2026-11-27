import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface CategoryMergePreview {
  sourceId: string;
  sourceName: string;
  splitCount: number;
  commitmentCount: number;
  goalCount: number;
  yearlyConfigCount: number;
}

export interface CategoryMergeResult {
  sourceName: string;
  targetName: string;
  splitsMoved: number;
  commitmentsMoved: number;
  goalsMoved: number;
  yearlyConfigsMerged: number;
}

export async function archiveCategory(id: string, isArchived: boolean) {
  const updated = await prisma.category.update({
    where: { id },
    data: { isArchived },
  });
  logger.info("CategoryService", `Category "${updated.name}" isArchived set to ${isArchived}`, {
    action: "category.archive",
    context: { id, isArchived },
  });
  return updated;
}

export async function getCategoryMergePreview(sourceId: string): Promise<CategoryMergePreview> {
  const source = await prisma.category.findUnique({
    where: { id: sourceId },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          splits: true,
          commitments: true,
          savingsGoals: true,
          configs: true,
        },
      },
    },
  });

  if (!source) {
    throw new Error("Source category not found.");
  }

  return {
    sourceId: source.id,
    sourceName: source.name,
    splitCount: source._count.splits,
    commitmentCount: source._count.commitments,
    goalCount: source._count.savingsGoals,
    yearlyConfigCount: source._count.configs,
  };
}

export async function mergeCategories(
  sourceId: string,
  targetId: string
): Promise<CategoryMergeResult> {
  if (sourceId === targetId) {
    throw new Error("Cannot merge a category into itself.");
  }

  const [source, target] = await Promise.all([
    prisma.category.findUnique({ where: { id: sourceId } }),
    prisma.category.findUnique({ where: { id: targetId } }),
  ]);

  if (!source) throw new Error("Source category not found.");
  if (!target) throw new Error("Target category not found.");

  const result = await prisma.$transaction(async (tx) => {
    // 1. Move all TransactionSplits
    const splitsRes = await tx.transactionSplit.updateMany({
      where: { categoryId: sourceId },
      data: { categoryId: targetId },
    });

    // 2. Move all Commitments
    const commitmentsRes = await tx.commitment.updateMany({
      where: { categoryId: sourceId },
      data: { categoryId: targetId },
    });

    // 3. Move all SavingsGoals
    const goalsRes = await tx.savingsGoal.updateMany({
      where: { categoryId: sourceId },
      data: { categoryId: targetId },
    });

    // 4. Update global Settings.savingsCategoryId if it referenced sourceId
    await tx.settings.updateMany({
      where: { savingsCategoryId: sourceId },
      data: { savingsCategoryId: targetId },
    });

    // 5. Merge YearlyCategory configs (handle unique (yearId, categoryId) collisions by summing)
    const sourceConfigs = await tx.yearlyCategory.findMany({
      where: { categoryId: sourceId },
    });

    let yearlyConfigsMerged = 0;
    for (const sc of sourceConfigs) {
      const targetConfig = await tx.yearlyCategory.findUnique({
        where: {
          yearId_categoryId: {
            yearId: sc.yearId,
            categoryId: targetId,
          },
        },
      });

      if (targetConfig) {
        await tx.yearlyCategory.update({
          where: { id: targetConfig.id },
          data: {
            monthlyBudget: Number(targetConfig.monthlyBudget) + Number(sc.monthlyBudget),
            adjustment: Number(targetConfig.adjustment) + Number(sc.adjustment),
            rollover: Number(targetConfig.rollover) + Number(sc.rollover),
          },
        });
        await tx.yearlyCategory.delete({ where: { id: sc.id } });
      } else {
        await tx.yearlyCategory.update({
          where: { id: sc.id },
          data: { categoryId: targetId },
        });
      }
      yearlyConfigsMerged++;
    }

    // 6. Delete the now-empty source category
    await tx.category.delete({ where: { id: sourceId } });

    return {
      sourceName: source.name,
      targetName: target.name,
      splitsMoved: splitsRes.count,
      commitmentsMoved: commitmentsRes.count,
      goalsMoved: goalsRes.count,
      yearlyConfigsMerged,
    };
  });

  logger.info(
    "CategoryService",
    `Merged category "${result.sourceName}" into "${result.targetName}" (${result.splitsMoved} splits moved)`,
    { action: "category.merge", context: result }
  );

  return result;
}
