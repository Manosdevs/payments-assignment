import { Router } from "express";
import { z } from "zod";
import { AppError, NotFoundError } from "../errors/app-error";
import { checkout, findOrder } from "../services/checkout";
import { fromCheckoutBody, toOrderResponse } from "./mappers";

// Rules from design.md › API › POST /orders.
export const checkoutBodySchema = z.object({
  merchant_id: z.string().min(1).max(255),
  order_reference: z.string().min(1).max(255),
  // Minor units. Capped at MAX_SAFE_INTEGER: larger values already lost
  // precision in JSON.parse (design.md › Amounts).
  amount: z.int().min(1).max(Number.MAX_SAFE_INTEGER),
  // Lowercase is rejected, not normalised.
  currency: z.string().regex(/^[A-Z]{3}$/),
});

export type CheckoutBody = z.infer<typeof checkoutBodySchema>;

export const ordersRouter = Router();

ordersRouter.post("/", async (req, res) => {
  // A ZodError here becomes a 400 in the error handler.
  const body = checkoutBodySchema.parse(req.body);
  const result = await checkout(fromCheckoutBody(body));

  switch (result.kind) {
    case "created":
      res.status(201).json(toOrderResponse(result.order));
      return;
    case "existing":
      // A matching retry: return the current order, whose status may have advanced.
      res.status(200).json(toOrderResponse(result.order));
      return;
    case "mismatch":
      throw new AppError(
        409,
        "An order with this merchant_id and order_reference already exists with different details",
        "ORDER_MISMATCH",
        { mismatched_fields: result.mismatchedFields },
      );
  }
});

ordersRouter.get("/:id", async (req, res) => {
  // Validate first: Postgres throws on an invalid uuid, which would surface as a 500.
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) throw new NotFoundError("Order not found");

  const order = await findOrder(id.data);
  if (!order) throw new NotFoundError("Order not found");

  res.status(200).json(toOrderResponse(order));
});
