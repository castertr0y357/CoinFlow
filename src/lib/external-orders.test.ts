import { describe, it, expect, beforeEach, afterEach } from "vitest";
import prisma from "./prisma";
import {
  processScrapedOrder,
  matchTransactionToPendingOrder,
  isOrderAlreadyMatched,
  detectSourceFromPayee,
} from "./external-orders";

describe("Two-Way External Order Matching and Auto-Pruning", () => {
  let testAccount: { id: string };

  beforeEach(async () => {
    // Ensure a test account exists
    testAccount = await prisma.account.upsert({
      where: { remoteId: "test-order-match-account" },
      update: {},
      create: {
        remoteId: "test-order-match-account",
        name: "Test Checking",
        currency: "USD",
      },
    });

    // Cleanup existing test data
    await prisma.transactionSplit.deleteMany({
      where: { transaction: { accountId: testAccount.id } },
    });
    await prisma.transaction.deleteMany({
      where: { accountId: testAccount.id },
    });
    await prisma.externalOrderItem.deleteMany({
      where: { externalOrder: { orderId: { startsWith: "TEST-ORDER-" } } },
    });
    await prisma.externalOrder.deleteMany({
      where: { orderId: { startsWith: "TEST-ORDER-" } },
    });
  });

  afterEach(async () => {
    // Cleanup
    await prisma.transactionSplit.deleteMany({
      where: { transaction: { accountId: testAccount.id } },
    });
    await prisma.transaction.deleteMany({
      where: { accountId: testAccount.id },
    });
    await prisma.externalOrderItem.deleteMany({
      where: { externalOrder: { orderId: { startsWith: "TEST-ORDER-" } } },
    });
    await prisma.externalOrder.deleteMany({
      where: { orderId: { startsWith: "TEST-ORDER-" } },
    });
  });

  it("detects source from various merchant payee formats", () => {
    expect(detectSourceFromPayee("Amazon.com*2A3B4C")).toBe("AMAZON");
    expect(detectSourceFromPayee("AMZN Mktp US*123")).toBe("AMAZON");
    expect(detectSourceFromPayee("Walmart Supercenter #1234")).toBe("WALMART");
    expect(detectSourceFromPayee("WM SUPERCENTER #99")).toBe("WALMART");
    expect(detectSourceFromPayee("LOWES #0123")).toBe("LOWES");
    expect(detectSourceFromPayee("Lowe's Home Improvement")).toBe("LOWES");
    expect(detectSourceFromPayee("Target Store #001")).toBe(null);
  });

  it("Scenario 1: Buffers order when no transaction exists, then auto-matches & prunes when transaction arrives", async () => {
    const orderId = "TEST-ORDER-001";
    const orderDate = new Date("2026-10-15T12:00:00Z");

    // 1. Extension scans order, but no bank transaction exists yet
    const scanResult = await processScrapedOrder({
      orderId,
      source: "AMAZON",
      date: orderDate,
      totalAmount: 45.50,
      items: [
        { title: "USB Cable", price: 15.50, quantity: 1 },
        { title: "Desk Lamp", price: 30.00, quantity: 1 },
      ],
    });

    expect(scanResult.matched).toBe(false);
    expect(scanResult.duplicate).toBe(false);

    // Verify order is buffered in ExternalOrder table
    const bufferedOrder = await prisma.externalOrder.findUnique({
      where: { orderId },
      include: { items: true },
    });
    expect(bufferedOrder).not.toBeNull();
    expect(bufferedOrder?.totalAmount.toNumber()).toBe(45.50);
    expect(bufferedOrder?.items.length).toBe(2);

    // 2. Later, bank transaction arrives via sync (within +3 days of order)
    const txDate = new Date("2026-10-17T08:00:00Z");
    const createdTx = await prisma.transaction.create({
      data: {
        accountId: testAccount.id,
        date: txDate,
        amount: -45.50,
        payee: "Amazon.com*1A2B3C",
        posted: true,
        splits: {
          create: {
            amount: -45.50,
            categoryId: null,
          },
        },
      },
    });

    // Run transaction-to-order matching
    const matched = await matchTransactionToPendingOrder(createdTx.id);
    expect(matched).toBe(true);

    // 3. Verify transaction now has splits and matchedOrderId
    const updatedTx = await prisma.transaction.findUnique({
      where: { id: createdTx.id },
      include: { splits: true },
    });
    expect(updatedTx?.matchedOrderId).toBe(orderId);
    expect(updatedTx?.matchedOrderSource).toBe("AMAZON");
    expect(updatedTx?.splits.length).toBe(2);

    const splitMemos = updatedTx?.splits.map(s => s.memo);
    expect(splitMemos).toContain("USB Cable");
    expect(splitMemos).toContain("Desk Lamp");

    // Total splits must equal -45.50
    const totalSplit = updatedTx?.splits.reduce((acc, s) => acc + s.amount.toNumber(), 0);
    expect(totalSplit).toBeCloseTo(-45.50, 2);

    // 4. Verify ExternalOrder is pruned from database to save space
    const prunedOrder = await prisma.externalOrder.findUnique({
      where: { orderId },
    });
    expect(prunedOrder).toBeNull();
  });

  it("Scenario 2: Matches immediately and prunes order if transaction already exists", async () => {
    const orderId = "TEST-ORDER-002";
    const txDate = new Date("2026-10-10T10:00:00Z");

    // 1. Transaction already exists in bank feed
    const existingTx = await prisma.transaction.create({
      data: {
        accountId: testAccount.id,
        date: txDate,
        amount: -25.00,
        payee: "AMZN MKTP US*PR99",
        posted: true,
        splits: {
          create: {
            amount: -25.00,
            categoryId: null,
          },
        },
      },
    });

    // 2. Browser extension scans order on 2026-10-10
    const scanResult = await processScrapedOrder({
      orderId,
      source: "AMAZON",
      date: txDate,
      totalAmount: 25.00,
      items: [
        { title: "Wireless Mouse", price: 25.00, quantity: 1 },
      ],
    });

    expect(scanResult.matched).toBe(true);
    expect(scanResult.duplicate).toBe(false);
    expect(scanResult.transactionId).toBe(existingTx.id);

    // 3. Transaction is split and tagged
    const updatedTx = await prisma.transaction.findUnique({
      where: { id: existingTx.id },
      include: { splits: true },
    });
    expect(updatedTx?.matchedOrderId).toBe(orderId);
    expect(updatedTx?.matchedOrderSource).toBe("AMAZON");
    expect(updatedTx?.splits.length).toBe(1);
    expect(updatedTx?.splits[0].memo).toBe("Wireless Mouse");

    // 4. Order is NOT left in ExternalOrder table
    const storedOrder = await prisma.externalOrder.findUnique({
      where: { orderId },
    });
    expect(storedOrder).toBeNull();
  });

  it("Scenario 3: Discards duplicate scans if order was already matched", async () => {
    const orderId = "TEST-ORDER-003";

    // 1. Create a transaction that is already matched to this orderId
    await prisma.transaction.create({
      data: {
        accountId: testAccount.id,
        date: new Date("2026-10-12T00:00:00Z"),
        amount: -19.99,
        payee: "Walmart.com 8009666546",
        matchedOrderId: orderId,
        matchedOrderSource: "WALMART",
        posted: true,
        splits: {
          create: {
            amount: -19.99,
            categoryId: null,
            memo: "Previous Matched Item",
          },
        },
      },
    });

    // 2. isOrderAlreadyMatched should return true
    const alreadyMatched = await isOrderAlreadyMatched(orderId);
    expect(alreadyMatched).toBe(true);

    // 3. Rescanning the order should be rejected as a duplicate
    const scanResult = await processScrapedOrder({
      orderId,
      source: "WALMART",
      date: new Date("2026-10-12T00:00:00Z"),
      totalAmount: 19.99,
      items: [
        { title: "Previous Matched Item", price: 19.99, quantity: 1 },
      ],
    });

    expect(scanResult.duplicate).toBe(true);

    // Ensure no ExternalOrder was created
    const orderInDb = await prisma.externalOrder.findUnique({
      where: { orderId },
    });
    expect(orderInDb).toBeNull();
  });
});
