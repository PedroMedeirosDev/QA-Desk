-- CreateTable
CREATE TABLE "daily_metrics" (
    "id" TEXT NOT NULL,
    "project_slug" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "show_in_portfolio" BOOLEAN NOT NULL DEFAULT false,
    "intents" JSONB,
    "note" TEXT,
    "summary" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_metrics_project_slug_date_key"
ON "daily_metrics"("project_slug", "date");

-- CreateIndex
CREATE INDEX "daily_metrics_project_slug_show_in_portfolio_idx"
ON "daily_metrics"("project_slug", "show_in_portfolio");

-- AddForeignKey
ALTER TABLE "daily_metrics"
ADD CONSTRAINT "daily_metrics_project_slug_fkey"
FOREIGN KEY ("project_slug") REFERENCES "projects"("slug")
ON DELETE CASCADE ON UPDATE CASCADE;
