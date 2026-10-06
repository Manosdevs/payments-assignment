import { Router } from "express";
import { z } from "zod";
import { providerStatuses } from "../domain/provider";
import { NotFoundError } from "../errors/app-error";
import { logger } from "../logger";
import { processWebhook } from "../services/webhook";
import { fromWebhookBody } from "./mappers";

// Rules from design.md › API › POST /webhooks/payments.
export const webhookBodySchema = z.object({
  event_id: z.string().min(1).max(255),
  // A non-UUID would make Postgres throw (500); reject it here as a 400.
  order_id: z.uuid(),
  status: z.enum(providerStatuses),
  occurred_at: z.iso.datetime({ offset: true }),
});

export type WebhookBody = z.infer<typeof webhookBodySchema>;

export const webhooksRouter = Router();

webhooksRouter.post("/payments", async (req, res) => {
  // Malformed → ZodError → 400, nothing touched in the database.
  const evt = fromWebhookBody(webhookBodySchema.parse(req.body));

  // The transaction has committed (or thrown → rolled back → 500) by the time
  // this resolves. Respond only now. See design.md › Failure handling.
  const result = await processWebhook(evt);

  switch (result.kind) {
    case "unknown_order":
      // Can't legitimately happen; a 404 keeps the provider retrying and visible.
      logger.warn({ eventId: evt.eventId, orderId: evt.orderId }, "Webhook for unknown order");
      throw new NotFoundError("Order not found");
    case "conflicting_duplicate":
      // A provider bug. Never applied; a non-2xx would only start a retry loop
      // that can never succeed.
      logger.warn(
        { eventId: evt.eventId, received: { orderId: evt.orderId, status: evt.status }, stored: result.stored },
        "Webhook event_id reused with a different payload",
      );
      break;
    case "applied":
    case "ignored":
      logger.info(
        { eventId: evt.eventId, orderId: evt.orderId, from: result.from, to: evt.status, outcome: result.kind },
        "Webhook processed",
      );
      break;
    case "duplicate":
      break;
  }

  // Applied, ignored, duplicate and conflicting duplicate all get 200.
  res.status(200).json({ received: true });
});
