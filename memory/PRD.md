# ATAKA — Операційна система спортивного клубу (PRD)

## Overview
Full-stack sports club CRM cloned from https://github.com/L2PAD/33edd3443434. Expo + FastAPI + NestJS + MongoDB. 5 роль-based кабінетів. Junior Sprint 3 FINAL завершено.

## Stack / Architecture
```
Expo SDK 54 → FastAPI :8001 → NestJS :3001 → MongoDB
  134 screens    121 endpoints    57 modules     29 collections
```

## Junior Sprint 3 — Action Loops + Behavior System

### ✅ FINAL MUST (Apr 18, 2026)

**1. XP backend link (реальний, не декоративний)**
- `POST /api/student/xp/apply` → оновлює `child.xp`, `child.discipline`, пише в `xp_activities`
- XP sources per behavior: `training_confirm=5`, `training_present=10`, `daily_task=5`, `absence_report=2`, `coach_message_sent=3`, `reschedule=3`, `achievement=50`, `belt_upgrade=100`
- Кожен `source` має `disc_delta` — дисципліна +1-5 балів
- Frontend: Confirm training → викликає `/xp/apply` → показує delta в alert ("+5 XP")

**2. Feed priority weight (3-level visual hierarchy)**
- Backend: `GET /api/student/feed` тепер вертає `priority` на кожному item
- Map: `coach_message|competition|absence_warning → critical (red)`; `achievement|belt|streak|xp|training → important (yellow)`; `club|announcement|photo|reminder|system → info (grey)`
- Frontend: `cardCritical` (red border + "ВАЖЛИВО" badge), `cardImportant` (yellow), `cardInfo` (subtle) + action buttons inverted color для critical

**3. Market "why this matters" microcontext**
- Backend: `GET /api/marketplace/featured` — кожен product тепер має `reason`:
  - `isCoachRecommended → "Рекомендовано тренером"`
  - `PROTECTION → "Використовується на змаганнях"`
  - `UNIFORM → "Потрібно для атестації"`
  - `EQUIPMENT → "Для повноцінних тренувань"`
  - `ACCESSORIES → "Зручність на тренуваннях"`
- Frontend: ProductTile + ProductCard показують `💡 {reason}` під назвою

**4. Competitions urgency countdown**
- Frontend (Home `CompetitionsBlock`):
  - `daysUntil ≤ 14` → rose border + `compCtaUrgent` (red CTA)
  - `daysUntil ≤ 7` → red border + hint "🔥 Скоро — час готуватись!"
  - Pressure line: "До турніру N днів · ще ~X тренувань"
  - Estimate: `max(1, floor(daysUntil / 3))` тренувань

### ✅ Sprint 3 Core (earlier)

**Market** (`market.tsx`) — 3 contextual sections:
- ⭐ Тренер рекомендує (from `/marketplace/featured.coachRecommended`)
- 🥋 Під твій пояс (WHITE/YELLOW → UNIFORM+PROTECTION; higher → EQUIPMENT+ACCESSORIES)
- 🏆 Підготовка до турніру (shown only when `junior.upcomingCompetitions[0]` exists)

**Schedule** (`schedule.tsx`) — `schedule-next-hero` operational card:
- Next/today training + group/location/time
- Today → [Підтвердити] / [Не прийду]; Future → [Показати у календарі]

**Feed → Home action loop**:
- `write_coach` action in Feed → `router.push('/(student)?openCoach=1')` → Home auto-opens coach modal via `useLocalSearchParams`

## Tests Summary (iteration_2)

| Area | Result |
|------|--------|
| Backend XP apply | ✅ 3/3 (success, delta, persist, log) |
| Backend Feed priority | ✅ 3/3 (critical/important/info mapping) |
| Backend Market reason | ✅ 3/3 (coach, category-based, all products) |
| Backend Competitions | ✅ 2/2 (daysUntil calc, home block) |
| Backend Regression | ✅ 4/4 (home, coachRecommended, upcomingCompetitions, xp field) |
| Frontend code review | ✅ All 10 feature assertions confirmed |

Testing agent also enriched `junior.xp` in `/student/home` response.

## Auth / Test Accounts
All 6 roles ready in `/app/memory/test_credentials.md`. OTP bypass `0000`.
- ADMIN +380501234567, OWNER +380500000001, COACH +380501234568
- PARENT +380501234569, STUDENT Junior +380991001010, STUDENT Adult +380501234571

## Mocked (as per original)
- WayForPay/Stripe payment (alert MOCKED)
- SMS OTP (bypass `0000`)
- Push Notifications (log only)
- Market order submit (MOCKED)
- AI recommendations (static MOCKED)

## Build / Run
```bash
cd /app/backend && pip install -r requirements.txt && npm install --legacy-peer-deps
npx tsc   # DO NOT use swc builder
node dist/seed.js && node dist/seed-real-club.js
# Frontend auto-started by supervisor
```

## Next Action Items (для наступних ітерацій — НЕ блокуюче)

### NICE (Junior — optional later)
- Absence pattern learning (weekday/reason/frequency analysis)
- AI recommendations replace mock (Claude via Emergent LLM key)
- Real push notifications (Expo Push)
- Global leaderboard (not only in-group)

### System Layer X10 (next sprint) — "system brain" cross-role economy
- Owner sees Coach influence → Revenue impact per coach
- Coach sees Student influence → Retention impact per student
- Student influences Owner → XP → discount → conversion → Revenue
