import { paymentStatus } from "../db/schema";

export type PaymentStatus = (typeof paymentStatus.enumValues)[number];

// Keyed by current status: the statuses it may move to, like the state diagram.
// currently, status only moves up.
// Lives here, not in the enum's declaration order, so a future non-linear
// flow can add edges such as `succeeded: ['refunded']`.
export const allowedTo: Record<PaymentStatus, readonly PaymentStatus[]> = {
  pending: ["processing", "failed", "succeeded"],
  processing: ["failed", "succeeded"],
  failed: ["succeeded"],
  succeeded: [],
};

// false means the event is recorded as `ignored` and acknowledged with 200,
// never rejected: a retry could never make it valid.
export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return allowedTo[from].includes(to);
}
