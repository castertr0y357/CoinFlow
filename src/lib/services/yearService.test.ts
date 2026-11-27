import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTx = {
  transaction: { deleteMany: vi.fn() },
  yearlyCategory: { deleteMany: vi.fn() },
  budgetYear: { delete: vi.fn() },
  category: { deleteMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  default: {
    budgetYear: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
  },
}));

import prisma from "@/lib/prisma";
import { deleteHistoricalYear } from "./yearService";

const mockFindUnique = prisma.budgetYear.findUnique as ReturnType<typeof vi.fn>;

describe("deleteHistoricalYear", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.transaction.deleteMany.mockResolvedValue({ count: 14 });
    mockTx.yearlyCategory.deleteMany.mockResolvedValue({ count: 8 });
    mockTx.budgetYear.delete.mockResolvedValue({ id: "by-2019", year: 2019 });
    mockTx.category.deleteMany.mockResolvedValue({ count: 2 });
  });

  it("refuses to delete the current or future year", async () => {
    await expect(
      deleteHistoricalYear(2026, { currentYear: 2026 })
    ).rejects.toThrow("Only past years");
    await expect(
      deleteHistoricalYear(2027, { currentYear: 2026 })
    ).rejects.toThrow("Only past years");
  });

  it("deletes transactions, yearly configs, budget year, and empty archived categories", async () => {
    mockFindUnique.mockResolvedValue({ id: "by-2019", year: 2019 });

    const res = await deleteHistoricalYear(2019, {
      currentYear: 2026,
      cleanupEmptyArchivedCategories: true,
    });

    expect(res).toEqual({
      year: 2019,
      transactionsDeleted: 14,
      yearlyCategoriesDeleted: 8,
      archivedCategoriesCleaned: 2,
    });
    expect(mockTx.transaction.deleteMany).toHaveBeenCalledWith({
      where: {
        date: {
          gte: new Date(Date.UTC(2019, 0, 1)),
          lt: new Date(Date.UTC(2020, 0, 1)),
        },
      },
    });
    expect(mockTx.yearlyCategory.deleteMany).toHaveBeenCalledWith({
      where: { yearId: "by-2019" },
    });
    expect(mockTx.budgetYear.delete).toHaveBeenCalledWith({
      where: { id: "by-2019" },
    });
    expect(mockTx.category.deleteMany).toHaveBeenCalledTimes(1);
  });

  it("skips archived category cleanup when cleanupEmptyArchivedCategories is false", async () => {
    mockFindUnique.mockResolvedValue({ id: "by-2019", year: 2019 });

    const res = await deleteHistoricalYear(2019, {
      currentYear: 2026,
      cleanupEmptyArchivedCategories: false,
    });

    expect(res.archivedCategoriesCleaned).toBe(0);
    expect(mockTx.category.deleteMany).not.toHaveBeenCalled();
  });
});
