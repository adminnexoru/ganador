CREATE TYPE "public"."otp_channel" AS ENUM('whatsapp', 'sms');--> statement-breakpoint
CREATE TYPE "public"."push_platform" AS ENUM('ios', 'android');--> statement-breakpoint
CREATE TYPE "public"."device_activity" AS ENUM('moving', 'resting', 'no_signal');--> statement-breakpoint
CREATE TYPE "public"."device_event_type" AS ENUM('zone_exit', 'zone_enter', 'battery_low', 'signal_lost', 'tag_viewed');--> statement-breakpoint
CREATE TYPE "public"."device_source" AS ENUM('traccar');--> statement-breakpoint
CREATE TYPE "public"."device_status" AS ENUM('unlinked', 'linked', 'retired');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('push', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."access_role" AS ENUM('owner', 'family');--> statement-breakpoint
CREATE TYPE "public"."access_status" AS ENUM('invited', 'active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."pet_size" AS ENUM('small', 'medium', 'large');--> statement-breakpoint
CREATE TYPE "public"."species" AS ENUM('dog', 'cat');--> statement-breakpoint
CREATE TYPE "public"."tag_status" AS ENUM('inactive', 'active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."zone_state_value" AS ENUM('inside', 'outside', 'unknown');--> statement-breakpoint
CREATE TABLE "otp_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_e_164" text NOT NULL,
	"code_hash" text NOT NULL,
	"channel" "otp_channel" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "otp_attempts_max" CHECK ("otp_challenges"."attempts" <= 5)
);
--> statement-breakpoint
CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_e_164" text NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"whatsapp_alerts_enabled" boolean DEFAULT false NOT NULL,
	"whatsapp_opt_in_at" timestamp with time zone,
	"whatsapp_confirmed" boolean DEFAULT false NOT NULL,
	"locale" text DEFAULT 'es-MX' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "owners_phoneE164_unique" UNIQUE("phone_e_164"),
	CONSTRAINT "owners_display_name_len" CHECK (char_length("owners"."display_name") <= 60)
);
--> statement-breakpoint
CREATE TABLE "privacy_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"notice_version" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"platform" "push_platform" NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_refreshTokenHash_unique" UNIQUE("refresh_token_hash")
);
--> statement-breakpoint
CREATE TABLE "battery_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"level_pct" smallint NOT NULL,
	"charging" boolean,
	CONSTRAINT "battery_level_range" CHECK ("battery_readings"."level_pct" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "device_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pet_id" uuid NOT NULL,
	"device_id" uuid,
	"type" "device_event_type" NOT NULL,
	"zone_id" uuid,
	"occurred_at" timestamp with time zone NOT NULL,
	"position_id" bigint
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "device_source" NOT NULL,
	"external_id" text NOT NULL,
	"profile" text NOT NULL,
	"pet_id" uuid,
	"status" "device_status" DEFAULT 'unlinked' NOT NULL,
	"rest_interval_s" integer NOT NULL,
	"last_seen_at" timestamp with time zone,
	"activity" "device_activity",
	"activity_since" timestamp with time zone,
	"battery_alert_armed" boolean DEFAULT true NOT NULL,
	"signal_alert_armed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_source_external_id" UNIQUE("source","external_id"),
	CONSTRAINT "devices_rest_interval" CHECK ("devices"."rest_interval_s" between 60 and 86400)
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" bigint GENERATED ALWAYS AS IDENTITY (sequence name "positions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"device_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"accuracy_m" real,
	"speed_kmh" real,
	"valid" boolean NOT NULL,
	CONSTRAINT "positions_id_recorded_at_pk" PRIMARY KEY("id","recorded_at"),
	CONSTRAINT "positions_device_recorded" UNIQUE("device_id","recorded_at")
) PARTITION BY RANGE ("recorded_at");
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pet_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pet_id" uuid NOT NULL,
	"owner_id" uuid,
	"invited_phone_e_164" text,
	"role" "access_role" NOT NULL,
	"status" "access_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"species" "species" NOT NULL,
	"breed" text,
	"size" "pet_size",
	"photo_key" text,
	"conditions" text,
	"medications" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pets_name_len" CHECK (char_length("pets"."name") between 1 and 40),
	CONSTRAINT "pets_breed_len" CHECK ("pets"."breed" is null or char_length("pets"."breed") <= 60),
	CONSTRAINT "pets_conditions_len" CHECK ("pets"."conditions" is null or char_length("pets"."conditions") <= 500),
	CONSTRAINT "pets_medications_len" CHECK ("pets"."medications" is null or char_length("pets"."medications") <= 500)
);
--> statement-breakpoint
CREATE TABLE "public_profile_settings" (
	"pet_id" uuid PRIMARY KEY NOT NULL,
	"show_owner_name" boolean DEFAULT true NOT NULL,
	"show_conditions" boolean DEFAULT false NOT NULL,
	"show_medications" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tag_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"pet_id" uuid,
	"status" "tag_status" DEFAULT 'inactive' NOT NULL,
	"activated_at" timestamp with time zone,
	CONSTRAINT "tags_code_unique" UNIQUE("code"),
	CONSTRAINT "tags_code_len" CHECK (char_length("tags"."code") = 10)
);
--> statement-breakpoint
CREATE TABLE "safe_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pet_id" uuid NOT NULL,
	"name" text NOT NULL,
	"center_lat" double precision NOT NULL,
	"center_lng" double precision NOT NULL,
	"radius_m" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "zones_name_len" CHECK (char_length("safe_zones"."name") between 1 and 40),
	CONSTRAINT "zones_radius_range" CHECK ("safe_zones"."radius_m" between 50 and 2000)
);
--> statement-breakpoint
CREATE TABLE "zone_states" (
	"zone_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"state" "zone_state_value" DEFAULT 'unknown' NOT NULL,
	"pending_state" "zone_state_value",
	"pending_count" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "zone_states_zone_id_device_id_pk" PRIMARY KEY("zone_id","device_id")
);
--> statement-breakpoint
ALTER TABLE "privacy_consents" ADD CONSTRAINT "privacy_consents_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battery_readings" ADD CONSTRAINT "battery_readings_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_id_device_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."device_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_owners_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_access" ADD CONSTRAINT "pet_access_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_access" ADD CONSTRAINT "pet_access_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pets" ADD CONSTRAINT "pets_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_profile_settings" ADD CONSTRAINT "public_profile_settings_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_views" ADD CONSTRAINT "tag_views_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safe_zones" ADD CONSTRAINT "safe_zones_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_states" ADD CONSTRAINT "zone_states_zone_id_safe_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."safe_zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_states" ADD CONSTRAINT "zone_states_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "battery_device_recorded" ON "battery_readings" USING btree ("device_id","recorded_at");--> statement-breakpoint
CREATE INDEX "device_events_pet_idx" ON "device_events" USING btree ("pet_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_pet_unique" ON "devices" USING btree ("pet_id") WHERE "devices"."pet_id" is not null;--> statement-breakpoint
CREATE INDEX "notifications_event_idx" ON "notifications" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pet_access_one_owner" ON "pet_access" USING btree ("pet_id") WHERE "pet_access"."role" = 'owner' and "pet_access"."status" = 'active';--> statement-breakpoint
CREATE INDEX "pet_access_owner_idx" ON "pet_access" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "tag_views_tag_idx" ON "tag_views" USING btree ("tag_id","viewed_at");
--> statement-breakpoint
-- Particiones diarias de positions (research R7). La partición DEFAULT recibe fechas
-- sin partición (p. ej. relojes de rastreador desfasados); la retención también la limpia.
CREATE TABLE "positions_default" PARTITION OF "positions" DEFAULT;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION ensure_position_partitions(days_ahead int) RETURNS void AS $$
DECLARE
  d date;
  part text;
BEGIN
  FOR i IN 0..days_ahead LOOP
    d := (now() AT TIME ZONE 'UTC')::date + i;
    part := 'positions_' || to_char(d, 'YYYYMMDD');
    IF to_regclass(part) IS NULL THEN
      EXECUTE format(
        'CREATE TABLE %I PARTITION OF positions FOR VALUES FROM (%L) TO (%L)',
        part, d::timestamptz, (d + 1)::timestamptz
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION drop_old_position_partitions(keep_days int) RETURNS int AS $$
DECLARE
  r record;
  dropped int := 0;
  cutoff date := (now() AT TIME ZONE 'UTC')::date - keep_days;
BEGIN
  FOR r IN
    SELECT c.relname FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    JOIN pg_class p ON p.oid = i.inhparent
    WHERE p.relname = 'positions' AND c.relname ~ '^positions_[0-9]{8}$'
  LOOP
    IF to_date(substring(r.relname from 11), 'YYYYMMDD') < cutoff THEN
      EXECUTE format('DROP TABLE %I', r.relname);
      dropped := dropped + 1;
    END IF;
  END LOOP;
  DELETE FROM positions_default WHERE recorded_at < now() - make_interval(days => keep_days);
  RETURN dropped;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
SELECT ensure_position_partitions(2);
