import { providerStatusToPaymentStatus, providerStatuses } from "../src/domain/provider";
import { canTransition, type PaymentStatus } from "../src/domain/status";

// Every cell of the transition table in design.md › Payment status model,
// written out by hand rather than derived from `allowedTo`.
const cases: Array<[from: PaymentStatus, to: PaymentStatus, allowed: boolean]> = [
  ["pending", "pending", false],
  ["pending", "processing", true],
  ["pending", "failed", true],
  ["pending", "succeeded", true],

  ["processing", "pending", false],
  ["processing", "processing", false],
  ["processing", "failed", true],
  ["processing", "succeeded", true],

  ["failed", "pending", false],
  ["failed", "processing", false],
  ["failed", "failed", false],
  ["failed", "succeeded", true],

  ["succeeded", "pending", false],
  ["succeeded", "processing", false],
  ["succeeded", "failed", false],
  ["succeeded", "succeeded", false],
];

describe("canTransition", () => {
  it.each(cases)("%s → %s is %s", (from, to, allowed) => {
    expect(canTransition(from, to)).toBe(allowed);
  });
});

describe("provider status map", () => {
  it("maps every provider status to our status of the same name", () => {
    for (const s of providerStatuses) {
      expect(providerStatusToPaymentStatus[s]).toBe(s);
    }
  });
});
