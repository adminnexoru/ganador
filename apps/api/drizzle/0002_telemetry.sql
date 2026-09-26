CREATE TABLE "telemetry_timings" (
	"day" date NOT NULL,
	"metric" text NOT NULL,
	"platform" text NOT NULL,
	"bucket_ms" integer NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "telemetry_timings_day_metric_platform_bucket_ms_pk" PRIMARY KEY("day","metric","platform","bucket_ms")
);
