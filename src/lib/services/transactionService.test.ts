import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    transaction: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { getTransactions } from "./transactionService";

const mockFindMany = prisma.transaction.findMany as ReturnType<typeof vi.fn>;

describe("getTransactions universal search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
  });

  it("queries across all years matching payee, split memo, category, external order items, and account", async () => {
    await getTransactions({ search: "ground beef", includeHidden: true });

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    const args = mockFindMany.mock.calls[0][0];
    expect(args.where.date).toBeUndefined();
    expect(args.where.OR).toEqual([
      { payee: { contains: "ground beef", mode: "insensitive" } },
      { splits: { some: { memo: { contains: "ground beef", mode: "insensitive" } } } },
      { splits: { some: { category: { name: { contains: "ground beef", mode: "insensitive" } } } } },
      { externalOrder: { items: { some: { title: { contains: "ground beef", mode: "insensitive" } } } } },
      { account: { name: { contains: "ground beef", mode: "insensitive" } } },
      { account: { displayName: { contains: "ground beef", mode: "insensitive" } } },
    ]);
  });

  it("adds positive and negative amount matches when search is numeric", async () => {
    await getTransactions({ search: "$42.50" });

    const args = mockFindMany.mock.calls[0][0];
    expect(args.where.OR).toContainEqual({ amount: 42.5 });
    expect(args.where.OR).toContainEqual({ amount: -42.5 });
  });

  it("filters by calendar year when year is provided", async () => {
    await getTransactions({ year: 2025 });

    const args = mockFindMany.mock.calls[0][0];
    expect(args.where.date).toEqual({
      gte: new Date(Date.UTC(2025, 0, 1)),
      lt: new Date(Date.UTC(2026, 0, 1)),
    });
  });
});
