CREATE TABLE IF NOT EXISTS "attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"sense_id" uuid NOT NULL,
	"transcript" text NOT NULL,
	"model" text NOT NULL,
	"score" double precision,
	"pass" boolean DEFAULT false NOT NULL,
	"feedback" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "senses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"word_id" uuid NOT NULL,
	"pos" text NOT NULL,
	"definition" text NOT NULL,
	"example" text,
	"ordinal" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_sense" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"sense_id" uuid NOT NULL,
	"first_seen_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"pass_count" integer DEFAULT 0 NOT NULL,
	"fail_count" integer DEFAULT 0 NOT NULL,
	"passed_at" timestamp with time zone,
	"last_result" text,
	CONSTRAINT "user_sense_user_sense_unique" UNIQUE("user_id","sense_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "words" (
	"id" uuid PRIMARY KEY NOT NULL,
	"word" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "words_word_unique" UNIQUE("word")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "attempts" ADD CONSTRAINT "attempts_sense_id_senses_id_fk"
  FOREIGN KEY ("sense_id") REFERENCES "public"."senses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "senses" ADD CONSTRAINT "senses_word_id_words_id_fk"
  FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_sense" ADD CONSTRAINT "user_sense_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_sense" ADD CONSTRAINT "user_sense_sense_id_senses_id_fk"
  FOREIGN KEY ("sense_id") REFERENCES "public"."senses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attempts_user_created_idx" ON "attempts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "senses_word_ordinal_idx" ON "senses" USING btree ("word_id","ordinal");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sense_user_reviewed_idx" ON "user_sense" USING btree ("user_id","reviewed_at");