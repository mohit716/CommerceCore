-- CreateTable
CREATE TABLE "CatalogRevision" (
    "id" INTEGER NOT NULL,
    "version" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "CatalogRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ORDER_CONFIRMED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMPTZ(3),
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMPTZ(3),
    "leaseToken" UUID,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
ALTER TABLE "CatalogRevision" ADD CONSTRAINT "CatalogRevision_singleton_check" CHECK (id = 1 AND version >= 0);
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_attempts_check" CHECK (attempts >= 0 AND type = 'ORDER_CONFIRMED');
INSERT INTO "CatalogRevision" (id, version) VALUES (1, 0);

-- CreateIndex
CREATE INDEX "OutboxEvent_deliveredAt_nextAttemptAt_idx" ON "OutboxEvent"("deliveredAt", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_orderId_type_key" ON "OutboxEvent"("orderId", "type");

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
