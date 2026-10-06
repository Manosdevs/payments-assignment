import type { Order } from "../db/schema";
import type { CheckoutInput } from "../services/checkout";
import type { CheckoutBody } from "./orders";

// The one place where API snake_case meets internal camelCase.

export function fromCheckoutBody(body: CheckoutBody): CheckoutInput {
  return {
    merchantId: body.merchant_id,
    orderReference: body.order_reference,
    amount: body.amount,
    currency: body.currency,
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
