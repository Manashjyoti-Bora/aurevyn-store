import type { Metadata } from 'next';
import { listSourcingCandidates } from '@/lib/sourcing/service';
import { SourcingConsole } from '@/components/admin/sourcing-console';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Meesho sourcing — Admin', robots: { index: false } };

export default async function AdminSourcingPage() {
  const candidates = await listSourcingCandidates();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="eyebrow">Sourcing · Meesho</p>
        <h1>Find the listings worth reselling</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-ink-400">
          Meesho publishes no public product API — its Supplier API is partner-gated and only for
          onboarded suppliers — so this screen does not scrape or pretend to sync. You paste the
          numbers Meesho already shows, and the store scores price, return rate, demand, rating and
          trend into one verdict, then carries the real cost and margin into a draft product. Low
          return rate and a healthy margin always beat a high score with missing evidence.
        </p>
      </header>

      <SourcingConsole initial={candidates} />
    </div>
  );
}
