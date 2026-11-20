# Payments — UPI QR + Cash on Delivery

This store has **no payment gateway**. Two methods exist:

| Method | How it works | Who confirms payment |
| --- | --- | --- |
| **UPI QR** | Customer scans a QR that pays the store's own UPI ID (VPA) for the server-computed amount and quotes the UTR from their UPI app. | An admin, after matching the UTR to the bank statement (Admin → Payments → *Mark received*). |
| **Cash on Delivery** | Customer pays the courier. Admin marks cash collected after delivery. | Admin, on delivery. |

There are no API keys, no KYC integration, no webhook and nothing to install.
Nothing in the checkout can mark an order paid by itself.

## 1. Set the store UPI ID (this is the only required input)

Two places can supply it. **The environment wins when both are set.**

1. **Admin → Settings → Payments → *Store UPI ID (VPA)*** — recommended, because
   it takes effect immediately with no redeploy and survives redeployments.
2. **`UPI_VPA` environment variable** — an operator-level override, useful when
   you rotate banks or want a deployment pinned to one payee.
   `UPI_PAYEE_NAME` (optional) is the name shown inside the customer's UPI app;
   it defaults to `APP_NAME` / the store setting.

Use a **current-account / merchant VPA in the business name** where possible.
Personal VPAs may breach your bank's merchant terms and make refunds and
accounting harder.

If no valid UPI ID is configured, UPI is hidden and the store offers COD only.
It never renders a QR that pays nobody.

## 2. First real payment (do this once, with ₹1)

1. Add a real product, place an order on the live site and choose *Pay by UPI QR*.
2. The payment page shows the QR, the UPI ID and a copy button, rendered
   server-side (nothing is sent to a third-party image service).
3. Pay it from your own UPI app, note the 12-digit reference.
4. Submit the reference on the payment page (this only files the claim).
5. Open the bank statement, match **amount + reference + order number in the
   note**, then press **Mark received** in Admin → Payments.
6. The order moves to paid, the customer is emailed, and fulfilment starts.

Never mark a payment received because a customer says they paid — only when the
credit is visible in the bank statement.

## 3. Cash on Delivery

Configured in Admin → Settings → *Shipping & COD* (enable/disable + handling
fee). Mark cash received in Admin → Orders after delivery; that is what unlocks
profit finalisation and refunds for a COD order.

## 4. Refunds (manual by design)

There is no refund API, so **every refund is paid out by you**:

1. Admin → Orders → refund action (or a completed return) reserves the refund.
   The reservation immediately reduces the refundable balance, so the same
   money can never be refunded twice.
2. Transfer the money by UPI/bank to the customer.
3. Admin → Refunds → **Settle manually** → paste the payout reference (UPI UTR
   or NEFT reference) → *Mark completed*.

The reference is required for completion and is stored on the refund plus in
the audit log. Marking it completed updates the payment status
(`PARTIALLY_REFUNDED` / `REFUNDED`), the order status and the profit ledger.
Marking it **failed** keeps the reservation open on purpose — a verified later
payout can still complete it — and records why.

## 5. Development / test mode

`PAYMENTS_TEST_MODE=true` enables a clearly-labelled TEST provider **only when
`NODE_ENV` is not `production`**. It exercises the full order pipeline with no
money. Production builds refuse it regardless of the flag.

## 6. Reconciliation habits that keep this honest

- Confirm a UPI payment only from the bank statement, not from a screenshot.
- Match both the **amount** and the **reference**; query partial or mismatched
  references with the customer instead of marking them paid.
- Keep the order number in the UPI note (the QR already includes it) so a
  statement line can be traced back to an order.
- Settle refunds in the same order you paid them and always record the payout
  reference.
