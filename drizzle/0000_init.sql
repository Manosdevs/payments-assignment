CREATE TYPE "public"."event_outcome" AS ENUM('applied', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'processing', 'failed', 'succeeded');--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" text NOT NULL,
	"order_reference" text NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_merchant_id_order_reference_key" UNIQUE("merchant_id","order_reference"),
	CONSTRAINT "orders_amount_positive" CHECK ("orders"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"status" "payment_status" NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"outcome" "event_outcome" NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;