import type { WeeklyReview } from '../../lib/ai'
import { Card, SectionTitle } from '../../components/ui/primitives'

function List({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div>
      <div className={`mb-1.5 text-[11px] font-bold uppercase tracking-widest ${tone}`}>{title}</div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-ink-soft">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-ink-mute" />
            {it}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function WeeklyReviewCard({
  review,
  source,
}: {
  review: WeeklyReview
  source?: string
}) {
  return (
    <Card>
      <SectionTitle
        title="Weekly Review"
        hint={`${review.rangeLabel} · ${review.trades} trade closed`}
        right={
          source ? (
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-ink-mute">
              {source}
            </span>
          ) : undefined
        }
      />
      <p className="rounded-lg border border-border-soft bg-surface-2/50 px-3 py-2.5 text-[13px] text-ink">
        {review.summary}
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <List title="Yang berjalan baik" items={review.wins} tone="text-win" />
        <List title="Yang perlu diwaspadai" items={review.watch} tone="text-warn" />
        <List title="Aksi minggu depan" items={review.actions} tone="text-brand" />
      </div>
    </Card>
  )
}
