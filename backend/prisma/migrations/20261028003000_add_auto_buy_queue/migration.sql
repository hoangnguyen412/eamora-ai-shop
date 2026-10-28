CREATE TABLE "AutoBuyQueueItem" (
    "id" TEXT NOT NULL,
    "watchlistId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoBuyQueueItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AutoBuyQueueItem_status_createdAt_idx"
ON "AutoBuyQueueItem"("status", "createdAt");

CREATE UNIQUE INDEX "AutoBuyQueueItem_watchlistId_pending_key"
ON "AutoBuyQueueItem"("watchlistId")
WHERE "status" = 'pending';

ALTER TABLE "AutoBuyQueueItem"
ADD CONSTRAINT "AutoBuyQueueItem_watchlistId_fkey"
FOREIGN KEY ("watchlistId") REFERENCES "Watchlist"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
