-- Meesho sourcing candidates (scored shortlist, no scraping).
CREATE TABLE "sourcing_candidates" (
    "id" TEXT NOT NULL,
    "externalKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "meeshoUrl" TEXT,
    "sku" TEXT,
    "supplierPricePaise" INTEGER NOT NULL,
    "shippingPaise" INTEGER NOT NULL DEFAULT 0,
    "mrpPaise" INTEGER,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "unitsSold" INTEGER,
    "returnRatePercent" DOUBLE PRECISION,
    "trendScore" INTEGER,
    "landedCostPaise" INTEGER NOT NULL,
    "suggestedPricePaise" INTEGER NOT NULL,
    "marginPaise" INTEGER NOT NULL,
    "marginPercent" DOUBLE PRECISION NOT NULL,
    "score" INTEGER NOT NULL,
    "verdict" TEXT NOT NULL,
    "reasons" JSONB NOT NULL,
    "flags" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sourcing_candidates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sourcing_candidates_externalKey_key" ON "sourcing_candidates"("externalKey");
CREATE INDEX "sourcing_candidates_score_idx" ON "sourcing_candidates"("score");
CREATE INDEX "sourcing_candidates_verdict_idx" ON "sourcing_candidates"("verdict");
CREATE INDEX "sourcing_candidates_status_createdAt_idx" ON "sourcing_candidates"("status", "createdAt");
