import { describe, expect, it } from "vitest";

import { CorsairInboxService } from "./inbox";
import { createE2eMockInboxService } from "./inbox-e2e-mock";

describe("createE2eMockInboxService", () => {
  it("overrides targeted methods while preserving all prototype methods", async () => {
    const realService = new CorsairInboxService();
    const mockService = createE2eMockInboxService(realService);

    // Overridden methods
    const status = await mockService.getConnectionStatus("demo-tenant");
    expect(status).toEqual({ gmail: "connected" });

    // Prototype methods must exist and be callable
    expect(typeof mockService.listCachedThreads).toBe("function");
    expect(typeof mockService.listThreads).toBe("function");
    expect(typeof mockService.listLabels).toBe("function");
    expect(typeof mockService.getThread).toBe("function");

    // Calling a prototype method should not throw "is not a function"
    const cached = await mockService.listCachedThreads("00000000-0000-0000-0000-000000000000", { limit: 5 });
    expect(cached).toBeDefined();
    expect(Array.isArray(cached.threads)).toBe(true);
  });
});
