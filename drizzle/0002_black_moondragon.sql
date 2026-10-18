CREATE TABLE "discount_tiers" (
	"position" integer PRIMARY KEY NOT NULL,
	"min_days" integer NOT NULL,
	"percent" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"car_id" text,
	"kind" text NOT NULL,
	"tier" integer,
	"from_value" text,
	"to_value" text
);
--> statement-breakpoint
ALTER TABLE "cars" ADD COLUMN "photo_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cars" ADD COLUMN "photo_alt" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cars" ADD COLUMN "photo_pos" text DEFAULT '50% 60%' NOT NULL;--> statement-breakpoint
ALTER TABLE "cars" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "price_changes" ADD CONSTRAINT "price_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_changes" ADD CONSTRAINT "price_changes_car_id_cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."cars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "price_changes_created_idx" ON "price_changes" USING btree ("created_at");--> statement-breakpoint
INSERT INTO "discount_tiers" ("position", "min_days", "percent") VALUES (1, 1, 0), (2, 3, 10), (3, 7, 20), (4, 14, 30) ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "cars" SET "photo_url" = 'https://images.unsplash.com/photo-1580274455191-1c62238fa333?auto=format&fit=crop&w=900&q=80', "photo_pos" = '50% 52%', "photo_alt" = 'Матово-чёрный Porsche 911 GT3 RS на набережной на закате' WHERE "id" = 'gt3rs';--> statement-breakpoint
UPDATE "cars" SET "photo_url" = 'https://cdn.gamma.app/bqylkkqzpmrgkk7/design-anything/ssVBmKe1Rtbzk08WVEUQD/UDahfs1fTqskaxKOek1OQ.jpg', "photo_pos" = '50% 58%', "photo_alt" = 'Чёрная Ferrari Roma в профиль в тёмной студии' WHERE "id" = 'ferrari-roma';--> statement-breakpoint
UPDATE "cars" SET "photo_url" = 'https://images.unsplash.com/photo-1657217674164-9cbf85acfc6d?auto=format&fit=crop&w=900&q=80', "photo_pos" = '50% 60%', "photo_alt" = 'Серая Lamborghini Huracán, вид спереди' WHERE "id" = 'huracan';--> statement-breakpoint
UPDATE "cars" SET "photo_url" = 'https://images.unsplash.com/photo-1756704756051-9aa48231c440?auto=format&fit=crop&w=900&q=80', "photo_pos" = '50% 70%', "photo_alt" = 'Чёрный Mercedes-AMG G 63 у серых ворот' WHERE "id" = 'g63';--> statement-breakpoint
UPDATE "cars" SET "photo_url" = 'https://images.unsplash.com/photo-1748189285388-c8852b6a7ed6?auto=format&fit=crop&w=900&q=80', "photo_pos" = '50% 65%', "photo_alt" = 'Чёрный Lamborghini Urus на городской улице' WHERE "id" = 'urus';--> statement-breakpoint
UPDATE "cars" SET "photo_url" = 'https://images.unsplash.com/photo-1767274592417-c986b7619c8c?auto=format&fit=crop&w=900&q=80', "photo_pos" = '50% 65%', "photo_alt" = 'Белый Range Rover на мощёной площадке' WHERE "id" = 'range-rover';--> statement-breakpoint
UPDATE "cars" SET "photo_url" = 'https://images.unsplash.com/photo-1619221496652-7ee3d7406203?auto=format&fit=crop&w=900&q=80', "photo_pos" = '55% 70%', "photo_alt" = 'Чёрный Mercedes-AMG S 63 у кирпичного фасада вечером' WHERE "id" = 's63';--> statement-breakpoint
UPDATE "cars" SET "photo_url" = 'https://images.unsplash.com/photo-1729966085578-c7b281cf11da?auto=format&fit=crop&w=900&q=80', "photo_pos" = '60% 65%', "photo_alt" = 'Белый BMW M5 в бетонном паркинге' WHERE "id" = 'm5';--> statement-breakpoint
UPDATE "cars" SET "photo_url" = 'https://images.unsplash.com/photo-1471289549423-04adaecfa1f1?auto=format&fit=crop&w=900&q=80', "photo_pos" = '40% 60%', "photo_alt" = 'Синий Bentley Continental GT, вид спереди' WHERE "id" = 'bentley';
