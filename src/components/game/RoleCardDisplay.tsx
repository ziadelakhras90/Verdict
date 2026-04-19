import { useState } from 'react'
import type { RoleCard, Role, PublicCaseInfo } from '@/lib/types'
import { ROLE_LABELS, ROLE_EMOJI, ROLE_COLOR_CLASS } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'
import { buildRoleDiscussionGuide } from '@/lib/roleDetails'

interface RoleCardDisplayProps {
  card: RoleCard
  caseTitle?: string
  caseInfo?: PublicCaseInfo | null
}

export function RoleCardDisplay({ card, caseTitle, caseInfo }: RoleCardDisplayProps) {
  const [revealed, setRevealed] = useState(false)
  const colorClass = ROLE_COLOR_CLASS[card.role as Role]
  const guide = buildRoleDiscussionGuide(card, caseInfo)

  return (
    <div className={cn(
      'rounded-2xl border-2 p-6 space-y-5 transition-all duration-500',
      colorClass,
      'animate-card-reveal'
    )}>
      <div className="text-center space-y-1">
        {caseTitle && (
          <p className="label-sm text-center mb-3">قضية: {caseTitle}</p>
        )}
        <div className="text-5xl mb-2">{ROLE_EMOJI[card.role as Role]}</div>
        <p className="label-sm">دورك في هذه القضية</p>
        <h2 className="font-display text-3xl text-parch-100">
          {ROLE_LABELS[card.role as Role]}
        </h2>
      </div>

      <div className="border-t border-white/10" />

      {!revealed ? (
        <div className="text-center py-4">
          <p className="text-ink-400 text-sm mb-4">معلوماتك السرية مخفية</p>
          <Button variant="ghost" onClick={() => setRevealed(true)}>
            🔍 اكشف معلوماتك
          </Button>
        </div>
      ) : (
        <div className="space-y-4 animate-fade-up">
          <div className="bg-black/30 rounded-xl p-4">
            <p className="label-sm mb-2">معلوماتك السرية</p>
            <p className="text-sm text-parch-200 leading-relaxed whitespace-pre-wrap">{card.private_info}</p>
          </div>
          <div className="bg-black/30 rounded-xl p-4">
            <p className="label-sm mb-2">شرط الفوز</p>
            <p className="text-sm text-parch-200 leading-relaxed whitespace-pre-wrap">{card.win_condition}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="bg-black/30 rounded-xl p-4">
              <p className="label-sm mb-2">كيف تدخل النقاش</p>
              <p className="text-sm text-parch-200 leading-relaxed">{guide.openingMove}</p>
            </div>
            <div className="bg-black/30 rounded-xl p-4">
              <p className="label-sm mb-2">أسئلة أو مداخلات مقترحة</p>
              <ul className="space-y-1.5">
                {guide.questionPrompts.slice(0, 3).map((point, index) => (
                  <li key={`${point}-${index}`} className="text-sm text-parch-200 leading-6 flex gap-2">
                    <span className="text-gold/50 mt-0.5">؟</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {card.knows_truth && (
            <div className="bg-gold/10 border border-gold/30 rounded-xl p-3 text-center">
              <p className="text-xs text-gold">⚠️ أنت تعرف الحقيقة — استخدمها بذكاء ولا تكشفها مباشرة</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
