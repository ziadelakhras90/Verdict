import type { PublicCaseInfo, RoleCard, Role } from '@/lib/types'
import { ROLE_LABELS } from '@/lib/types'

type DiscussionGuide = {
  openingMove: string
  focusPoints: string[]
  questionPrompts: string[]
  cautionPoints: string[]
  publicAngles: string[]
}

const ROLE_PLAYBOOK: Record<Role, Omit<DiscussionGuide, 'publicAngles'>> = {
  defendant: {
    openingMove: 'ابدأ بهدوء: أنكر التهمة مباشرة، ثم قدم خط سيرك والزمن الذي كنت فيه بعيدًا عن الفعل.',
    focusPoints: [
      'ثبّت أين كنت وقت الحادثة ومن رآك.',
      'اطلب دليلًا مباشرًا بدل الظنون والدوافع العامة.',
      'اذكر ما يضعف فكرة أنك المستفيد الوحيد من الجريمة.',
    ],
    questionPrompts: [
      'من لديه دليل مادي مباشر ضدي؟',
      'من كان أقرب للمكان أو الأداة منّي؟',
      'ما الجزء الذي بُني فقط على الظن لا على المشاهدة؟',
    ],
    cautionPoints: [
      'لا تغيّر قصتك الزمنية أثناء النقاش.',
      'لا تنفعل في كل نقطة؛ اختر التناقضات المهمة فقط.',
    ],
  },
  defense_attorney: {
    openingMove: 'ابدأ ببناء الشك المعقول: فرّق بين الاشتباه وبين الإدانة، واطلب سلسلة أدلة كاملة.',
    focusPoints: [
      'هاجم الفجوات في الأدلة والزمن والدافع.',
      'أعد صياغة أقوال الشهود بدقة حتى لا تُحمّل أكثر مما قالوه.',
      'سلّط الضوء على كل بديل منطقي لم يُفحص جيدًا.',
    ],
    questionPrompts: [
      'أين الدليل المباشر الذي يربط موكلي بالفعل؟',
      'من الذي استفاد فعلاً إذا استبعدنا الرواية الظاهرة؟',
      'هل توجد شهادة دقيقة أم مجرد استنتاجات؟',
    ],
    cautionPoints: [
      'لا تَعِد القاضي بما لا تستطيع إثباته.',
      'ركّز على تفكيك القضية بدل الاندفاع في قصة بديلة غير مكتملة.',
    ],
  },
  prosecutor: {
    openingMove: 'ابدأ ببناء رواية مترابطة: دافع + فرصة + سلوك مريب، ثم اطلب من الآخرين سد الثغرات إن استطاعوا.',
    focusPoints: [
      'حوّل التفاصيل المتفرقة إلى خط اتهام واضح.',
      'اختبر تناقضات المتهم والشهود في التوقيت والتصرف.',
      'اجعل القاضي يرى لماذا يبدو الاتهام منطقيًا حتى لو لم يعرف الحقيقة الكاملة.',
    ],
    questionPrompts: [
      'ما تفسيركم للدافع الواضح هنا؟',
      'من كان يملك الفرصة العملية لتنفيذ الفعل؟',
      'ما التناقض الذي ظهر في أقوال الطرف المقابل؟',
    ],
    cautionPoints: [
      'لا تعتمد على الدافع وحده إذا انهارت بقية السلسلة.',
      'لا تبالغ في وصف ما لم يثبته شاهد أو حقيقة عامة.',
    ],
  },
  judge: {
    openingMove: 'ابدأ بتحديد ما تريد سماعه: التسلسل الزمني، أقوى دليل لكل طرف، وأكبر تناقض لم يُفسر.',
    focusPoints: [
      'التمييز بين الوقائع المؤكدة وما هو استنتاج أو تفسير.',
      'إجبار الجميع على الوضوح: من؟ متى؟ لماذا؟',
      'تسجيل التناقضات التي تؤثر فعلًا في الحكم النهائي.',
    ],
    questionPrompts: [
      'ما أقوى دليل مباشر لديكم؟',
      'ما الفجوة الزمنية أو المنطقية التي لم تُفسر بعد؟',
      'من لديه مصلحة في تضليل المحكمة؟',
    ],
    cautionPoints: [
      'لا تعلن قناعتك مبكرًا حتى لا توجّه النقاش.',
      'افصل بين الانطباع الشخصي وقيمة الدليل.',
    ],
  },
  deputy: {
    openingMove: 'ابدأ بدور تنظيمي: لخص الوقائع المعلنة واسأل عن النقاط التي لا تزال ضبابية.',
    focusPoints: [
      'ساعد القاضي على ترتيب الأحداث زمنيًا.',
      'استخدم المعلومات التنظيمية أو الوثائقية لإيضاح الصورة.',
      'اطرح أسئلة قصيرة تكشف الفراغات بين الروايات.',
    ],
    questionPrompts: [
      'أي معلومة عامة لم يفسرها أحد حتى الآن؟',
      'من كان مسؤولًا عن الترتيب أو الوصول أو الأدوات؟',
      'أين يوجد تعارض بين ما قيل وبين الحقائق المعلنة؟',
    ],
    cautionPoints: [
      'لا تتحول إلى طرف منحاز؛ دورك إبراز الوضوح.',
      'لا تقدم استنتاجًا نهائيًا بدل القاضي.',
    ],
  },
  witness: {
    openingMove: 'ابدأ بما رأيته أو سمعته فقط، واذكر حدود معرفتك بوضوح حتى تبدو شهادتك موثوقة.',
    focusPoints: [
      'كن دقيقًا في الوصف: ماذا رأيت بالضبط؟',
      'فرّق بين ما شهدته شخصيًا وما سمعته من غيرك.',
      'تفصيل صغير صادق أفضل من قصة كبيرة غير مؤكدة.',
    ],
    questionPrompts: [
      'هل تريدون مني وصف ما رأيته أم ما استنتجته؟',
      'من كان قريبًا من المكان أو الأداة وقتها؟',
      'أي جزء من شهادتي يمكن أن يغيّر فهمكم للتوقيت؟',
    ],
    cautionPoints: [
      'لا تضف تفاصيل لم تراها بنفسك.',
      'إذا كنت غير متأكد من شيء فقل ذلك بوضوح.',
    ],
  },
}

function splitIntoPoints(text: string, limit = 4): string[] {
  return text
    .split(/[\n\.،؛!؟]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part, index, arr) => arr.indexOf(part) === index)
    .slice(0, limit)
}

export function buildRoleDiscussionGuide(card: RoleCard, caseInfo?: PublicCaseInfo | null): DiscussionGuide {
  const playbook = ROLE_PLAYBOOK[card.role as Role]
  const privatePoints = splitIntoPoints(card.private_info, 3)
  const winPoints = splitIntoPoints(card.win_condition, 2)
  const publicAngles = (caseInfo?.public_facts ?? []).slice(0, 3)

  return {
    openingMove: playbook.openingMove,
    focusPoints: [...privatePoints, ...playbook.focusPoints].slice(0, 5),
    questionPrompts: playbook.questionPrompts,
    cautionPoints: [...winPoints, ...playbook.cautionPoints].slice(0, 4),
    publicAngles,
  }
}

export function getRoleSummaryHeadline(role: Role): string {
  return `أنت ${ROLE_LABELS[role]} — استخدم معلوماتك لدفع النقاش في الاتجاه المناسب.`
}
