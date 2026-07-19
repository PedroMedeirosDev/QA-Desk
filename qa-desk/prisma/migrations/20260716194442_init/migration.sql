-- CreateTable
CREATE TABLE "projects" (
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "meta_version" TEXT NOT NULL DEFAULT '1.0.0',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "tests" (
    "id" TEXT NOT NULL,
    "project_slug" TEXT NOT NULL,
    "test_key" TEXT,
    "record_type" TEXT NOT NULL DEFAULT 'teste',
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "homologation_status" TEXT,
    "homologation_id" TEXT,
    "campaign" TEXT,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homologations" (
    "id" TEXT NOT NULL,
    "project_slug" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homologations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_runs" (
    "id" TEXT NOT NULL,
    "project_slug" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "run_number" INTEGER,
    "status" TEXT NOT NULL,
    "exit_code" INTEGER,
    "flow_path" TEXT,
    "output" TEXT,
    "app_version" TEXT,
    "homologation_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,
    "evidence_paths" JSONB,

    CONSTRAINT "test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tests_project_slug_idx" ON "tests"("project_slug");

-- CreateIndex
CREATE INDEX "tests_homologation_id_idx" ON "tests"("homologation_id");

-- CreateIndex
CREATE INDEX "tests_campaign_idx" ON "tests"("campaign");

-- CreateIndex
CREATE UNIQUE INDEX "tests_project_slug_test_key_key" ON "tests"("project_slug", "test_key");

-- CreateIndex
CREATE INDEX "homologations_project_slug_idx" ON "homologations"("project_slug");

-- CreateIndex
CREATE UNIQUE INDEX "homologations_project_slug_slug_key" ON "homologations"("project_slug", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "test_runs_run_id_key" ON "test_runs"("run_id");

-- CreateIndex
CREATE INDEX "test_runs_project_slug_test_id_idx" ON "test_runs"("project_slug", "test_id");

-- CreateIndex
CREATE INDEX "test_runs_homologation_id_idx" ON "test_runs"("homologation_id");

-- CreateIndex
CREATE INDEX "test_runs_started_at_idx" ON "test_runs"("started_at");

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_project_slug_fkey" FOREIGN KEY ("project_slug") REFERENCES "projects"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homologations" ADD CONSTRAINT "homologations_project_slug_fkey" FOREIGN KEY ("project_slug") REFERENCES "projects"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_project_slug_fkey" FOREIGN KEY ("project_slug") REFERENCES "projects"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
