CREATE TABLE "customer" (
	"address" text NOT NULL,
	"city" text NOT NULL,
	"company_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_title" text NOT NULL,
	"country" text NOT NULL,
	"fax" text,
	"id" varchar(256) PRIMARY KEY,
	"phone" text NOT NULL,
	"postal_code" text,
	"region" text
);
--> statement-breakpoint
ALTER TABLE "customer" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_detail" (
	"discount" numeric NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_detail" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "employee" (
	"address" text NOT NULL,
	"birth_date" timestamp NOT NULL,
	"city" text NOT NULL,
	"country" text NOT NULL,
	"extension" integer NOT NULL,
	"first_name" text,
	"hire_date" timestamp NOT NULL,
	"home_phone" text NOT NULL,
	"id" integer PRIMARY KEY,
	"last_name" text NOT NULL,
	"notes" text NOT NULL,
	"photo_path" text,
	"postal_code" text NOT NULL,
	"reports_to" integer,
	"title" text NOT NULL,
	"title_of_courtesy" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employee" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order" (
	"customer_id" varchar(256) NOT NULL,
	"employee_id" integer NOT NULL,
	"freight" numeric NOT NULL,
	"id" integer PRIMARY KEY,
	"order_date" timestamp NOT NULL,
	"required_date" timestamp NOT NULL,
	"ship_city" text NOT NULL,
	"ship_country" text NOT NULL,
	"ship_name" text NOT NULL,
	"ship_postal_code" text,
	"shipped_date" timestamp,
	"ship_region" text,
	"ship_via" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product" (
	"discontinued" integer NOT NULL,
	"id" integer PRIMARY KEY,
	"name" text NOT NULL,
	"quantity_per_unit" text NOT NULL,
	"reorder_level" integer NOT NULL,
	"supplier_id" integer NOT NULL,
	"unit_price" numeric NOT NULL,
	"units_in_stock" integer NOT NULL,
	"units_on_order" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "supplier" (
	"address" text NOT NULL,
	"city" text NOT NULL,
	"company_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_title" text NOT NULL,
	"country" text NOT NULL,
	"id" integer PRIMARY KEY,
	"phone" text NOT NULL,
	"postal_code" text NOT NULL,
	"region" text
);
--> statement-breakpoint
ALTER TABLE "supplier" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_detail" ADD CONSTRAINT "order_detail_order_id_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "order_detail" ADD CONSTRAINT "order_detail_product_id_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "employee" ADD CONSTRAINT "employee_reports_to_employee_id_fkey" FOREIGN KEY ("reports_to") REFERENCES "employee"("id");--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_customer_id_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_employee_id_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_supplier_id_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "posts_owner_select" ON "posts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("posts"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "posts_owner_insert" ON "posts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("posts"."user_id" = (select auth.uid()));