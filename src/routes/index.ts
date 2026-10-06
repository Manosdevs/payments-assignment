import { Router } from "express";
import { healthRouter } from "./health";
import { ordersRouter } from "./orders";
import { webhooksRouter } from "./webhooks";

export const router = Router();

router.use("/health", healthRouter);
router.use("/orders", ordersRouter);
router.use("/webhooks", webhooksRouter);
