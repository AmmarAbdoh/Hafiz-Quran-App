# Memorisation helper (حفظي) — implementation plan

**Written for:** the session that builds this, start to finish, without having
seen the conversation that produced it. Read it whole before writing code.
Supersedes the earlier draft of this file.

**What the user asked for:** mark the pages they have finished memorising,
and be told which pages and surahs to review because it has been a while -
before the app is wrapped for the stores.

---

## 0. Ground rules for the session

- Follow `AGENTS.md` and `.agents/skills/artqiy-maintainer/SKILL.md`, and keep
  `INVARIANTS.md` true. In particular: `app -> features -> domain -> shared`;
  another feature only through its `index.ts`; no `useMemo`/`useCallback`
  unless identity or a measured cost needs it; effects only for external
  systems; Arabic first, both directions checked; persisted data migrated,
  never silently dropped.
- **Home and Settings must not request Quran data** (the maintainer skill).
  Anything Home shows comes from the memorisation store and static tables.
- **The user commits.** Leave the work uncommitted. Never `git add -A`.
- Node is 24 on this machine: run tests with no `NODE_OPTIONS`.
- Gate before handing back: `npm run check` (format, types, lint, coverage,
  knip, data:verify, audit, build, budget, Playwright).
- Build each phase whole - model, storage, UI, strings in both languages,
  tests - and stop at its "done when" before starting the next.
- No new dependencies. Dates are done with `Date` and plain arithmetic, as
  below.

## 1. Decisions already made (do not reopen)

| Question                        | Decision                                                                                                                                                                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What is "memorised"?            | A set of **ayat**, stored as ranges per surah. Pages and surahs are derived. Juz 'Amma pages hold several surahs; someone who knows An-Nas has not memorised page 604.                                                              |
| What is reviewed and scheduled? | The **page** (604, Madani mushaf). It is how hifz is revised. A page with only some ayat memorised is reviewed for those ayat.                                                                                                      |
| Scheduling model                | **Leitner boxes** (§4). Explainable ("you got it right a week ago"), needs no history to work. FSRS stays possible: review events are kept.                                                                                         |
| Grading                         | The reader grades themselves, three buttons: **متقن** (perfect), **أخطاء يسيرة** (a few slips), **يحتاج مراجعة** (needs work).                                                                                                      |
| "Today"                         | The device's **local calendar day, from midnight**. No day-start setting: `localDateOf` is the one place to change if that is ever wanted.                                                                                          |
| Review load                     | A **review goal the user picks**: N pages a day, or N pages a week. Today's list is shaped to meet it: capped when more is due, topped up from what is due soonest when less is (§4.4). New pages are always in, and count.         |
| Navigation                      | A **fifth bottom-nav tab, "حفظي"**, opening the hub `/hifz`. "مراجعة / Review" stays the quiz.                                                                                                                                      |
| تسميع                           | **Optional input, later, free** (Phase 6). Nothing in Phases 0-5 imports `recitation-practice`. Quran-Lab's NPL-1.2 forbids charging for anything the model powers; keeping it out of the core keeps the helper free of that.       |
| Storage                         | `localStorage` through `safeStorage`, one JSON document, versioned. Export/import from Phase 2, because it is the only backup and the only way to carry progress into the future store app (a different origin with empty storage). |

## 2. Decided with the user (2026-11-03)

1. **Navigation:** a fifth tab, not a replacement for Review.
2. **Review load:** the user picks a daily or a weekly goal, and the app tries
   to match it. The user's words were "the user picks daily goal or weekly and
   try to match it". This plan reads that as a **review** goal, in pages. If the
   user meant a goal for **new** memorisation, confirm before Phase 3: the
   same settings shape holds a second goal, and §4.4 would gain a "new
   pages" line.
3. **The day starts at midnight.**

---

## 3. Data

### 3.1 Static page index (domain, Phase 0)

The schedule needs "which ayat are on page N" without loading Quran data.

`src/domain/quran/model/pageIndex.ts`, generated, checked in:

```ts
/** The first ayah of each Madani page, surah * 1000 + ayah; index 0 is page 1. */
export const PAGE_FIRST_VERSE: readonly number[] = [
  1001, 2001, 2006 /* ... 604 */,
];
/** The page each juz begins on; index 0 is juz 1. */
export const JUZ_FIRST_PAGE: readonly number[] = [1, 22, 42 /* ... 30 */];

export interface AyahRange {
  surah: number;
  from: number;
  to: number;
} // inclusive
export function pageAyahRanges(page: number): AyahRange[]; // one range per surah on the page
export function pageOfVerse(surah: number, ayah: number): number; // binary search
export function surahPages(surah: number): { first: number; last: number };
export function juzPages(juz: number): { first: number; last: number };
```

- The last ayah of page N is the ayah before page N+1's first. It uses
  `SURAH_AYAH_COUNTS`, which is static already; move it from
  `domain/quran/audio/reciters.ts` to `domain/quran/model/constants.ts` and
  re-export it from the old place, so nothing else has to change.
- Generate it in `scripts/quran/generate-data.mjs` from the same core data
  the app ships, and add to `scripts/quran/verify-data.mjs` a check that
  every page's ranges, joined, are exactly the 6,236 ayat in order. Also check
  that they agree with `verse.page` in core and that `JUZ_FIRST_PAGE` agrees
  with `verseInfo.juz_number`.
- The size is about 5 KB of source and goes through the bundle budget.

### 3.2 The memorisation store (feature, Phase 1)

Key `STORAGE_KEYS.memorization = "artqiy.memorization"`.

```ts
type LocalDate = string; // "2026-11-03": the reader's day, see §4.1
type Grade = "perfect" | "minor" | "weak";
type ReviewSource = "self" | "quiz" | "tasmee";

interface MemorizationStoreV1 {
  schemaVersion: 1;
  mushaf: "madani-604"; // pages are this edition's; ayat are not
  /** Surah number -> sorted, disjoint, non-adjacent inclusive ranges. */
  memorized: Record<string, Array<[number, number]>>;
  /** Exactly the pages holding at least one memorised ayah. */
  pages: Record<string, PageSchedule>;
  /** Oldest first, capped (§3.4). */
  events: ReviewEvent[];
  settings: MemorizationSettings;
  /** An unfinished review session, so a reload resumes it (§6.3). */
  session: ReviewSession | null;
}

interface PageSchedule {
  box: number; // 0..6, §4.2
  due: LocalDate;
  lastReviewed: LocalDate | null;
  addedOn: LocalDate;
  reviews: number;
  lapses: number; // "weak" grades
}

interface ReviewEvent {
  at: number; // epoch ms, for ordering and export merge
  on: LocalDate;
  page: number;
  grade: Grade;
  source: ReviewSource;
  boxBefore: number;
  boxAfter: number;
}

interface MemorizationSettings {
  /** Null until the user picks one; §4.4 suggests a value meanwhile. */
  goal: { period: "day" | "week"; pages: number } | null; // pages 1..200
  /** Date.getDay() of the first day of a week; 6 = Saturday, the default. */
  weekStartsOn: number;
}

interface ReviewSession {
  pages: number[]; // in mushaf order
  done: number[]; // graded so far
  kind: "today" | "surah" | "juz" | "oldest" | "custom";
  label?: number; // surah or juz number, for the title
  startedOn: LocalDate;
}
```

Invariants the store keeps on every write, and repairs on load:

- the ranges are sorted, disjoint and merged, and lie within
  `1..SURAH_AYAH_COUNTS[s-1]`;
- `pages` has exactly one entry for every page with a memorised ayah, and none
  for any other page;
- the dates are valid `LocalDate`s, and `box` is clamped to `0..MAX_BOX`.

### 3.3 Loading, corruption, migration

- `services/memorizationStorage.ts` follows `bookmarkStorage.ts` and
  `quizHistoryStorage.ts`: parse, validate, migrate, repair.
- **Never lose a hifz record silently.** If the stored value cannot be parsed
  or validated, copy the raw string to
  `artqiy.memorization.unreadable.<epoch>` before falling back to an empty
  store, and let the hub show a one-line notice. INVARIANT 8 says to degrade
  to defaults; this does that and keeps the evidence.
- A write that fails (quota, private mode) must not lose the in-memory state
  for the session. Surface a quiet "progress could not be saved on this
  device" notice once.
- `schemaVersion` is checked; a future v2 migrates v1 and does not replace it.

### 3.4 Size

- The ranges are tiny, and `pages` holds at most 604 entries, about 60 KB.
- Cap `events` at 3,000 (about 200 KB). When it is trimmed, fold what was
  dropped into `pages[*].reviews` and `lapses`, which already hold the totals.
  So the cap loses detail, never counts.

---

## 4. Scheduling rules (pure, `model/`)

### 4.1 Calendar (`model/calendar.ts`)

```ts
localDateOf(now: Date): LocalDate
addDays(date: LocalDate, days: number): LocalDate
daysBetween(from: LocalDate, to: LocalDate): number
weekOf(date: LocalDate, weekStartsOn: number): { first: LocalDate; last: LocalDate }
```

- `localDateOf` reads the local `getFullYear/getMonth/getDate`. The day turns
  at midnight.
- `weekOf` gives the 7-day week holding `date`, starting on `weekStartsOn`.
- `addDays`, `daysBetween` and `weekOf` work on the `y-m-d` parts through `Date.UTC`.
  So daylight saving, month ends and leap days cannot shift a date. Never add
  86,400,000 ms to a local time.
- Every function takes `now`. Nothing reads the clock but the hook.

### 4.2 Boxes

| box      | 0   | 1   | 2   | 3   | 4   | 5   | 6   |
| -------- | --- | --- | --- | --- | --- | --- | --- |
| interval | 1d  | 3d  | 7d  | 14d | 30d | 60d | 90d |

`applyGrade(schedule, grade, today): PageSchedule`:

- **perfect:** `box + 1` (capped at 6); due `today + interval(newBox)`.
- **minor:** same box; due `today + interval(box)`.
- **weak:** `max(0, box - 1)`; due **tomorrow**, with `lapses + 1`. One slip
  costs one box, never the whole ladder: losing a page entirely after one bad
  day is wrong about how hifz decays, and demoralising.
- **Early or repeated review:** if less than half the current interval has
  passed since `lastReviewed`, a perfect grade does not promote, and only
  resets `due` from today. Without this, reciting one page five times in an
  afternoon would send it to 90 days.
- **A clock that went backwards** (`lastReviewed` after today): treat
  `lastReviewed` as today; no negative intervals.
- `lastReviewed = today` and `reviews + 1` always, and an event is appended.

### 4.3 Marking memorised

`markAyat(store, surah, from, to, today, confidence?)`
and `unmarkAyat(store, surah, from, to)`:

- Ranges merge: adding 3-5 to `[1,2],[6,9]` gives `[1,9]`. Removing from the
  middle splits a range.
- **A page newly reached** gets `box 0, due tomorrow, addedOn today`. That is
  the sabaq becoming sabqi: new memorisation is checked the next day.
- **A page already scheduled that gains ayat** keeps its history, but goes to
  `box = min(box, 1)` and due tomorrow, because the new ayat need early
  review.
- **A page that loses all its ayat** loses its schedule entry, and keeps its
  events. Unmarking is offered with an undo toast, not a confirm dialog.
- **Marking what you already know** (`confidence: "strong" | "good" | "shaky"`,
  only from bulk marking, §6.1) seeds boxes 4, 3 and 1. The due dates are
  then **spread** by `spreadDue(pages, from, perDay)`, where `perDay` is the
  goal's daily share (§4.4), so that no day is given more than it. Marking
  juz 30 on day one must not put 23 pages on tomorrow.

### 4.4 Today (`model/today.ts`)

```ts
todayTarget(store, today): {
  target: number;      // pages to review today to stay on the goal
  doneToday: number;   // distinct pages graded today
  week?: { done: number; goal: number; daysLeft: number }; // weekly goals only
}

todayQueue(store, today): {
  pages: number[];     // what to review now, mushaf order
  early: number[];     // the subset of `pages` not yet due (pulled forward)
  backlog: number;     // due pages that did not fit
}
```

**The target.** "Reviewed" always counts **distinct pages graded that day**.
A page graded twice counts once.

- **Daily goal:** `target = goal.pages`.
- **Weekly goal:**
  - `doneBefore` = distinct page reviews this week (`weekOf(today)`), on days
    before today;
  - `daysLeft` = the days from today to the week's last day, inclusive;
  - `target = ceil(max(0, goal.pages - doneBefore) / daysLeft)`.

  Reviews done _today_ do not move today's target, so the number does not
  shift while you work. A day missed raises the next days' share; a day done
  ahead lowers it. That is what "try to match it" means here. On the week's
  last day, the target is whatever is left.

- **No goal yet:** use the **suggested** daily goal,
  `max(3, ceil(scheduledPages / 30))`, which brings everything round about
  monthly. The hub asks the user to confirm it or pick their own.
- **Clamp** the target to the number of scheduled pages not graded today.
- **The daily share** used by `spreadDue` is `goal.pages` for a daily goal and
  `ceil(goal.pages / 7)` for a weekly one.

**The queue.** Pages already graded today are excluded throughout. Let
`remaining = max(0, target - doneToday)`.

1. **Always in:** due pages in box 0-1. These are new or recently failed.
   They go in even past `remaining`, and count towards it.
2. **Then, up to `remaining`:** other due pages (`due <= today`). Most overdue
   relative to their interval comes first, then the lower box, then mushaf
   order.
3. **If still short of `remaining`:** top up with pages **not yet due**,
   soonest `due` first, then the oldest `lastReviewed`. These are listed in
   `early`. Reviewing them early cannot inflate their box, thanks to the
   half-interval rule in §4.2. Their due date resets from today, which
   smooths the days after.
4. `backlog` = the due pages from step 2 that did not fit. The hub says "N
   more are overdue - at this pace you'll be caught up in D days" and offers
   **"spread them out"**, which re-spreads the backlog with `spreadDue` at the
   daily share.

Once the target is met, Home and the hub say so. They still offer "review
more", which asks `todayQueue` again with the target treated as `+3`.

The session walks the queue in **mushaf order**, which is how a page is
recited, even though priority chose what is in it.

Other selectors, all pure and all derived in render:

- `pageState(store, page, today)`: `"none" | "partial" | "learning" | "settled" | "due"`
- `surahProgress(store, surah)`: `{ memorized: number; total: number; duePages: number }`
- `juzProgress(store, juz, today)`: the same per juz
- `totals(store)`: pages fully memorised, partly memorised, ayat, and juz completed
- `oldestReviewed(store, n)`: the pages longest since review, whether due or not
  (the user's "it has been a long time")
- `reviewStreak(events, today)`: copy `summarizeQuizProgress`'s rule that a day
  not yet over cannot break a streak

### 4.5 Backup (`model/backup.ts`)

- **Export:** the whole store as `artqiy-hifz-YYYY-MM-DD.json`, with
  `{ app: "artqiy", kind: "memorization", schemaVersion }`.
- **Import:** validate it exactly as the loader does. Then the user picks
  **replace** or **merge**:
  - **merge** unions the ranges, keeps for each page the schedule with the
    later `lastReviewed`, concatenates events with duplicates removed by
    `(at, page)`, and re-sorts and re-caps them;
  - it never imports a different `mushaf`.
- This is also the bridge to the store app, and should be named so in its
  help text.

---

## 5. Module layout

```
src/domain/quran/model/pageIndex.ts         (+ test)  Phase 0
src/features/memorization/
  index.ts                                  public API only
  model/ayahRanges.ts        (+ test)       merge, add, remove, contains, count
  model/calendar.ts          (+ test)
  model/schedule.ts          (+ test)       boxes, applyGrade, spreadDue, seed
  model/memorizationStore.ts (+ test)       types; markAyat, unmarkAyat, recordReview, session transitions; invariant repair
  model/today.ts             (+ test)       todayQueue and the selectors in §4.4
  model/backup.ts            (+ test)
  services/memorizationStorage.ts (+ test)  load, validate, migrate, save, keep unreadable data
  hooks/useMemorization.ts                  one store via useSyncExternalStore plus storage events, like useBookmarks; exposes state and the actions
  components/TodayCard.tsx                  for Home
  components/PageMemorizedControl.tsx       for the reader's folio bar
  components/MarkRangeSheet.tsx             mark from ayah to ayah
  components/ReviewBar.tsx                  the reader's bottom strip during a session
  components/HifzPage.tsx                   the /hifz hub
  components/ProgressByJuz.tsx
  components/SurahProgressList.tsx
  components/GoalPicker.tsx                 daily or weekly, how many pages; used by the hub and Settings
  components/HifzSettings.tsx               goal, week start, export/import, for Settings
```

- **Public API** (`index.ts`): `HifzPage`, `TodayCard`,
  `PageMemorizedControl`, `MarkRangeSheet`, `ReviewBar`, `HifzSettings`,
  `useMemorization`, and the types those need. Nothing else.
- **One owner.** The hook's store is the only in-memory copy. Components get
  state from it, and derive the rest with the pure selectors in render.
- **One write per action.** Each action is a pure transition followed by one
  `save`, then a notify.
- The `/hifz` route is lazy-loaded like the others. Home imports only
  `TodayCard` and the hook, which pull in the store and the page index but no
  Quran data.

---

## 6. Screens and flows

The Arabic is the primary text. Every string goes in `resources.ts` in both
languages under a new `memorization` namespace (`hifz` in keys). Touch
targets are at least 44 px. Visible focus. Arabic Quran content stays RTL in
either locale.

### 6.0 Navigation

- Add a fifth item to `navigationItems` in `src/app/AppShell.tsx`: `to: "/hifz"`,
  `labelKey: "navigation.hifz"` ("حفظي" / "Hifz"), and an icon from
  `lucide-react`, which is already a dependency. Suggested: `BookCheck`.
- Add `section: "hifz"`, and make `getActiveSection` return it for paths
  starting `/hifz`.
- Put it after Reader and Index, before Review: what to review today is the
  daily entry point.
- Add a lazy route in `src/app/routes.tsx`. It sits outside
  `QuranDataProviders`, because the hub needs only the store, the page index
  and surah names.
- Check the bottom bar at 360 px in both languages: five labels must fit
  without truncation, and each target must stay at least 44 px. Update
  `AppShell.test.tsx` and `routes.test.tsx`.

### 6.1 Marking

- **Reader folio bar** (`MushafReaderBar`, where the page, juz and hizb are
  shown): a compact **"حفظتُ هذه الصفحة"** toggle (`PageMemorizedControl`).
  - **Full:** a filled state.
  - **Partial:** a half state, with an accessible label such as "5 of 12
    ayat memorised".
  - Tapping partial or none marks the whole page, and the undo toast
    offers to put it back.
  - In surah view it acts on the visible page.
  - INVARIANT 14 still holds: the bar still states the position.
- **Ayah actions popover** (`VerseActionsPopover`): **"حفظتُ حتى هنا"** opens
  `MarkRangeSheet`. The range runs from the first not-yet-memorised ayah
  before this one (or the surah's start) to this ayah, and both ends can be
  edited. This is how someone memorising al-Baqarah a few ayat at a time
  records it.
- **Hub, surah list:** each surah has "mark surah". **Hub, juz list:** each
  juz has "mark juz".
- **First run of the hub:**
  1. "Do you already know some of the Quran?" leads to picking surahs or juz
     with a confidence (strong, good, shaky), seeded and spread as in §4.3.
     It can be skipped.
  2. Then **"How much do you want to review?"** (`GoalPicker`): a segmented
     control, **يوميًا / أسبوعيًا** (daily / weekly), and a page stepper
     pre-filled with the suggestion from §4.4. For a weekly goal it also
     shows the daily share it implies ("≈ 5 pages a day"). It can be skipped;
     the suggestion stands until the user picks a goal.

### 6.2 Home: `TodayCard`

It goes above the review panel, in the existing grid.

| State                          | Shows                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| nothing marked                 | "ابدأ سجل حفظك" and a link to `/hifz`                                                       |
| target not met                 | **"مراجعة اليوم: ٢ من ٥ صفحات"**, the next page's surah name, and **Start** or **Continue** |
| weekly goal                    | the same, plus the week line: "هذا الأسبوع: ١٢ من ٣٥"                                       |
| some overdue beyond the target | the same, plus "and N more overdue"                                                         |
| target met                     | "أتممت هدف اليوم", the next due date, and "review more"                                     |
| no goal picked yet             | the suggested target as above, plus "set your goal", linking to the picker                  |

It reads only the store, the page index and the static surah names.

### 6.3 The review session

1. **Start** (from Home or the hub). This writes
   `session = { pages, done: [], kind, startedOn }` and opens the reader at
   the first page in **page view**.
2. **While a session is on that page**, the reader's bottom strip is
   `ReviewBar`. It takes the strip the way `PracticeAudioBar` does, and keeps
   the page controls. It shows:
   - the progress: "الصفحة ٢ من ٥" and the ayat being reviewed, when the page
     is only partly memorised;
   - a **hide the page** switch: a cover over the mushaf that lifts while
     pressed, so you can check yourself without the text in front of you.
     This is plain CSS over `MushafViewer`, and does not reuse تسميع's
     `hideAyat`;
   - the three grade buttons;
   - "end review".
3. **Grading** records the review, adds the page to `done`, and moves to the
   next page in the session. After the last page there is a short summary:
   pages reviewed, and when each is next due. Then back to where they came
   from.
4. **Reload or leaving midway:** the session is in the store, so returning to
   the reader or the hub offers to continue. Grades already given are saved.
5. **Starting a new session** while one is unfinished asks to continue it or
   discard it.
6. **A session from a previous day** is shown as unfinished. Continuing it
   regrades against today, which is fine: grades are always against the day
   they are given.

### 6.4 The hub `/hifz`

- **Today:** progress against the goal ("٢ من ٥" today, and "١٢ من ٣٥" this
  week for a weekly goal), the queue with its early pages marked "مبكرًا"
  (early), Start, the backlog line, "spread them out", and a link to change
  the goal.
- **Progress:** "١٢٣ صفحة من ٦٠٤", plus juz completed and ayat memorised.
  - `ProgressByJuz` is 30 rows. Each row has the juz name, a bar of its pages
    coloured by state, and "18 of 20 pages".
  - The bar of cells is a picture, with a text summary as its label. It is
    not 604 buttons: at phone width a cell is about 15 px, far below 44 px.
  - Tapping a row opens that juz's page list, with real 44 px rows: the page,
    its state, "next review in 6 days" or "due", and actions to open, review
    now and unmark.
  - The cells run right to left in both languages. INVARIANT 2 says
    increasing page numbers progress to the left; the grid is a picture of
    the mushaf, so give it `dir="rtl"` regardless of locale.
- **Surahs:** `SurahProgressList`, 114 rows with a progress bar
  ("٤٥ / ٢٨٦ آية"), a due badge, "review this surah", and "mark surah".
- **"Not reviewed for a long time":** the 10 from `oldestReviewed`, with
  "review these".
- **A streak line,** if there is one. No badges or confetti: the point is
  steadiness, not pressure.
- The quiz remains reachable from here.

### 6.5 Settings: `HifzSettings`

- Review goal: `GoalPicker`, daily or weekly, 1 to 200 pages.
- Week starts on: Saturday (the default), Sunday or Monday. This only appears
  for a weekly goal.
- Export and import, with replace or merge.
- "Clear memorisation record". This is two steps and exports first by
  default.

---

## 7. Edge cases (each one needs a test)

| Case                                                          | Expected                                                                                     |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Review at 23:59, then at 00:01                                | two different days; a session spanning midnight grades each page on its own day              |
| Daily goal 5, 8 pages due                                     | 5 in the queue (new box 0-1 pages first, even past 5), backlog 3                             |
| Daily goal 5, 2 pages due                                     | 2 due plus 3 soonest-due pulled forward, flagged early                                       |
| Early review graded perfect                                   | box unchanged (half-interval rule); due resets from today                                    |
| Weekly goal 35, nothing done by the 5th day of the week       | target = ceil(35 / 3) = 12                                                                   |
| Weekly goal 35, 30 done by the 6th day                        | target = ceil(5 / 2) = 3                                                                     |
| Weekly goal set mid-week                                      | reviews already done this week count; target uses the days left                              |
| Week boundary                                                 | the first day of a new week starts at 0 done; `weekStartsOn` respected                       |
| Same page graded twice today                                  | counts once towards the goal                                                                 |
| Goal larger than everything memorised                         | target clamped to the scheduled pages not yet graded today                                   |
| Goal met, "review more"                                       | three more, due first, then early                                                            |
| No goal picked                                                | suggested daily target used, "set your goal" shown                                           |
| DST change, month end, 29 Feb                                 | `addDays`/`daysBetween` exact; no off-by-one                                                 |
| Device clock earlier than `lastReviewed`                      | no negative interval; treated as reviewed today                                              |
| Travel across time zones                                      | dates follow the device's local day; at most a one-day shift, accepted                       |
| The same page graded twice in one day                         | second grade does not promote                                                                |
| Box 6 graded perfect                                          | stays 6, due +90 days                                                                        |
| Box 0 graded weak                                             | stays 0, due tomorrow, lapses +1                                                             |
| Mark 3-5 when 1-2 and 6-9 are already marked                  | one range, 1-9                                                                               |
| Unmark 4 of 1-9                                               | 1-3 and 5-9; the page is still scheduled                                                     |
| Unmark the last ayah on a page                                | schedule entry gone, events kept, undo restores both                                         |
| Mark the whole of juz 30 on day one, as already known         | no day gets more than the daily share; pages marked as new (not seeded) are all due tomorrow |
| Away 60 days                                                  | queue = box 0-1 plus the target; backlog reported; "spread them out" works                   |
| Page 1 / page 604 / surah 1 / surah 114 / 2:286 / 114:6       | page index and ranges correct at every boundary (INVARIANT 12)                               |
| A page that holds three surahs (e.g. 604)                     | `pageAyahRanges` gives three ranges; partial state when one is memorised                     |
| Stored JSON corrupt                                           | raw copy kept under `.unreadable.<epoch>`, empty store, notice shown                         |
| Storage full or unavailable                                   | state kept for the session, one notice, nothing thrown                                       |
| Two tabs                                                      | a write in one appears in the other (storage event)                                          |
| Import of another app's file, wrong `mushaf`, a future schema | refused with a reason; nothing changed                                                       |
| Merge import                                                  | union of ranges; later `lastReviewed` wins per page; no duplicate events                     |
| Session page unmarked mid-session                             | it is skipped; the session does not break                                                    |
| Events past the cap                                           | oldest dropped; `reviews`/`lapses` totals unchanged                                          |

---

## 8. Phases

Each phase is usable alone. Stop at its "done when".

### Phase 0: page index

`pageIndex.ts`, the generator and verifier changes, and tests: boundaries,
round trips (`pageOfVerse` against `pageAyahRanges` for every ayah), and juz.

**Done when:** `npm run data:verify` checks it against core, and every ayah
maps to exactly one page.

### Phase 1: the record and the rules (no UI)

`ayahRanges`, `calendar`, `schedule`, `memorizationStore`, `today` and
`backup` in `model/`, plus `memorizationStorage` and `useMemorization`. Each
gets tests covering §4 and §7. The storage key is added to `STORAGE_KEYS`.

**Done when:** every row of §7 that does not need a screen has a passing
test, and coverage of `features/memorization/model` is at 100% of lines.

### Phase 2: marking, and backup

The fifth nav tab and the `/hifz` route (§6.0). `PageMemorizedControl` in the
reader bar. "حفظتُ حتى هنا" and `MarkRangeSheet`. The first version of the
hub, with surah and juz lists and their mark actions. First-run bulk marking
with confidence. `HifzSettings` export and import. The undo toast.

**Done when:**

- you can mark a page in the reader, reload, and it is still marked;
- marking a surah marks all its pages;
- a partial page shows as partial;
- export, then clear storage, then import restores everything.

### Phase 3: today

`todayTarget` and `todayQueue`, `GoalPicker` (in the first run, in the hub
and in Settings), the week-start setting, the `TodayCard` on Home, the review
session through `ReviewBar`, the session summary, the backlog line, "spread
them out" and "review more".

**Done when:**

- a page marked today is due tomorrow;
- with a daily goal of 5 and 2 pages due, today's list is 5, 3 of them early;
- with a weekly goal, a missed day raises the next day's target as §4.4
  computes it;
- reviewing it perfect makes it due in 3 days, and weak puts it back to
  tomorrow;
- a session resumes after a reload;
- Home makes no request for Quran data.

The last point gets a Playwright test that watches network requests from
`/`.

### Phase 4: progress

`ProgressByJuz`, `SurahProgressList`, the totals, "not reviewed for a long
time", the streak line, review sessions by surah, by juz and by oldest.

**Done when:**

- the hub answers four questions at a glance: what I have memorised, what is
  due, what I am forgetting, and how far through I am;
- both languages pass Axe at phone and desktop widths.

### Phase 5: end-to-end and polish

A Playwright flow driven by `page.clock`:

1. Mark three pages in the reader and pick a daily goal of 2.
2. Home says nothing is due today.
3. Advance one day: Home says "0 of 2", and the session holds all three
   pages, because new pages in box 0 are never held back by the goal.
4. Start a review, grade the first page perfect, and reload mid-session to
   resume.
5. Finish the session: Home says the goal is met, and that page's next review
   is in 3 days.
6. Switch to a weekly goal of 7, advance a day, and see the week line.
7. Export, clear storage, import, and see the state restored.

It runs in both languages. Re-check the bundle budget, keyboard paths,
screen-reader labels and reduced motion.

### Phase 6 (later, separate, optional): other evidence

- **Quiz a page** from the review bar: a quiz over `focusVerseKeys` = the
  page's memorised ayat. Pass the config through route state. The result
  _suggests_ a grade (≥ 90% perfect, ≥ 70% minor, otherwise weak) and the
  reader confirms it. The source is `"quiz"`.
- **تسميع as a review:** after a page's run, the summary offers "count this as
  my review of page N". It suggests perfect when nothing is marked, and minor
  when one or two words are. The reader confirms; it is never automatic,
  because the verdict can be wrong. The source is `"tasmee"`. This lives in
  `recitation-practice` and calls the public `recordReview`, so the
  memorisation helper never depends on the model.
- **Weak ayat on a page:** highlight in the review bar the ayat the quiz
  (`collectWeakVerses`) or تسميع marked. Read them from their own sources;
  never copy them into this store.

### Not now

- Goals and pace ("juz 30 by Ramadan"): once the record exists and is used.
- Reminders: need the native app (Capacitor local notifications).
- Cloud sync and accounts: needs a backend; export/import covers it until then.
- FSRS: once there are months of events to fit.
- Other mushaf editions: `mushaf` is in the schema, so this stays possible.
- Teacher or student sharing.

---

## 9. Testing approach

- **Pure model first, tests first.** Each rule in §4 and each row in §7 is a
  test with a fixed `now`, such as `localDateOf(new Date(2026, 10, 3, 23, 59))`.
  Weekly-goal tests pin `weekStartsOn` and walk a whole week day by day.
- **Storage tests** inject a fake `SafeStorage`, as `quizHistoryStorage`
  takes one, covering corrupt, unavailable, full and migrating stores.
- **Component tests** render with the real store against an injected
  storage. Assert both locales' strings, and test the RTL grid direction.
- **E2E:** Phase 5's flow, plus Axe on `/hifz`, the review bar and the
  settings panel.
- **Performance:** the hub renders 30 juz rows and 114 surah rows. Measure it
  on a mid-range phone profile in DevTools before adding any memoisation. The
  selectors are O(pages + ranges) and should not need it.

## 10. Handoff checklist

- `npm run check` passes.
- Every new string in Arabic and English. Arabic reviewed for wording, not
  machine-literal.
- `INVARIANTS.md` rows 2, 8, 12 and 14 checked by hand on the new screens.
- No import from `recitation-practice` before Phase 6.
- Nothing committed. A summary for the user of what changed and what was
  measured, and whether the §2 reading of the goal, as a review goal, was
  confirmed.
