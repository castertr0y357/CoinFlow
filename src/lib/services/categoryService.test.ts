import { describe, it, expect, beforeEach, afterEach } from "vitest";
import prisma from "@/lib/prisma";
import {
  archiveCategory,
  getCategoryMergePreview,
  mergeCategories,
} from "./categoryService";
import { getCategories } from "./transactionService";

describe("Category Archiving and Merging", () => {
  const TEST_PREFIX = "__TEST_CAT_MERGE_";
  let testAccountId: string;
  let testYearId: string;

  beforeEach(async () => {
    const account = await prisma.account.upsert({
      where: { remoteId: "test-cat-merge-account" },
      update: {},
      create: {
        remoteId: "test-cat-merge-account",
        name: "Test Cat Merge Account",
        currency: "USD",
      },
    });
    testAccountId = account.id;

    const year = await prisma.budgetYear.upsert({
      where: { year: 2019 },
      update: {},
      create: { year: 2019 },
    });
    testYearId = year.id;

    // Clean any leftover test records
    await prisma.transactionSplit.deleteMany({
      where: { transaction: { accountId: testAccountId } },
    });
    await prisma.transaction.deleteMany({
      where: { accountId: testAccountId },
    });
    await prisma.category.deleteMany({
      where: { name: { startsWith: TEST_PREFIX } },
    });
  });

  afterEach(async () => {
    await prisma.transactionSplit.deleteMany({
      where: { transaction: { accountId: testAccountId } },
    });
    await prisma.transaction.deleteMany({
      where: { accountId: testAccountId },
    });
    await prisma.category.deleteMany({
      where: { name: { startsWith: TEST_PREFIX } },
    });
  });

  it("archives and restores a category, excluding archived categories from active getCategories()", async () => {
    const cat = await prisma.category.create({
      data: { name: `${TEST_PREFIX}Coffee` },
    });

    const activeBefore = await getCategories();
    expect(activeBefore.some((c) => c.id === cat.id)).toBe(true);

    await archiveCategory(cat.id, true);
    const activeAfter = await getCategories();
    expect(activeAfter.some((c) => c.id === cat.id)).toBe(false);

    const allIncludingArchived = await getCategories(true);
    expect(allIncludingArchived.some((c) => c.id === cat.id)).toBe(true);

    await archiveCategory(cat.id, false);
    const activeRestored = await getCategories();
    expect(activeRestored.some((c) => c.id === cat.id)).toBe(true);
  });

  it("merges source category into target, moving splits and summing overlapping YearlyCategory configs", async () => {
    const source = await prisma.category.create({
      data: { name: `${TEST_PREFIX}Source` },
    });
    const target = await prisma.category.create({
      data: { name: `${TEST_PREFIX}Target` },
    });

    // Overlapping YearlyCategory configs for 2019
    await prisma.yearlyCategory.create({
      data: { yearId: testYearId, categoryId: source.id, monthlyBudget: 100, rollover: 50, adjustment: 10 },
    });
    await prisma.yearlyCategory.create({
      data: { yearId: testYearId, categoryId: target.id, monthlyBudget: 250, rollover: 25, adjustment: 5 },
    });

    // Transaction split assigned to source
    const tx = await prisma.transaction.create({
      data: {
        accountId: testAccountId,
        date: new Date("2019-06-15T12:00:00Z"),
        payee: "Coffee Shop",
        amount: -12.5,
        splits: {
          create: {
            categoryId: source.id,
            amount: -12.5,
          },
        },
      },
    });

    const preview = await getCategoryMergePreview(source.id);
    expect(preview.splitCount).toBe(1);
    expect(preview.yearlyConfigCount).toBe(1);

    const result = await mergeCategories(source.id, target.id);
    expect(result.splitsMoved).toBe(1);
    expect(result.yearlyConfigsMerged).toBe(1);

    // Source category should be deleted
    const deletedSource = await prisma.category.findUnique({ where: { id: source.id } });
    expect(deletedSource).toBeNull();

    // Split should now point to target
    const movedSplits = await prisma.transactionSplit.findMany({ where: { transactionId: tx.id } });
    expect(movedSplits[0].categoryId).toBe(target.id);

    // Target's 2019 YearlyCategory should have summed values
    const mergedConfig = await prisma.yearlyCategory.findUnique({
      where: { yearId_categoryId: { yearId: testYearId, categoryId: target.id } },
    });
    expect(Number(mergedConfig?.monthlyBudget)).toBe(350);
    expect(Number(mergedConfig?.rollover)).toBe(75);
    expect(Number(mergedConfig?.adjustment)).toBe(15);
  });
});
