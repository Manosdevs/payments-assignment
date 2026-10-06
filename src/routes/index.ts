import { Router } from "express";
import { healthRouter } from "./health";
import { ordersRouter } from "./orders";

export const router = Router();

router.use("/health", healthRouter);
router.use("/orders", ordersRouter);
