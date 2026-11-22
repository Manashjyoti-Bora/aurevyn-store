-- Meesho placement provenance: a pasted reference is owner-provided, not
-- supplier-verified. Keep the two facts separate on the row.

ALTER TABLE "supplier_orders"
  ADD COLUMN IF NOT EXISTS "referenceReportedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "referenceReportedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "referenceVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "referenceEvidence" TEXT;

-- Existing rows already carry a supplier reference typed by the owner under the
-- old flow. Record that as reported; verification stays NULL because we hold no
-- evidence for it (never backfill a confirmation that was never recorded).
UPDATE "supplier_orders"
SET "referenceReportedAt" = COALESCE("acceptedAt", "updatedAt")
WHERE "supplierOrderId" IS NOT NULL
  AND "referenceReportedAt" IS NULL;
