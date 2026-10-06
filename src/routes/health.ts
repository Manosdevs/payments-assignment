import { sql } from "drizzle-orm";
import { Router } from "express";
import { db } from "../db";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  await db.execute(sql`select 1`);
  res.json({ status: "ok" });
});
