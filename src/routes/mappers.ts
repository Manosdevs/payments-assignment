import type { Order } from "../db/schema";
import { providerStatusToPaymentStatus } from "../domain/provider";
import type { CheckoutInput } from "../services/checkout";
import type { WebhookInput } from "../services/webhook";
import type { CheckoutBody } from "./orders";
import type { WebhookBody } from "./webhooks";

// The one place where API snake_case meets internal camelCase.

export function fromCheckoutBody(body: CheckoutBody): CheckoutInput {
  return {
    merchantId: body.merchant_id,
    orderReference: body.order_reference,
    amount: body.amount,
    currency: body.currency,
  };
}

// Also maps the provider's status vocabulary to ours.
export function fromWebhookBody(body: WebhookBody): WebhookInput {
  return {
    eventId: body.event_id,
    orderId: body.order_id,
    status: providerStatusToPaymentStatus[body.status],
    occurredAt: new Date(body.occurred_at),
  };
}

export function toOrderResponse(order: Order) {
  return {
    id: order.id,
    merchant_id: order.merchantId,
    order_reference: order.orderReference,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    created_at: order.createdAt.toISOString(),
    updated_at: order.updatedAt.toISOString(),
  };
}
