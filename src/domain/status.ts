import { paymentStatus } from "../db/schema";

export type PaymentStatus = (typeof paymentStatus.enumValues)[number];

// Status only moves up: pending → processing → failed → succeeded.
// Keyed by current status: the statuses it may move to, like the state diagram.
// Nothing moves to `pending` (initial status only); `succeeded` is terminal.
// Lives here, not in the enum's declaration order, so a future non-linear
// flow can add edges such as `succeeded: ['refunded']`.
// See design.md › Payment status model.
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
