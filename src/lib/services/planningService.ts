import prisma from "@/lib/prisma";
import { getPaycheckDatesInMonth } from "./budgetService";
import { isInvestmentAccountName } from "./netWorthService";

function safeNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

export interface CashFlowEvent {
  dateKey: string;
  dateLabel: string;
  name: string;
  amount: number; // positive = inflow, negative = outflow
  type: "income" | "commitment" | "card" | "variable";
  runningBalance: number;
}

export interface CashFlowDayPoint {
  dateKey: string;
  dateLabel: string;
  balance: number;
  netDelta: number;
}

export interface CashFlowCommitmentInput {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  nextDueDate: Date | string | null;
}

export interface BuildCashFlowInput {
  startDate: Date;
  horizonDays: number;
  startingCash: number;
  safetyBuffer: number;
  includeCreditCards: boolean;
  creditCardBalance: number;
  cardAutopayDay?: number;
  paycheckEnabled: boolean;
  paycheckAmount: number;
  paycheckFrequency: string;
  paycheckNextDate: Date | string | null;
  monthlyIncome: number;
  monthlyVariableSpend?: number;
  commitments: CashFlowCommitmentInput[];
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toDateLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function addMonthsClamped(base: Date, months: number): Date {
  const targetMonth = base.getMonth() + months;
  const targetYear = base.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const maxDays = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  return new Date(targetYear, normalizedMonth, Math.min(base.getDate(), maxDays));
}

function getCommitmentOccurrences(
  c: CashFlowCommitmentInput,
  windowStart: Date,
  windowEnd: Date
): Date[] {
  const dates: Date[] = [];
  const freq = (c.frequency || "MONTHLY").toUpperCase();
  const baseRaw = c.nextDueDate ? new Date(c.nextDueDate) : new Date(windowStart.getFullYear(), windowStart.getMonth(), 1);
  if (isNaN(baseRaw.getTime())) return dates;

  let cur = new Date(baseRaw.getFullYear(), baseRaw.getMonth(), baseRaw.getDate());

  if (freq === "WEEKLY" || freq === "BI_WEEKLY" || freq === "BIWEEKLY") {
    const stepDays = freq === "WEEKLY" ? 7 : 14;
    while (cur < windowStart) {
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + stepDays);
    }
    while (cur <= windowEnd) {
      dates.push(new Date(cur));
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + stepDays);
    }
    return dates;
  }

  const monthStep = freq === "YEARLY" || freq === "ANNUAL" ? 12 : freq === "QUARTERLY" ? 3 : 1;
  let stepIdx = 0;
  while (cur < windowStart && stepIdx < 240) {
    stepIdx++;
    cur = addMonthsClamped(baseRaw, stepIdx * monthStep);
  }
  while (cur <= windowEnd && stepIdx < 260) {
    dates.push(new Date(cur));
    stepIdx++;
    cur = addMonthsClamped(baseRaw, stepIdx * monthStep);
  }
  return dates;
}

export function buildCashFlowTimeline(input: BuildCashFlowInput) {
  const start = new Date(input.startDate.getFullYear(), input.startDate.getMonth(), input.startDate.getDate());
  const windowStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  const windowEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() + input.horizonDays);

  const dayEventsMap = new Map<string, Omit<CashFlowEvent, "runningBalance">[]>();
  const pushEvent = (d: Date, ev: Omit<CashFlowEvent, "runningBalance" | "dateKey" | "dateLabel">) => {
    const key = toDateKey(d);
    const list = dayEventsMap.get(key) || [];
    list.push({
      dateKey: key,
      dateLabel: toDateLabel(d),
      ...ev,
    });
    dayEventsMap.set(key, list);
  };

  // 1. Paychecks / Income inflows
  const monthsToCheck: { year: number; month: number }[] = [];
  const cursorMonth = new Date(windowStart.getFullYear(), windowStart.getMonth(), 1);
  while (cursorMonth <= windowEnd) {
    monthsToCheck.push({ year: cursorMonth.getFullYear(), month: cursorMonth.getMonth() });
    cursorMonth.setMonth(cursorMonth.getMonth() + 1);
  }

  if (input.paycheckEnabled && input.paycheckAmount > 0 && input.paycheckNextDate) {
    const refDate = new Date(input.paycheckNextDate);
    if (!isNaN(refDate.getTime())) {
      for (const m of monthsToCheck) {
        const payDates = getPaycheckDatesInMonth(m.year, m.month, input.paycheckFrequency, refDate);
        for (const pd of payDates) {
          if (pd >= windowStart && pd <= windowEnd) {
            pushEvent(pd, { name: "Paycheck", amount: input.paycheckAmount, type: "income" });
          }
        }
      }
    }
  } else if (input.monthlyIncome > 0) {
    const halfIncome = Math.round((input.monthlyIncome / 2) * 100) / 100;
    for (const m of monthsToCheck) {
      for (const dayOfMonth of [1, 15]) {
        const d = new Date(m.year, m.month, dayOfMonth);
        if (d >= windowStart && d <= windowEnd) {
          pushEvent(d, { name: "Estimated Income", amount: halfIncome, type: "income" });
        }
      }
    }
  }

  // 2. Commitments
  for (const c of input.commitments) {
    if (c.amount <= 0) continue;
    const occs = getCommitmentOccurrences(c, windowStart, windowEnd);
    for (const d of occs) {
      pushEvent(d, { name: c.name, amount: -Math.abs(c.amount), type: "commitment" });
    }
  }

  // 3. Optional Credit Card Statement Payoff
  if (input.includeCreditCards && input.creditCardBalance > 0) {
    const autopayDay = Math.min(28, Math.max(1, input.cardAutopayDay || 15));
    let cardDate = new Date(windowStart.getFullYear(), windowStart.getMonth(), autopayDay);
    if (cardDate < windowStart) {
      cardDate = new Date(windowStart.getFullYear(), windowStart.getMonth() + 1, autopayDay);
    }
    if (cardDate <= windowEnd) {
      pushEvent(cardDate, {
        name: "Credit Card Statement Payoffs",
        amount: -Math.abs(input.creditCardBalance),
        type: "card",
      });
    }
  }

  // 3b. Variable / Everyday Budget Spending (weekly slice of non-commitment monthly spend)
  if (input.monthlyVariableSpend && input.monthlyVariableSpend > 0) {
    const weeklyVariable = Math.round(((input.monthlyVariableSpend * 12) / 52) * 100) / 100;
    for (let dayOffset = 7; dayOffset <= input.horizonDays; dayOffset += 7) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + dayOffset);
      pushEvent(d, {
        name: "Everyday Budget / Avg Purchases",
        amount: -weeklyVariable,
        type: "variable",
      });
    }
  }

  // 4. Walk day by day
  let balance = Math.round(input.startingCash * 100) / 100;
  let lowestBalance = balance;
  let lowestDate = toDateLabel(start);
  const points: CashFlowDayPoint[] = [
    { dateKey: toDateKey(start), dateLabel: toDateLabel(start), balance, netDelta: 0 },
  ];
  const events: CashFlowEvent[] = [];

  for (let i = 1; i <= input.horizonDays; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = toDateKey(d);
    const dayEvs = dayEventsMap.get(key) || [];
    // Process inflows before outflows on the same day
    dayEvs.sort((a, b) => b.amount - a.amount);

    let netDelta = 0;
    for (const ev of dayEvs) {
      balance = Math.round((balance + ev.amount) * 100) / 100;
      netDelta = Math.round((netDelta + ev.amount) * 100) / 100;
      events.push({ ...ev, runningBalance: balance });
    }

    if (balance < lowestBalance) {
      lowestBalance = balance;
      lowestDate = toDateLabel(d);
    }

    points.push({
      dateKey: key,
      dateLabel: toDateLabel(d),
      balance,
      netDelta,
    });
  }

  const safeToSweep = Math.max(0, Math.round((lowestBalance - input.safetyBuffer) * 100) / 100);

  return {
    startingCash: Math.round(input.startingCash * 100) / 100,
    lowestBalance,
    lowestDate,
    endingBalance: balance,
    safeToSweep,
    points,
    events,
  };
}

export interface WealthProjectionInput {
  currentInvestments: number;
  currentCash: number;
  monthlyContribution: number;
  annualReturnPct: number;
  years: number;
  fiTarget: number;
  mortgage: {
    balance: number;
    interestRate: number;
    monthlyPayment: number;
  } | null;
  redirectMortgageAfterPayoff: boolean;
  startYear?: number;
}

export interface WealthYearPoint {
  yearOffset: number;
  calendarYear: number;
  baseline: number;
  accelerated: number;
  mortgageRemaining: number;
}

export function buildWealthProjection(input: WealthProjectionInput) {
  const startYear = input.startYear ?? new Date().getFullYear();
  const totalMonths = Math.max(1, input.years) * 12;
  const monthlyRate = input.annualReturnPct / 100 / 12;

  let baseline = input.currentInvestments;
  let accelerated = input.currentInvestments;
  let mortgageBal = input.mortgage ? Math.max(0, input.mortgage.balance) : 0;
  const mortgageMonthlyRate = input.mortgage ? input.mortgage.interestRate / 100 / 12 : 0;
  const mortgagePmt = input.mortgage ? Math.max(0, input.mortgage.monthlyPayment) : 0;

  let mortgagePayoffMonth: number | null = mortgageBal === 0 ? 0 : null;
  let fiTargetYearBaseline: number | null = baseline >= input.fiTarget ? startYear : null;
  let fiTargetYearAccelerated: number | null = accelerated >= input.fiTarget ? startYear : null;

  const schedule: WealthYearPoint[] = [
    {
      yearOffset: 0,
      calendarYear: startYear,
      baseline: Math.round(baseline),
      accelerated: Math.round(accelerated),
      mortgageRemaining: Math.round(mortgageBal),
    },
  ];

  for (let m = 1; m <= totalMonths; m++) {
    // Advance mortgage
    let mortgageFreedUp = false;
    if (mortgageBal > 0 && mortgagePmt > 0) {
      const interest = mortgageBal * mortgageMonthlyRate;
      const principal = Math.max(0, mortgagePmt - interest);
      if (principal <= 0 && interest > 0) {
        // Payment doesn't cover interest; avoid infinite loop
        mortgageBal = Math.max(0, mortgageBal);
      } else {
        mortgageBal = Math.max(0, mortgageBal - principal);
      }
      if (mortgageBal === 0 && mortgagePayoffMonth === null) {
        mortgagePayoffMonth = m;
      }
    } else if (mortgageBal === 0 && input.mortgage) {
      mortgageFreedUp = true;
    }

    baseline = baseline * (1 + monthlyRate) + input.monthlyContribution;
    const extraContrib =
      input.redirectMortgageAfterPayoff && mortgageFreedUp ? mortgagePmt : 0;
    accelerated = accelerated * (1 + monthlyRate) + input.monthlyContribution + extraContrib;

    const calYear = startYear + Math.ceil(m / 12);
    if (fiTargetYearBaseline === null && baseline >= input.fiTarget) {
      fiTargetYearBaseline = calYear;
    }
    if (fiTargetYearAccelerated === null && accelerated >= input.fiTarget) {
      fiTargetYearAccelerated = calYear;
    }

    if (m % 12 === 0) {
      schedule.push({
        yearOffset: m / 12,
        calendarYear: startYear + m / 12,
        baseline: Math.round(baseline),
        accelerated: Math.round(accelerated),
        mortgageRemaining: Math.round(mortgageBal),
      });
    }
  }

  return {
    schedule,
    finalBaseline: Math.round(baseline),
    finalAccelerated: Math.round(accelerated),
    mortgageBoost: Math.round(accelerated - baseline),
    mortgagePayoffYear:
      mortgagePayoffMonth !== null ? startYear + Math.ceil(mortgagePayoffMonth / 12) : null,
    fiTargetYearBaseline,
    fiTargetYearAccelerated,
  };
}

function toMonthlyCommitmentAmount(amount: number, frequency: string): number {
  const freq = (frequency || "MONTHLY").toUpperCase();
  if (freq === "WEEKLY") return (amount * 52) / 12;
  if (freq === "BI_WEEKLY" || freq === "BIWEEKLY") return (amount * 26) / 12;
  if (freq === "QUARTERLY") return amount / 3;
  if (freq === "YEARLY" || freq === "ANNUAL") return amount / 12;
  return amount;
}

export async function getCashFlowPageData() {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);

  const [accounts, commitments, settings, mortgages, yearlyCategories] = await Promise.all([
    prisma.account.findMany({ orderBy: { name: "asc" } }),
    prisma.commitment.findMany({ orderBy: { nextDueDate: "asc" } }),
    prisma.settings.findUnique({ where: { id: "global" } }),
    prisma.mortgageDetail.findMany({ select: { accountId: true } }),
    prisma.yearlyCategory.findMany({
      where: { year: { year: now.getFullYear() }, category: { isPaused: false, tiedAccountId: null } },
      select: { categoryId: true, monthlyBudget: true },
    }),
  ]);

  const activeCategoryIds = yearlyCategories.map((yc) => yc.categoryId);
  const recentSplits = activeCategoryIds.length > 0
    ? await prisma.transactionSplit.groupBy({
        by: ["categoryId"],
        where: {
          categoryId: { in: activeCategoryIds },
          amount: { lt: 0 },
          transaction: { isHidden: false, date: { gte: ninetyDaysAgo } },
        },
        _sum: { amount: true },
      })
    : [];

  const splitSumMap = new Map<string, number>();
  for (const row of recentSplits) {
    if (row.categoryId) {
      splitSumMap.set(row.categoryId, Math.abs(safeNumber(row._sum.amount)));
    }
  }

  const commitmentMonthlyByCat = new Map<string, number>();
  for (const c of commitments) {
    if (c.categoryId) {
      const prev = commitmentMonthlyByCat.get(c.categoryId) || 0;
      commitmentMonthlyByCat.set(c.categoryId, prev + toMonthlyCommitmentAmount(safeNumber(c.amount), c.frequency));
    }
  }

  let monthlyVariableBudget = 0;
  let monthlyAvgVariableSpend = 0;
  for (const yc of yearlyCategories) {
    const catCommitments = commitmentMonthlyByCat.get(yc.categoryId) || 0;
    const catBudget = safeNumber(yc.monthlyBudget);
    const catAvgSpend = (splitSumMap.get(yc.categoryId) || 0) / 3;
    monthlyVariableBudget += Math.max(0, catBudget - catCommitments);
    monthlyAvgVariableSpend += Math.max(0, catAvgSpend - catCommitments);
  }
  monthlyVariableBudget = Math.round(monthlyVariableBudget * 100) / 100;
  monthlyAvgVariableSpend = Math.round(monthlyAvgVariableSpend * 100) / 100;

  const mortgageAccountIds = new Set(mortgages.map((m) => m.accountId));

  const liquidCashAccounts = accounts.filter((a) => !a.isDebt && !a.excludeFromSurplus);
  const startingCash = liquidCashAccounts.reduce((sum, a) => sum + safeNumber(a.balance), 0);

  const creditCardAccounts = accounts.filter(
    (a) => a.isDebt && !mortgageAccountIds.has(a.id) && !a.excludeFromAssetCalculation
  );
  const creditCardBalance = creditCardAccounts.reduce(
    (sum, a) => sum + Math.abs(safeNumber(a.balance)),
    0
  );

  return {
    startingCash,
    creditCardBalance,
    liquidAccounts: liquidCashAccounts.map((a) => ({
      id: a.id,
      name: a.displayName || a.name,
      balance: safeNumber(a.balance),
    })),
    paycheckEnabled: settings?.paycheckEnabled ?? false,
    paycheckAmount: safeNumber(settings?.paycheckAmount),
    paycheckFrequency: settings?.paycheckFrequency ?? "BI_WEEKLY",
    paycheckNextDate: settings?.paycheckNextDate ? settings.paycheckNextDate.toISOString() : null,
    monthlyIncome: safeNumber(settings?.monthlyIncome ?? 5000),
    monthlyVariableBudget,
    monthlyAvgVariableSpend,
    commitments: commitments.map((c) => ({
      id: c.id,
      name: c.name,
      amount: safeNumber(c.amount),
      frequency: c.frequency,
      nextDueDate: c.nextDueDate ? c.nextDueDate.toISOString() : null,
    })),
  };
}

export async function getWealthPageData() {
  const [accounts, settings, mortgage, recentCategories] = await Promise.all([
    prisma.account.findMany({ orderBy: { name: "asc" } }),
    prisma.settings.findUnique({ where: { id: "global" } }),
    prisma.mortgageDetail.findFirst({
      include: { account: { select: { balance: true } } },
    }),
    prisma.yearlyCategory.findMany({
      where: { year: { year: new Date().getFullYear() }, category: { isPaused: false, tiedAccountId: null } },
      select: { monthlyBudget: true },
    }),
  ]);

  const investmentAccounts = accounts.filter(
    (a) => !a.isDebt && !a.excludeFromAssetCalculation && isInvestmentAccountName(a.displayName || a.name, a.type)
  );
  const currentInvestments = investmentAccounts.reduce((sum, a) => sum + safeNumber(a.balance), 0);

  const currentCash = accounts
    .filter((a) => !a.isDebt && !a.excludeFromSurplus)
    .reduce((sum, a) => sum + safeNumber(a.balance), 0);

  const totalAnnualBudget = recentCategories.reduce((sum, c) => sum + safeNumber(c.monthlyBudget) * 12, 0);
  const defaultFiTarget = totalAnnualBudget > 0 ? Math.round(totalAnnualBudget * 25) : 1500000;
  const defaultContribution = Math.max(500, safeNumber(settings?.savingsTarget ?? 1000));

  return {
    currentInvestments,
    currentCash,
    defaultContribution,
    defaultFiTarget,
    investmentAccounts: investmentAccounts.map((a) => ({
      id: a.id,
      name: a.displayName || a.name,
      balance: safeNumber(a.balance),
    })),
    mortgage: mortgage
      ? {
          balance: Math.abs(safeNumber(mortgage.account?.balance ?? mortgage.originalBalance)),
          interestRate: safeNumber(mortgage.interestRate),
          monthlyPayment: safeNumber(mortgage.monthlyPayment),
        }
      : null,
  };
}
