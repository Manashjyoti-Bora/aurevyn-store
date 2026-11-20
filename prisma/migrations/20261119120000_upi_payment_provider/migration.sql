-- Replace the retired gateway provider with direct UPI QR payments.
-- Renaming the value preserves every existing payment row and its history.
ALTER TYPE "PaymentProviderKind" RENAME VALUE 'RAZORPAY' TO 'UPI';
