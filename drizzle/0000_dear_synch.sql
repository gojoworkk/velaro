CREATE TABLE "cars" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"power_hp" integer NOT NULL,
	"accel_0_100" text NOT NULL,
	"seats" integer NOT NULL,
	"price_per_day" integer NOT NULL,
	"deposit" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip_hash" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"car_id" text NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"delivery" text NOT NULL,
	"address" text,
	"comment" text,
	"days" integer NOT NULL,
	"day_rate" integer NOT NULL,
	"total" integer NOT NULL,
	"deposit" integer NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"telegram_sent" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_car_id_cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."cars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rate_limits_ip_created_idx" ON "rate_limits" USING btree ("ip_hash","created_at");