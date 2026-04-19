import type { PublicCaseInfo } from '@/lib/types'
import { CATEGORY_LABELS } from '@/lib/types'
import { Badge } from '@/components/ui'
import { cn } from '@/lib/utils'

interface CaseInfoPanelProps {
  caseInfo: PublicCaseInfo
  compact?: boolean
}

const DIFFICULTY_STARS = ['', '★', '★★', '★★★']

export function CaseInfoPanel({ caseInfo, compact = false }: CaseInfoPanelProps) {
  const visibleFacts = compact
    ? (caseInfo.public_facts ?? []).slice(0, 2)
    : (caseInfo.public_facts ?? [])

  return (
    <div className={cn('space-y-3', compact ? '' : 'card-glass rounded-2xl p-5')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-sm mb-1">القضية الحالية</p>
          <h2 className={cn('font-display text-gold', compact ? 'text-lg' : 'text-2xl')}>
            {caseInfo.title}
          </h2>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <Badge
            label={CATEGORY_LABELS[caseInfo.category] ?? caseInfo.category}
            color="gold"
          />
          <span className="text-gold/60 text-sm" title={`صعوبة ${caseInfo.difficulty}`}>
            {DIFFICULTY_STARS[caseInfo.difficulty ?? 1]}
          </span>
        </div>
      </div>

      <p className={cn('text-parch-300 leading-relaxed', compact ? 'text-xs' : 'text-sm')}>
        {caseInfo.public_summary}
      </p>

      {visibleFacts.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="label-sm">حقائق مُعلنة للنقاش</p>
          <ul className="space-y-1">
            {visibleFacts.map((fact, i) => (
              <li key={`${fact}-${i}`} className={cn('flex gap-2 text-parch-300', compact ? 'text-xs' : 'text-sm')}>
                <span className="text-gold/50 select-none mt-0.5">◆</span>
                <span>{fact}</span>
              </li>
            ))}
          </ul>
          {compact && (caseInfo.public_facts?.length ?? 0) > visibleFacts.length && (
            <p className="text-[11px] text-ink-500">افتح تفاصيل القضية لرؤية باقي الحقائق.</p>
          )}
        </div>
      )}
    </div>
  )
}
