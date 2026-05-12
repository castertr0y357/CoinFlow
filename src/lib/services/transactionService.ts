import prisma from "@/lib/prisma";

export async function getTransactions(options: { 
  take?: number, 
  skip?: number, 
  inboxOnly?: boolean,
  includeHidden?: boolean,
  hiddenOnly?: boolean 
} = {}) {
  const { take = 1000, skip = 0, inboxOnly = false, includeHidden = false, hiddenOnly = false } = options;

  const where: any = {
    account: {
      excludeFromSurplus: false
    }
  };

  if (hiddenOnly) {
    where.isHidden = true;
  } else if (inboxOnly) {
    where.splits = {
      some: {
        categoryId: null
      }
    };
    where.isHidden = false;
  } else if (!includeHidden) {
    where.isHidden = false;
  }

  return prisma.transaction.findMany({
    where,
    orderBy: { date: 'desc' },
    include: { 
      splits: true, 
      externalOrder: {
        include: {
          items: true
        }
      },
      account: true
    },
    take,
    skip
  });
}


export async function getCategories() {
  return prisma.category.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function categorizeSplit(splitId: string, categoryId: string | null) {
  return prisma.transactionSplit.update({
    where: { id: splitId },
    data: { categoryId },
  });
}

export async function addSplit(transactionId: string, amount: number, categoryId: string | null) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { splits: true }
  });

  if (!tx) throw new Error("Transaction not found");

  const uncategorizedSplit = tx.splits.find(s => s.categoryId === null);
  
  if (uncategorizedSplit && Math.abs(Number(uncategorizedSplit.amount)) >= Math.abs(amount)) {
    const newUncatAmount = Number(uncategorizedSplit.amount) - amount;
    
    return prisma.$transaction([
      prisma.transactionSplit.update({
        where: { id: uncategorizedSplit.id },
        data: { amount: newUncatAmount }
      }),
      prisma.transactionSplit.create({
        data: {
          transactionId,
          categoryId,
          amount: amount
        }
      })
    ]);
  } else {
    return prisma.transactionSplit.create({
      data: {
        transactionId,
        categoryId,
        amount: amount
      }
    });
  }
}

export async function applySplits(transactionId: string, splits: { categoryId: string | null, amount: number, memo?: string }[]) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId }
  });

  if (!transaction) throw new Error("Transaction not found");

  // Strict math validation: Sum of splits must equal transaction total
  const splitTotal = splits.reduce((acc, s) => acc + Number(s.amount), 0);
  const txAmount = Number(transaction.amount);

  // We use a small epsilon for floating point comparison if necessary, 
  // but since we're dealing with currency, 2 decimal places should be exact.
  if (Math.abs(splitTotal - txAmount) > 0.001) {
    throw new Error(`Split total ($${splitTotal.toFixed(2)}) does not match transaction total ($${txAmount.toFixed(2)})`);
  }

  return prisma.$transaction([
    // Remove existing splits
    prisma.transactionSplit.deleteMany({
      where: { transactionId }
    }),
    // Add new splits
    prisma.transactionSplit.createMany({
      data: splits.map(s => ({
        transactionId,
        categoryId: s.categoryId,
        amount: s.amount,
        memo: s.memo
      }))
    })
  ]);
}

export async function bulkCategorize(transactionIds: string[], categoryId: string | null) {
  return prisma.transactionSplit.updateMany({
    where: {
      transactionId: { in: transactionIds }
    },
    data: {
      categoryId
    }
  });
}



