import type { InboxService } from "@repo/services/inbox";

/**
 * Wraps the real inbox service so Playwright can exercise compose → queue → approve
 * without live Gmail OAuth. Enabled when THREAD_E2E_MOCK_GMAIL=true (CI / local E2E).
 *
 * Uses Proxy to preserve class prototype methods on `inner` while overriding specific methods.
 */
export function createE2eMockInboxService(inner: InboxService): InboxService {
  const overrides: Partial<InboxService> = {
    getConnectionStatus(tenantId) {
      void tenantId;
      return Promise.resolve({ gmail: "connected" as const });
    },
    sendMessage(tenantId, input) {
      void tenantId;
      return Promise.resolve({
        id: `e2e-msg-${Date.now()}`,
        threadId: input.threadId ?? `e2e-thread-${Date.now()}`,
      });
    },
    createDraft(tenantId, input) {
      void tenantId;
      void input;
      return Promise.resolve({ id: `e2e-draft-${Date.now()}` });
    },
  };

  return new Proxy(inner, {
    get(target, prop, receiver) {
      if (prop in overrides) {
        return Reflect.get(overrides, prop, receiver);
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(receiver) : value;
    },
  });
}
