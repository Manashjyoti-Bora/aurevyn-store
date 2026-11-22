import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Card } from '@/components/ui/feedback';
import { Badge } from '@/components/ui/badge';
import { formatINR } from '@/lib/money';
import { formatDate } from '@/lib/utils';
import { loadDailyReport, type MetricBasis } from '@/lib/jarvis/report';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Daily operations report — Admin',
  robots: { index: false, follow: false },
};

const BASIS_TONE: Record<MetricBasis, 'green' | 'blue' | 'gray'> = {
  VERIFIED: 'green',
  ESTIMATE: 'blue',
  UNKNOWN: 'gray',
};

const BASIS_LABEL: Record<MetricBasis, string> = {
  VERIFIED: 'Verified',
  ESTIMATE: 'Estimate',
  UNKNOWN: 'Unknown',
};

function MetricValue({ value, unit }: { value: number; unit: 'MONEY' | 'COUNT' }) {
  return (
    <span className="font-semibold tabular-nums text-ink-900">
      {unit === 'MONEY' ? formatINR(value) : value.toLocaleString('en-IN')}
    </span>
  );
}

export default async function DailyReportPage() {
  let report: Awaited<ReturnType<typeof loadDailyReport>> | null = null;
  let error: string | null = null;
  try {
    report = await loadDailyReport();
  } catch {
    error = 'The report could not be built because the database is unreachable.';
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
          <Link href="/admin/jarvis" className="hover:text-brand-700">
            Jarvis control
          </Link>{' '}
          / Daily report
        </p>
        <h1 className="mt-1">Daily operations report</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-500">
          Every number states its basis. Verified means read from a confirmed record. Estimate is a
          projection and is never added to verified money. Unknown is shown as unknown, not zero.
        </p>
      </header>

      {error || !report ? (
        <Alert tone="error" title="Report unavailable">
          {error ?? 'No report data.'}
        </Alert>
      ) : (
        <>
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
                  Day (UTC)
                </p>
                <p className="text-lg font-semibold text-ink-900">
                  {formatDate(`${report.day}T00:00:00Z`)}
                </p>
              </div>
              <p className="max-w-xl text-sm text-ink-600">{report.headline}</p>
            </div>
            {report.ownerQueue.length > 0 && (
              <ul className="mt-4 space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {report.ownerQueue.map((item) => (
                  <li key={item}>· {item}</li>
                ))}
              </ul>
            )}
          </Card>

          {report.sections.map((section) => (
            <Card key={section.title} title={section.title} padded={false}>
              <table className="table-base">
                <thead className="bg-cream-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                      Measure
                    </th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                      Value
                    </th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                      Basis
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-900/5">
                  {section.metrics.map((metric) => (
                    <tr key={metric.key}>
                      <td className="px-4 py-2.5">
                        <p className="text-sm font-medium text-ink-800">{metric.label}</p>
                        <p className="mt-0.5 text-[11px] text-ink-400">{metric.note}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right align-top">
                        <MetricValue value={metric.value} unit={metric.unit} />
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <Badge tone={BASIS_TONE[metric.basis]}>{BASIS_LABEL[metric.basis]}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))}

          <p className="text-[11px] text-ink-400">
            Built from live order, payment, refund, supplier, catalogue, support and job records.
            No value on this page is projected forward or inferred from a supplier&apos;s promise.
          </p>
        </>
      )}
    </div>
  );
}
