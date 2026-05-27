CREATE TABLE "customer" (
	"id" varchar(256) PRIMARY KEY NOT NULL,
	"companyName" text NOT NULL,
	"contactName" text NOT NULL,
	"contactTitle" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"postalCode" text,
	"region" text,
	"country" text NOT NULL,
	"phone" text NOT NULL,
	"fax" text
);
--> statement-breakpoint
CREATE TABLE "order_detail" (
	"unitPrice" numeric NOT NULL,
	"quantity" integer NOT NULL,
	"discount" numeric NOT NULL,
	"orderId" integer NOT NULL,
	"productId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee" (
	"id" integer PRIMARY KEY NOT NULL,
	"lastName" text NOT NULL,
	"firstName" text,
	"title" text NOT NULL,
	"titleOfCourtesy" text NOT NULL,
	"birthDate" timestamp NOT NULL,
	"hireDate" timestamp NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"postalCode" text NOT NULL,
	"country" text NOT NULL,
	"homePhone" text NOT NULL,
	"extension" integer NOT NULL,
	"notes" text NOT NULL,
	"reportsTo" integer,
	"photoPath" text
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" integer PRIMARY KEY NOT NULL,
	"orderDate" timestamp NOT NULL,
	"requiredDate" timestamp NOT NULL,
	"shippedDate" timestamp,
	"shipVia" integer NOT NULL,
	"freight" numeric NOT NULL,
	"shipName" text NOT NULL,
	"shipCity" text NOT NULL,
	"shipRegion" text,
	"shipPostalCode" text,
	"shipCountry" text NOT NULL,
	"customerId" varchar(256) NOT NULL,
	"employeeId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"quantityPerUnit" text NOT NULL,
	"unitPrice" numeric NOT NULL,
	"unitsInStock" integer NOT NULL,
	"unitsOnOrder" integer NOT NULL,
	"reorderLevel" integer NOT NULL,
	"discontinued" integer NOT NULL,
	"supplierId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier" (
	"id" integer PRIMARY KEY NOT NULL,
	"companyName" text NOT NULL,
	"contactName" text NOT NULL,
	"contactTitle" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"region" text,
	"postalCode" text NOT NULL,
	"country" text NOT NULL,
	"phone" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_detail" ADD CONSTRAINT "order_detail_orderId_order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_detail" ADD CONSTRAINT "order_detail_productId_product_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee" ADD CONSTRAINT "employee_reportsTo_employee_id_fk" FOREIGN KEY ("reportsTo") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_customerId_customer_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_employeeId_employee_id_fk" FOREIGN KEY ("employeeId") REFERENCES "public"."employee"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_supplierId_supplier_id_fk" FOREIGN KEY ("supplierId") REFERENCES "public"."supplier"("id") ON DELETE cascade ON UPDATE no action;