import type { Server } from "node:http";
import { setTimeout as sleep } from "node:timers/promises";
import { eq } from "drizzle-orm";
import request from "supertest";
import { db } from "../src/db";
import { orders, webhookEvents } from "../src/db/schema";
import { resetDatabase, startServer, stopServer } from "./helpers";

// Tests 2, 4a–c, 6 and 7 from design.md › Testing strategy.
// TEST_TX_DELAY_MS (200 ms, tests/setup-env.ts) holds each webhook's order lock.

let server: Server;

beforeAll(async () => {
  server = await startServer();
});
afterAll(async () => {
  await stopServer(server);
});
beforeEach(resetDatabase);

async function createOrder(): Promise<string> {
  const [order] = await db
    .insert(orders)
    .values({ merchantId: "m_1", orderReference: "ORD-1", amount: 1999, currency: "EUR" })
    .returning({ id: orders.id });
  return order!.id;
}

function sendWebhook(eventId: string, orderId: string, status: string) {
  return request(server)
    .post("/webhooks/payments")
    .send({ event_id: eventId, order_id: orderId, status, occurred_at: "2026-10-06T12:00:00Z" });
}

async function orderStatus(orderId: string) {
  const [order] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, orderId));
  return order?.status;
}

function eventsFor(orderId: string) {
  return db.select().from(webhookEvents).where(eq(webhookEvents.orderId, orderId));
}

test("2. the same event delivered 10 times concurrently is applied once", async () => {
  const orderId = await createOrder();

  const responses = await Promise.all(
    Array.from({ length: 10 }, () => sendWebhook("evt_1", orderId, "succeeded")),
  );

  expect(responses.map((r) => r.status)).toEqual(Array(10).fill(200));
  // One row proves one application: the insert and the update share a transaction.
  const events = await eventsFor(orderId);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ eventId: "evt_1", status: "succeeded", outcome: "applied" });
  expect(await orderStatus(orderId)).toBe("succeeded");
});

describe("4. events after success", () => {
  let orderId: string;

  beforeEach(async () => {
    orderId = await createOrder();
    expect((await sendWebhook("evt_ok", orderId, "succeeded")).status).toBe(200);
  });

  test("4a. failed with a new event ID is ignored", async () => {
    const res = await sendWebhook("evt_fail", orderId, "failed");

    expect(res.status).toBe(200);
    expect(await orderStatus(orderId)).toBe("succeeded");
    const [event] = await db.select().from(webhookEvents).where(eq(webhookEvents.eventId, "evt_fail"));
    expect(event?.outcome).toBe("ignored");
  });

  test("4b. same event ID with a different status is never applied", async () => {
    const res = await sendWebhook("evt_ok", orderId, "failed");

    expect(res.status).toBe(200);
    const events = await eventsFor(orderId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ eventId: "evt_ok", status: "succeeded", outcome: "applied" });
    expect(await orderStatus(orderId)).toBe("succeeded");
  });

  test("4c. processing after success is ignored", async () => {
    const res = await sendWebhook("evt_late", orderId, "processing");

    expect(res.status).toBe(200);
    expect(await orderStatus(orderId)).toBe("succeeded");
    const [event] = await db.select().from(webhookEvents).where(eq(webhookEvents.eventId, "evt_late"));
    expect(event?.outcome).toBe("ignored");
  });
});

test("6. failed, then succeeded, ends succeeded", async () => {
  const orderId = await createOrder();

  expect((await sendWebhook("evt_f", orderId, "failed")).status).toBe(200);
  expect(await orderStatus(orderId)).toBe("failed");
  expect((await sendWebhook("evt_s", orderId, "succeeded")).status).toBe(200);

  expect(await orderStatus(orderId)).toBe("succeeded");
  const events = await eventsFor(orderId);
  expect(events.map((e) => [e.eventId, e.outcome]).sort()).toEqual([
    ["evt_f", "applied"],
    ["evt_s", "applied"],
  ]);
});

test("7. race B: processing arriving while succeeded holds the lock is ignored", async () => {
  const orderId = await createOrder();

  // succeeded first; it takes the lock and sleeps 200 ms holding it.
  // `.then` starts the request now (supertest is lazy).
  const succeeded = sendWebhook("evt_S", orderId, "succeeded").then((r) => r);
  await sleep(50);
  // processing arrives while the lock is held. With the lock it waits, then
  // re-reads `succeeded` and is ignored. Without it, it reads the stale
  // `pending`, is applied, and overwrites succeeded with processing.
  const processing = sendWebhook("evt_P", orderId, "processing").then((r) => r);

  const responses = await Promise.all([succeeded, processing]);

  expect(responses.map((r) => r.status)).toEqual([200, 200]);
  expect(await orderStatus(orderId)).toBe("succeeded");
  const events = await eventsFor(orderId);
  expect(Object.fromEntries(events.map((e) => [e.eventId, e.outcome]))).toEqual({
    evt_S: "applied",
    evt_P: "ignored",
  });
});
