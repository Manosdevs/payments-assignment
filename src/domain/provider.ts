import type { PaymentStatus } from "./status";

// The simulated provider's status vocabulary, as sent in webhooks.
// Each future provider gets its own map. See design.md › API › POST /webhooks/payments.
export const providerStatuses = ["processing", "succeeded", "failed"] as const;

export type ProviderStatus = (typeof providerStatuses)[number];

export const providerStatusToPaymentStatus: Record<ProviderStatus, PaymentStatus> = {
  processing: "processing",
  succeeded: "succeeded",
  failed: "failed",
};
