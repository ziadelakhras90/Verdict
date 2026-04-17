# ⚖️ قاعة المحكمة — Courthouse Game

لعبة أدوار اجتماعية/محكمة قائمة على المتصفح.  
مبنية بـ **React + Vite + TypeScript + Supabase** — تُنشر على **Netlify**.

---

## Quick Start

### 1. المتطلبات
- Node.js 18+
- حساب على [Supabase](https://supabase.com)
- حساب على [Netlify](https://netlify.com)

### 2. إعداد Supabase

1. أنشئ مشروعاً جديداً على supabase.com
2. انتقل إلى **SQL Editor**
3. نفِّذ الملفات بهذا الترتيب:
   ```
   supabase/migrations/001_full_schema.sql   ← Schema + RLS + sample case
   supabase/migrations/002_more_cases.sql    ← قضيتان إضافيتان
   supabase/migrations/003_fix_status_constraint.sql  ← إصلاح constraint
   supabase/migrations/004_hardening_and_finish_flow.sql  ← finish/reveal hardening
   supabase/migrations/005_database_hardening.sql  ← DB constraints + unique indexes
   ```
4. من **Project Settings → API** احفظ:
   - `Project URL`
   - `anon public key`

### 3. إعداد المشروع

```bash
npm install
cp .env.example .env
# عدِّل .env بـ URL و anon key
npm run dev
```

### 4. نشر Edge Functions

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF

supabase functions deploy start-game
supabase functions deploy begin-session
supabase functions deploy advance-session
supabase functions deploy reveal-truth
supabase functions deploy submit-verdict
```

### 5. النشر على Netlify

- Build command: `npm run build`
- Publish directory: `dist`
- أضف: `VITE_SUPABASE_URL` و `VITE_SUPABASE_ANON_KEY`

---

## Game Flow

```
Lobby (waiting)
   ↓ host clicks start
   ↓ [Edge: start-game] — assigns roles + sets status='starting'
Card Reading (starting)
   ↓ each player reads their secret role card
   ↓ host clicks "Begin Session 1"
   ↓ [Edge: begin-session] — sets status='in_session'
Session 1 → 2 → 3 (in_session)
   ↓ players post statements/questions/objections
   ↓ judge advances each session  [Edge: advance-session]
Verdict Phase (verdict)
   ↓ judge submits verdict  [Edge: submit-verdict]
Reveal Truth (reveal)
   ↓ host reveals truth  [Edge: reveal-truth] — computes winners
Results (finished)
```

---

## Roles & Win Conditions

| الدور | الهدف | يعرف الحقيقة؟ |
|---|---|---|
| المتهم | الحصول على حكم البراءة | ✅ |
| محامي الدفاع | إثبات براءة موكله | ✅ |
| محامي الادعاء | الحصول على حكم الإدانة | ❌ |
| القاضي | حكمه يطابق الحقيقة | ❌ |
| النائب | مساعدة على الوصول للحقيقة | ❌ |
| الشاهد | شهادة صادقة تقود للحقيقة | ❌ |

---

## Sample Cases (3 included)

| القضية | الفئة | صعوبة | لاعبون |
|---|---|---|---|
| السكرتيرة المختفية | قتل | ★★ | 4-6 |
| العقد المسروق | سرقة | ★ | 4-5 |
| رئيس الشركة المسموم | قتل | ★★★ | 5-6 |

---

## Security Architecture

- **RLS** مفعّلة على كل الجداول
- `player_role_data` → كل لاعب يقرأ كارته فقط (`player_id = auth.uid()`)
- `case_templates` → محظور على الـ client — يُقرأ عبر `public_case_info` view فقط
- `actual_verdict` + `hidden_truth` → لا تُرسل للـ client أبدًا — Edge Functions فقط
- كل العمليات الحساسة تستخدم `SUPABASE_SERVICE_ROLE_KEY`

---

## Project Structure

```
src/
├── actions/          createRoom, joinRoom, startGame, beginSession, ...
├── components/
│   ├── game/         EventFeed, RoleCardDisplay, SessionTimer, CountdownRing, CaseInfoPanel
│   ├── layout/       AppShell, ProtectedRoute
│   ├── room/         PlayerList
│   └── ui/           Button, Card, Avatar, Input, Modal, Toast, ...
├── hooks/            useAuth, useRoom, useRoomGuard, useSessionTimer, useToast, ...
├── lib/              supabase.ts, types.ts, utils.ts
├── pages/            Home, Auth, CreateRoom, JoinRoom, Lobby, RoleCard,
│                     Session, JudgePanel, Verdict, Reveal, Results, NotFound
├── stores/           authStore, roomStore
└── router.tsx

supabase/
├── config.toml
├── functions/        start-game, begin-session, advance-session, submit-verdict, reveal-truth
└── migrations/       001 schema, 002 cases, 003 fix, 004 hardening, 005 db hardening
```

---

## Stability Improvements Included

النسخة الحالية تتضمن تحسينات مهمة على الثبات والتعامل مع الـreconnect والـrace conditions:
- Resume / reconnect flow من Home و Auth
- Route guard موحد حسب حالة الغرفة ودور اللاعب
- حماية من double-submit في العمليات الحساسة
- Idempotency في Edge Functions الأساسية
- تقليل flicker وstale data في `useRoom` و `roomStore`
- Reveal / Results flow أكثر أمانًا عند تأخر البيانات
- Database hardening عبر constraints و unique indexes

---

## Verification

راجع ملف [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) قبل الإطلاق أو بعد أي تغييرات حساسة على Supabase / Edge Functions.

## Testing

See `TESTING.md` for the automated and manual test plan.
