# Exam Practice module: build spec

Add a new section called **Exam Practice** to the existing dashboard.

Stack already in use: Next.js (App Router), Neon PostgreSQL, deployed on Vercel. Match the existing palette (Champagne Mist, Khaki Beige, Dusty Olive, Dark Coffee, Blush Rose) and the Cormorant/Playfair serif headers used elsewhere in the app.

Two data files ship with this spec:

- `micro_ch1_cards.json` — 944 study cards, grouped into 10 chapters
- `glossary.json` — 196 term-to-definition pairs

---

## 1. What this module is for

It is a spaced-repetition study tool that must work for **any course**, not only microbiology. Microbiology Exam 1 is the first course loaded; organic chemistry and others follow. Nothing in the schema or UI should hardcode microbiology.

The user studies by: picking a course, toggling on the chapters she is currently responsible for, setting a timer, and running cards until the timer ends or the queue empties.

---

## 2. Database schema (Neon Postgres)

```sql
create table course (
  id            serial primary key,
  name          text not null,              -- 'Microbiology'
  term          text,                       -- 'Fall 2026'
  exam_name     text,                       -- 'Exam 1'
  exam_date     date,
  created_at    timestamptz default now()
);

create table chapter (
  id            serial primary key,
  course_id     int references course(id) on delete cascade,
  ordinal       int not null,               -- 1..n, controls display order
  name          text not null,              -- 'Cytology I: Cell Structures'
  active        boolean default true,       -- the on/off toggle
  unique (course_id, ordinal)
);

create table card (
  id            serial primary key,
  chapter_id    int references chapter(id) on delete cascade,
  kind          text not null,              -- 'cloze' | 'basic' | 'rev' | 'img'
  prompt        text not null,
  answer        text not null,              -- for kind='img', a data URI or /public path
  extra         text,                       -- 'rev' cards: the why-that-direction line
  full_text     text,                       -- cloze only: the un-blanked sentence
  tags          text[] default '{}'
);

create table review (
  id            serial primary key,
  card_id       int references card(id) on delete cascade,
  streak        int  default 0,             -- consecutive correct pulls
  interval_days int  default 0,
  due_at        timestamptz default now(),
  lapses        int  default 0,
  last_grade    text,                       -- 'again' | 'hard' | 'easy'
  updated_at    timestamptz default now()
);
create index on review (due_at);

create table study_session (
  id            serial primary key,
  course_id     int references course(id),
  started_at    timestamptz default now(),
  ended_at      timestamptz,
  planned_min   int,                        -- timer length chosen
  actual_sec    int,
  cards_seen    int default 0,
  cards_correct int default 0
);

create table glossary (
  id            serial primary key,
  course_id     int references course(id) on delete cascade,
  term          text not null,
  definition    text not null,
  unique (course_id, term)
);
```

Single-user app, so no user_id column is needed.

---

## 3. Seed script

Write `scripts/seed-exam-practice.ts`, runnable with `npx tsx`.

1. Insert one course: name `Microbiology`, exam_name `Exam 1`, term `Fall 2026`. Leave `exam_date` null; the user sets it in the UI.
2. Read `micro_ch1_cards.json`. It is an array of 10 objects, each `{ name, cards[] }`. The `name` begins with a two-digit ordinal and a space, for example `"02 Cytology I: Cell Structures"`. Split on the first space: the number becomes `chapter.ordinal`, the remainder becomes `chapter.name`.
3. Each element of `cards[]` has:
   - `t` → `card.kind` (`cloze`, `basic`, `rev`, `img`)
   - `q` → `card.prompt`
   - `a` → `card.answer`
   - `why` → `card.extra` (present only on `rev` cards)
   - `full` → `card.full_text` (present only on `cloze` cards)
   - `id` → discard; use the database serial instead
4. For every inserted card, insert one `review` row with defaults, so every card starts due immediately.
5. Read `glossary.json`, a flat `{ term: definition }` object, and insert each pair against the microbiology course.

Make the script idempotent: if a course named `Microbiology` with exam_name `Exam 1` already exists, delete its chapters and cascade before re-inserting, rather than duplicating.

Note on cloze prompts: they contain literal `_____` (five underscores) where the blank goes. Render that as a styled span, do not strip it.

---

## 4. Screens

### 4.1 Course list — `/exam-practice`

Cards for each course showing name, exam name, days until exam if `exam_date` is set, and total cards due across active chapters. An "Add course" button opens a form for name, term, exam name, exam date.

### 4.2 Course detail — `/exam-practice/[courseId]`

The main screen. Three regions.

**Chapter toggles.** A row per chapter showing ordinal, name, total cards, known count, due count, and a progress bar. Each row has a switch bound to `chapter.active`. Toggling writes immediately, no save button. "All on" and "All off" buttons at the top. Only active chapters contribute cards to a session, and this is the single most important control in the module.

**Timer.** Preset buttons for 10, 15, 25 and 45 minutes, plus a custom field. A 25-minute default is fine. The chosen value is stored on the session row as `planned_min`.

**Start.** A single button reading "Start N-minute session · M cards due". Disabled when no chapters are active.

### 4.3 Session runner — `/exam-practice/[courseId]/session`

A countdown timer pinned at the top, along with cards remaining and current hit rate. One card at a time, centred.

Flow per card: show prompt → user taps "Show answer" → answer appears → three grade buttons appear: **Again**, **Hard**, **Easy**.

At zero the timer stops the session at the end of the current card, never mid-card, and routes to the summary.

Keyboard shortcuts on desktop: space reveals, then 1/2/3 grade.

### 4.4 Summary

Cards seen, recalled, missed, hit rate, elapsed time, and a per-chapter breakdown of what was missed. Write the `study_session` row here.

---

## 5. Scheduling algorithm

Modified SM-2. On grade:

```
again → streak = 0, interval = 0, due_at = now, lapses += 1
        and re-queue the card 4 positions later in the current session
hard  → streak += 1, interval = [1,2,4,8,15][min(streak-1,4)]  days
easy  → streak += 1, interval = [2,4,8,16,30][min(streak-1,4)] days
        due_at = now + interval days
```

A card counts as **known** at `streak >= 2`. Chapter "known" counts use that threshold.

Queue for a session: all cards from active chapters where `due_at <= now`, shuffled. If nothing is due, fall back to all cards from active chapters, shuffled, and label the session "Early review" so the user knows the difference.

---

## 6. Tap-a-word glossary

This is the feature that matters most to the user, so do not treat it as optional polish.

Every technical term appearing in a card prompt or answer should be tappable, opening a bottom sheet with a plain-English definition. Implementation:

- Load the course's glossary rows once and hold them in a client-side map.
- Sort terms longest-first before matching, so `proton motive force` wins over `proton`.
- Match case-insensitively on whole words only. Use a boundary check that treats hyphens as part of a word, so `acid-fast` matches as a unit and `acid` inside it does not match separately.
- Wrap each hit in a span with a dotted underline in Blush Rose. Tapping opens the sheet with the term and its definition and a single "Got it" button.
- Never mutate stored card text. Do the wrapping at render time.
- The sheet must not advance or grade the card.

Also add a searchable glossary browser at `/exam-practice/[courseId]/glossary`, and let the user add or edit entries there, since new courses will need their own terms.

---

## 7. Card rendering by kind

| kind | Front | Back |
|---|---|---|
| `cloze` | prompt with `_____` styled as a highlighted blank | the missing text |
| `basic` | the question | the answer |
| `rev` | the pair name, plus the fixed line "State both sides, and which way round." | `answer`, then `extra` rendered below as "Why that direction: …" |
| `img` | the recall prompt | the image from `answer` |

`rev` cards are reversal traps, the user's documented weak spot. Give them a visible label in the runner so she knows one is coming.

---

## 8. Adding future courses

Provide `/exam-practice/import`, accepting a JSON upload in the same shape as `micro_ch1_cards.json` plus an optional glossary object, with a course-name field. This is how organic chemistry gets loaded later without another migration.

---

## 9. Out of scope for v1

Multi-user support, card authoring inside the app, images beyond those already embedded as data URIs, and syncing with any external flashcard service.
