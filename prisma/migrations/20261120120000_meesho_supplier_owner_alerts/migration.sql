-- Add MEESHO supplier type and the OWNER_ALERT notification template.
-- Both ADD VALUE statements are additive and safe to run on a live database.

ALTER TYPE "SupplierType" ADD VALUE IF NOT EXISTS 'MEESHO';

ALTER TYPE "NotificationTemplate" ADD VALUE IF NOT EXISTS 'OWNER_ALERT';
