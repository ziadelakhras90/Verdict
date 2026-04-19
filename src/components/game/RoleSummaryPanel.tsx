import type { RoleCard, Role, PublicCaseInfo } from '@/lib/types'
import { ROLE_EMOJI, ROLE_LABELS } from '@/lib/types'
import { cn } from '@/lib/utils'
import { buildRoleDiscussionGuide, getRoleSummaryHeadline } from '@/lib/roleDetails'

interface RoleSummaryPanelProps {
  card: RoleCard
  caseInfo?: PublicCaseInfo | null
  compact?: boolean
}

export function RoleSummaryPanel({ card, caseInfo, compact = false }: RoleSummaryPanelProps) {
  const guide = buildRoleDiscussionGuide(card, caseInfo)

  return (
    <div className={cn(
      'rounded-2xl border border-gold/20 bg-ink-900/70 shadow-soft',
      compact ? 'p-4 space-y-4' : 'p-5 space-y-5'
    )}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-sm mb-1">بطاقتك السرية</p>
          <h3 className={cn('font-display text-gold flex items-center gap-2', compact ? 'text-lg' : 'text-xl')}>
            <span className="text-xl">{ROLE_EMOJI[card.role as Role]}</span>
            <span>{ROLE_LABELS[card.role as Role]}</span>
          </h3>
          <p className="text-xs text-parch-300 mt-2 leading-6">
            {getRoleSummaryHeadline(card.role as Role)}
          </p>
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
          <p className="label-sm mb-2">كيف تبدأ النقاش</p>
          <p className="text-sm text-parch-300 leading-relaxed">{guide.openingMove}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-gold/10 bg-black/20 p-3">
            <p className="label-sm mb-2">نقاط ركّز عليها</p>
            <ul className="space-y-1.5">
              {guide.focusPoints.map((point, index) => (
                <li key={`${point}-${index}`} className="text-sm text-parch-300 leading-6 flex gap-2">
                  <span className="text-gold/50 mt-0.5">◆</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-gold/10 bg-black/20 p-3">
            <p className="label-sm mb-2">أسئلة ومداخلات مقترحة</p>
            <ul className="space-y-1.5">
              {guide.questionPrompts.map((point, index) => (
                <li key={`${point}-${index}`} className="text-sm text-parch-300 leading-6 flex gap-2">
                  <span className="text-gold/50 mt-0.5">؟</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {guide.publicAngles.length > 0 && (
          <div className="rounded-xl border border-gold/10 bg-black/20 p-3">
            <p className="label-sm mb-2">حقائق عامة يمكنك البناء عليها</p>
            <ul className="space-y-1.5">
              {guide.publicAngles.map((fact, index) => (
                <li key={`${fact}-${index}`} className="text-sm text-parch-300 leading-6 flex gap-2">
                  <span className="text-gold/50 mt-0.5">•</span>
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-2 border-t border-gold/10">
          <p className="label-sm mb-1">هدفك وما يجب الانتباه له</p>
          <p className="text-sm text-parch-300 leading-relaxed whitespace-pre-wrap">{card.win_condition}</p>
          <ul className="mt-3 space-y-1.5">
            {guide.cautionPoints.map((point, index) => (
              <li key={`${point}-${index}`} className="text-sm text-parch-300 leading-6 flex gap-2">
                <span className="text-gold/50 mt-0.5">!</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
