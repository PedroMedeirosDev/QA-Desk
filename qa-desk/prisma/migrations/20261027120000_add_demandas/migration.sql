-- CreateTable
CREATE TABLE "demandas" (
    "id" TEXT NOT NULL,
    "project_slug" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "com_quem" TEXT,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demandas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "demandas_project_slug_numero_key" ON "demandas"("project_slug", "numero");

-- CreateIndex
CREATE INDEX "demandas_project_slug_status_idx" ON "demandas"("project_slug", "status");

-- AddForeignKey
ALTER TABLE "demandas"
ADD CONSTRAINT "demandas_project_slug_fkey"
FOREIGN KEY ("project_slug") REFERENCES "projects"("slug")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Mesma trava das outras tabelas do Prisma (supabase/migrations/002): sem acesso
-- direto pelo PostgREST; só a API Node (role postgres).
ALTER TABLE "demandas" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "demandas" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "demandas" FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON TABLE "demandas" TO service_role;
  END IF;
END $$;
