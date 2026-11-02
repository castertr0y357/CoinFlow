import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { runSeed } from '../../prisma/seed';

describe('Database Seeding (prisma/seed.ts)', () => {
  function createMockPrisma(existingCategoryCount: number) {
    return {
      settings: {
        upsert: vi.fn().mockResolvedValue({ id: 'global' }),
      },
      category: {
        count: vi.fn().mockResolvedValue(existingCategoryCount),
        upsert: vi.fn().mockResolvedValue({}),
      },
      user: {
        upsert: vi.fn().mockResolvedValue({ id: 'user-1', email: 'admin@webbudget.local' }),
      },
      apiKey: {
        upsert: vi.fn().mockResolvedValue({ id: 'key-1' }),
      },
    } as unknown as PrismaClient;
  }

  it('seeds default categories when no categories exist in the database', async () => {
    const mockPrisma = createMockPrisma(0);
    await runSeed(mockPrisma);

    expect(mockPrisma.category.count).toHaveBeenCalledTimes(1);
    expect(mockPrisma.category.upsert).toHaveBeenCalledTimes(6);
  });

  it('does not create default categories when categories already exist in the database', async () => {
    const mockPrisma = createMockPrisma(3);
    await runSeed(mockPrisma);

    expect(mockPrisma.category.count).toHaveBeenCalledTimes(1);
    expect(mockPrisma.category.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.settings.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.apiKey.upsert).toHaveBeenCalledTimes(1);
  });
});
