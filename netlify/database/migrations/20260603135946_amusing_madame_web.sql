CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference" text,
	"correlator_id" text,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'KES' NOT NULL,
	"phone_number" text,
	"narration" text,
	"channel" text,
	"business_account" text,
	"business_type" text,
	"receiver_username" text,
	"wallet_type" text,
	"result_code" integer,
	"remarks" text,
	"third_party_trans_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_reference_unique" UNIQUE("reference"),
	CONSTRAINT "transactions_correlator_id_unique" UNIQUE("correlator_id")
);
--> statement-breakpoint
CREATE TABLE "credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"payd_username" text NOT NULL,
	"payd_password" text NOT NULL,
	"payd_api_secret" text,
	"payd_account_username" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"withdrawals_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "credentials_account_username_idx" ON "credentials" USING btree ("payd_account_username");