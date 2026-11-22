import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/feedback';
import { TableWrap, Th, Td } from '@/components/ui/table';
import { KnowledgeForm } from '@/components/admin/knowledge-form';
import { KnowledgeRecheckButton } from '@/components/admin/knowledge-recheck-button';
import {
  SOURCE_LABEL,
  isStale,
  knowledgeBadge,
  type KnowledgeSourceType,
} from '@/lib/jarvis/knowledge';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Knowledge base — Admin',
  robots: { index: false, follow: false },
};

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

const iso = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null);

export default async function KnowledgePage() {
  const entries = await safe(
    prisma.knowledgeEntry.findMany({
      orderBy: [{ status: 'asc' }, { category: 'asc' }, { updatedAt: 'desc' }],
      take: 200,
    }),
    []
  );

  const labels = entries.map((entry) =>
    knowledgeBadge({
      confidence: entry.confidence,
      status: entry.status,
      reviewBy: iso(entry.reviewBy),
      verifiedAt: iso(entry.verifiedAt),
    })
  );
  const verified = labels.filter((l) => l.label === 'Verified').length;
  const needsRecheck = entries.filter((entry) =>
    isStale({ reviewBy: iso(entry.reviewBy), status: entry.status })
  ).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
            <Link href="/admin/jarvis" className="hover:text-brand-700">
              Jarvis control
            </Link>{' '}
            / Knowledge
          </p>
          <h1 className="mt-1">Knowledge base</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-500">
            Sourced operating knowledge. A claim is labelled Verified only when an official or
            primary source, its title and the date it was read are recorded — otherwise it is shown
            as an estimate, assumption or recommendation. Nothing here overrides code or policy.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <Badge tone="green">{verified} verified</Badge>
          <Badge tone={needsRecheck > 0 ? 'amber' : 'gray'}>{needsRecheck} need recheck</Badge>
          <Badge tone="gray">{entries.length} entries</Badge>
        </div>
      </header>

      <Card title="Add a sourced entry">
        <KnowledgeForm />
      </Card>

      <Card title="All entries" padded={false}>
        {entries.length === 0 ? (
          <p className="p-4 text-sm text-ink-400">
            No entries yet. Add the first one above; an unsourced note is still useful as long as it
            is labelled an assumption.
          </p>
        ) : (
          <TableWrap>
            <table className="table-base">
              <thead className="bg-cream-50">
                <tr>
                  <Th>Entry</Th>
                  <Th className="hidden md:table-cell">Category</Th>
                  <Th>Status</Th>
                  <Th className="hidden lg:table-cell">Source</Th>
                  <Th className="hidden xl:table-cell">Next recheck</Th>
                  <Th className="text-right">Evidence</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-900/5">
                {entries.map((entry, index) => {
                  const badge = labels[index];
                  return (
                    <tr key={entry.id}>
                      <Td>
                        <p className="text-sm font-semibold text-ink-900">{entry.title}</p>
                        <p className="mt-0.5 max-w-md text-xs text-ink-500">{entry.summary}</p>
                        <p className="mt-1 font-mono text-[10px] text-ink-400">
                          {entry.slug} · v{entry.version}
                        </p>
                      </Td>
                      <Td className="hidden text-xs text-ink-600 md:table-cell">{entry.category}</Td>
                      <Td>
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                        {entry.status === 'CURRENT' && entry.confidence !== 'VERIFIED' && (
                          <p className="mt-1 text-[10px] text-ink-400">{entry.confidence}</p>
                        )}
                      </Td>
                      <Td className="hidden max-w-xs lg:table-cell">
                        <p className="text-xs text-ink-600">
                          {SOURCE_LABEL[entry.sourceType as KnowledgeSourceType] ??
                            entry.sourceType}
                        </p>
                        {entry.sourceUrl ? (
                          <a
                            href={entry.sourceUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="break-all text-[11px] text-brand-700 hover:underline"
                          >
                            {entry.sourceUrl}
                          </a>
                        ) : (
                          <p className="text-[11px] text-ink-400">No URL recorded</p>
                        )}
                        <p className="text-[10px] text-ink-400">
                          {entry.sourceTitle ?? '—'} · checked {iso(entry.verifiedAt) ?? 'never'}
                        </p>
                      </Td>
                      <Td className="hidden text-xs text-ink-500 xl:table-cell">
                        {iso(entry.reviewBy) ?? 'not scheduled'}
                      </Td>
                      <Td className="text-right">
                        <KnowledgeRecheckButton id={entry.id} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      <p className="text-[11px] text-ink-400">
        Rechecking records the date you re-read the source and moves the next review date forward;
        it does not change what the entry claims. Archived entries are retained for the record.
      </p>
    </div>
  );
}
