import type { RoleCard, Role } from '@/lib/types'
import { ROLE_EMOJI, ROLE_LABELS } from '@/lib/types'
import { cn } from '@/lib/utils'

interface RoleSummaryPanelProps {
  card: RoleCard
  compact?: boolean
}

export function RoleSummaryPanel({ card, compact = false }: RoleSummaryPanelProps) {
  return (
    <div className={cn(
      'rounded-2xl border border-gold/20 bg-ink-900/70 shadow-soft',
      compact ? 'p-4 space-y-3' : 'p-5 space-y-4'
    )}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-sm mb-1">بطاقتك السرية</p>
          <h3 className={cn('font-display text-gold flex items-center gap-2', compact ? 'text-lg' : 'text-xl')}>
            <span className="text-xl">{ROLE_EMOJI[card.role as Role]}</span>
            <span>{ROLE_LABELS[card.role as Role]}</span>
          </h3>
        </div>
        {card.knows_truth && (
          <span className="text-[10px] px-2 py-1 rounded-full border border-gold/25 bg-gold/10 text-gold whitespace-nowrap">
            يعرف الحقيقة
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <p className="label-sm mb-1">ما تعرفه</p>
          <p className="text-sm text-parch-200 leading-relaxed whitespace-pre-wrap">{card.private_info}</p>
        </div>
        <div className="pt-2 border-t border-gold/10">
          <p className="label-sm mb-1">هدفك</p>
          <p className="text-sm text-parch-300 leading-relaxed whitespace-pre-wrap">{card.win_condition}</p>
        </div>
      </div>
    </div>
  )
}
