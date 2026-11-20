'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiClientError } from '@/lib/client/api';
import { toast } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { Alert } from '@/components/ui/feedback';

/**
 * Manual settlement for refunds the store pays out itself. UPI has no refund
 * API, so the owner transfers the money, then records the reference here —
 * that is what turns a reservation into a settled, auditable refund.
 */
export function RefundSettleButton({ refundId }: { refundId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'COMPLETED' | 'FAILED' | null>(null);

  async function settle(status: 'COMPLETED' | 'FAILED') {
    setBusy(status);
    try {
      await apiFetch(`/api/admin/refunds/${refundId}/settle`, {
        body: {
          status,
          reference: reference.trim() || null,
          note: note.trim() || null,
        },
      });
      toast(
        status === 'COMPLETED'
          ? 'Refund marked completed — profit recalculated'
          : 'Refund marked failed',
        'success'
      );
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : 'Could not update refund', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Settle manually
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Settle refund manually"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy !== null}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => settle('FAILED')}
              loading={busy === 'FAILED'}
              disabled={busy !== null}
            >
              Mark failed
            </Button>
            <Button
              variant="success"
              onClick={() => settle('COMPLETED')}
              loading={busy === 'COMPLETED'}
              disabled={busy !== null || reference.trim().length === 0}
            >
              Mark completed
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Alert tone="warning">
            UPI refunds are paid out by you, not by an API. Transfer the money first, then record
            the payout reference here. Marking COMPLETED finalises the order&apos;s actual profit.
          </Alert>
          <Field label="Payout reference" hint="e.g. UPI UTR / NEFT reference you sent">
            {(p) => (
              <Input
                {...p}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                maxLength={120}
                autoComplete="off"
                spellCheck={false}
              />
            )}
          </Field>
          <Field label="Note (audit log)" hint="optional context for your records">
            {(p) => (
              <Textarea
                {...p}
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
              />
            )}
          </Field>
        </div>
      </Modal>
    </>
  );
}
