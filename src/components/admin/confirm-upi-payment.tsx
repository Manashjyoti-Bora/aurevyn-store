'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiClientError } from '@/lib/client/api';
import { toast } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';

/** Admin action: confirm a UPI payment after checking the bank statement. */
export function ConfirmUpiPayment({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (busy) return;
    if (
      !window.confirm(
        'Confirm you have matched this UPI reference (UTR) to a credit in the store bank account. This marks the order paid and starts fulfilment.'
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/admin/payments/${paymentId}/confirm`, { method: 'POST', body: {} });
      toast('UPI payment confirmed', 'success');
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : 'Could not confirm payment', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={confirm} loading={busy}>
      Mark received
    </Button>
  );
}
