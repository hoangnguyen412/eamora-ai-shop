CREATE TABLE "SearchClick" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchClick_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SearchClick"
ADD CONSTRAINT "SearchClick_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "SearchSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "SearchClick_sessionId_createdAt_idx" ON "SearchClick"("sessionId", "createdAt");