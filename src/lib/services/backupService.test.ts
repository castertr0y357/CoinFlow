import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import zlib from "zlib";
import { EventEmitter } from "events";
import * as childProcess from "child_process";
import {
  dumpDatabaseSqlGz,
  restoreDatabaseSql,
  restoreDatabaseFromBuffer,
  determineGfsTier,
} from "./backupService";

vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    settings: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    backupRecord: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ pg_try_advisory_lock: true }]),
  },
}));

interface MockChildProcess extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: EventEmitter & {
    write: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
}

function createMockProcess(): MockChildProcess {
  const proc = new EventEmitter() as MockChildProcess;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  const stdinEmitter = new EventEmitter();
  proc.stdin = Object.assign(stdinEmitter, {
    write: vi.fn(),
    end: vi.fn(),
  });
  return proc;
}

describe("backupService - SQL.gz Database Dump, Restore & GFS", () => {
  const originalEnv = process.env.DATABASE_URL;

  beforeEach(() => {
    process.env.DATABASE_URL = "postgresql://budgetuser:budgetpassword@localhost:5432/webbudget";
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.DATABASE_URL = originalEnv;
  });

  it("should classify GFS tiers correctly based on monthly and weekly day settings", () => {
    const config = { backupWeeklyDay: 0, backupMonthlyDay: 1 }; // Sunday & 1st of month

    // 2026-11-01 is Sunday and 1st of month -> Monthly takes priority
    const monthlyDate = new Date(Date.UTC(2026, 10, 1));
    expect(determineGfsTier(monthlyDate, config)).toBe("MONTHLY");

    // 2026-11-08 is Sunday (8th of month) -> Weekly
    const weeklyDate = new Date(Date.UTC(2026, 10, 8));
    expect(determineGfsTier(weeklyDate, config)).toBe("WEEKLY");

    // 2026-11-09 is Monday (9th of month) -> Daily
    const dailyDate = new Date(Date.UTC(2026, 10, 9));
    expect(determineGfsTier(dailyDate, config)).toBe("DAILY");
  });

  it("should reject dumpDatabaseSqlGz when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    await expect(dumpDatabaseSqlGz()).rejects.toThrow("DATABASE_URL environment variable is not configured");
  });

  it("should spawn pg_dump with clean slate flags and return gzipped SQL buffer", async () => {
    const mockProc = createMockProcess();
    vi.mocked(childProcess.spawn).mockReturnValue(mockProc as unknown as childProcess.ChildProcess);

    const sampleSql = "-- PostgreSQL database dump\nDROP TABLE IF EXISTS public.account;\nCREATE TABLE public.account ();\n";
    const promise = dumpDatabaseSqlGz();

    mockProc.stdout.emit("data", Buffer.from(sampleSql, "utf-8"));
    mockProc.emit("close", 0);

    const result = await promise;
    expect(childProcess.spawn).toHaveBeenCalledWith("pg_dump", [
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-privileges",
      "--dbname",
      "postgresql://budgetuser:budgetpassword@localhost:5432/webbudget",
    ]);

    const decompressed = zlib.gunzipSync(result).toString("utf-8");
    expect(decompressed).toBe(sampleSql);
  });

  it("should reject dumpDatabaseSqlGz when pg_dump exits with non-zero code", async () => {
    const mockProc = createMockProcess();
    vi.mocked(childProcess.spawn).mockReturnValue(mockProc as unknown as childProcess.ChildProcess);

    const promise = dumpDatabaseSqlGz();
    mockProc.stderr.emit("data", Buffer.from("pg_dump: error: connection to server failed", "utf-8"));
    mockProc.emit("close", 1);

    await expect(promise).rejects.toThrow("pg_dump exited with code 1: pg_dump: error: connection to server failed");
  });

  it("should gunzip .sql.gz buffer and pipe SQL into psql during restoreDatabaseFromBuffer", async () => {
    const mockProc = createMockProcess();
    vi.mocked(childProcess.spawn).mockImplementation(() => {
      process.nextTick(() => mockProc.emit("close", 0));
      return mockProc as unknown as childProcess.ChildProcess;
    });

    const sampleSql = "SELECT 1;";
    const gzipped = zlib.gzipSync(Buffer.from(sampleSql, "utf-8"));

    await restoreDatabaseFromBuffer(gzipped, "coinflow_manual_2026-10-21.sql.gz");

    expect(childProcess.spawn).toHaveBeenCalledWith("psql", [
      "-v",
      "ON_ERROR_STOP=1",
      "--dbname",
      "postgresql://budgetuser:budgetpassword@localhost:5432/webbudget",
    ]);
    expect(mockProc.stdin.write).toHaveBeenCalledWith(sampleSql);
    expect(mockProc.stdin.end).toHaveBeenCalled();
  });

  it("should strip SET transaction_timeout for PostgreSQL 15 compatibility", async () => {
    const mockProc = createMockProcess();
    vi.mocked(childProcess.spawn).mockReturnValue(mockProc as unknown as childProcess.ChildProcess);

    const rawSql = "SET statement_timeout = 0;\nSET transaction_timeout = 0;\nSELECT 1;\n";
    const promise = dumpDatabaseSqlGz();

    mockProc.stdout.emit("data", Buffer.from(rawSql, "utf-8"));
    mockProc.emit("close", 0);

    const result = await promise;
    const decompressed = zlib.gunzipSync(result).toString("utf-8");
    expect(decompressed).toBe("SET statement_timeout = 0;\nSELECT 1;\n");
  });

  it("should reject restoreDatabaseSql when psql fails with non-zero exit code", async () => {
    const mockProc = createMockProcess();
    vi.mocked(childProcess.spawn).mockReturnValue(mockProc as unknown as childProcess.ChildProcess);

    const promise = restoreDatabaseSql("INVALID SQL;");
    mockProc.stderr.emit("data", Buffer.from("ERROR: syntax error at or near \"INVALID\"", "utf-8"));
    mockProc.emit("close", 3);

    await expect(promise).rejects.toThrow("psql exited with code 3: ERROR: syntax error at or near \"INVALID\"");
  });
});
