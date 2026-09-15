CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT auth.uid(),
	"updated_by" uuid DEFAULT auth.uid()
);
--> statement-breakpoint
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_updated_by_users_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "posts_owner_select" ON "posts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("posts"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "posts_owner_insert" ON "posts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("posts"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "posts_owner_update" ON "posts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("posts"."user_id" = (select auth.uid())) WITH CHECK ("posts"."user_id" = (select auth.uid()));