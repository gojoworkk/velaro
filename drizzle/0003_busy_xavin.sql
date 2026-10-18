CREATE TABLE "car_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"car_id" text NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"reason" text NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "car_blocks" ADD CONSTRAINT "car_blocks_car_id_cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."cars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_blocks" ADD CONSTRAINT "car_blocks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "car_blocks_car_idx" ON "car_blocks" USING btree ("car_id","date_from");--> statement-breakpoint
CREATE INDEX "requests_car_dates_idx" ON "requests" USING btree ("car_id","date_from");