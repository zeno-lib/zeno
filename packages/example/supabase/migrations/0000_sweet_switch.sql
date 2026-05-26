CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "posts_owner_select" ON "posts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("posts"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "posts_owner_insert" ON "posts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("posts"."user_id" = (select auth.uid()));