-- CreateTable
CREATE TABLE "kb_curations" (
    "id" TEXT NOT NULL,
    "project_slug" TEXT NOT NULL,
    "repository" TEXT NOT NULL,
    "pr_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "github_state" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kb_curations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kb_curations_repository_pr_number_key"
ON "kb_curations"("repository", "pr_number");

-- CreateIndex
CREATE INDEX "kb_curations_project_slug_status_idx"
ON "kb_curations"("project_slug", "status");

-- CreateIndex
CREATE INDEX "kb_curations_verdict_idx"
ON "kb_curations"("verdict");

-- AddForeignKey
ALTER TABLE "kb_curations"
ADD CONSTRAINT "kb_curations_project_slug_fkey"
FOREIGN KEY ("project_slug") REFERENCES "projects"("slug")
ON DELETE CASCADE ON UPDATE CASCADE;
