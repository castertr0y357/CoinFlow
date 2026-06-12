import { describe, it, expect, vi, beforeAll, afterAll, type MockInstance } from "vitest";
import { NextRequest } from "next/server";
import { GET as getBackgroundSync } from "./api/v1/sync/background/route";
import { GET as getRefundMatches } from "./api/v1/transactions/refund-matches/route";
import { GET as getGoals } from "./api/v1/goals/route";

vi.mock("next/headers", () => {
  return {
    cookies: async () => {
      return {
        get: () => undefined,
      };
    },
  };
});

describe("Route Scanner - API Sanity Checks", () => {
  let consoleErrorSpy: MockInstance;

  beforeAll(() => {
    // Capture console.error to check for unexpected failures or standard violations
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it("should compile and execute /api/v1/goals route handler", async () => {
    try {
      const response = await getGoals();
      expect(response.status).not.toBe(500);
      
      const json = await response.json();
      expect(json).toBeDefined();
      if (response.status === 200) {
        expect(json.goals).toBeDefined();
      }
    } catch (err) {
      // If there is an actual runtime crash (like prisma connection failing in some test runners),
      // we still assert that it shouldn't crash.
      console.error("Goals API crash:", err);
      throw err;
    }
  });

  it("should compile and execute /api/v1/sync/background route handler", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/sync/background", {
      method: "GET",
    });

    const response = await getBackgroundSync(req);
    // Should return 401 Unauthorized because we didn't provide a valid X-API-KEY,
    // which proves the route handler loaded and processed the auth guard.
    expect(response.status).toBe(401);
  });

  it("should compile and execute /api/v1/transactions/refund-matches route handler", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/transactions/refund-matches", {
      method: "GET",
    });

    const response = await getRefundMatches(req);
    // Should return 401 Unauthorized due to lack of API key, demonstrating auth guard works.
    expect(response.status).toBe(401);
  });
});
