import type { Server } from "node:http";
import { and, eq } from "drizzle-orm";
import request from "supertest";
import { db } from "../src/db";
import { orders } from "../src/db/schema";
import { resetDatabase, startServer, stopServer } from "./helpers";

// Tests 1, 3 and 5 from design.md › Testing strategy.

let server: Server;

beforeAll(async () => {
  server = await startServer();
});
afterAll(async () => {
  await stopServer(server);
});
beforeEach(resetDatabase);

const body = { merchant_id: "m_1", order_reference: "ORD-1", amount: 1999, currency: "EUR" };

function ordersFor(merchantId: string, orderReference: string) {
  return db
    .select()
    .from(orders)
    .where(and(eq(orders.merchantId, merchantId), eq(orders.orderReference, orderReference)));
}

test("1. 10 concurrent identical checkouts create one order", async () => {
  // Build every request first, then await together: never await in a loop.
  // No delay needed: the unique index arbitrates regardless of timing.
  const responses = await Promise.all(
    Array.from({ length: 10 }, () => request(server).post("/orders").send(body)),
  );

  const statuses = responses.map((r) => r.status);
  expect(statuses.filter((s) => s === 201)).toHaveLength(1);
  expect(statuses.filter((s) => s === 200)).toHaveLength(9);
  expect(new Set(responses.map((r) => r.body.id)).size).toBe(1);

  const rows = await ordersFor("m_1", "ORD-1");
  expect(rows).toHaveLength(1);
  expect(rows[0]?.id).toBe(responses[0]?.body.id);
});

test("3. reused reference with a different amount is rejected without change", async () => {
  const first = await request(server).post("/orders").send(body);
  expect(first.status).toBe(201);

  const second = await request(server)
    .post("/orders")
    .send({ ...body, amount: 2500 });
  expect(second.status).toBe(409);
  expect(second.body.error.details).toEqual({ mismatched_fields: ["amount"] });

  const rows = await ordersFor("m_1", "ORD-1");
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ id: first.body.id, amount: 1999, currency: "EUR", status: "pending" });
});

test("5. same reference from a different merchant is a different order", async () => {
  const a = await request(server).post("/orders").send(body);
  const b = await request(server)
    .post("/orders")
    .send({ ...body, merchant_id: "m_2" });

  expect(a.status).toBe(201);
  expect(b.status).toBe(201);
  expect(b.body.id).not.toBe(a.body.id);

  const rows = await db.select().from(orders).where(eq(orders.orderReference, "ORD-1"));
  expect(rows).toHaveLength(2);
});
