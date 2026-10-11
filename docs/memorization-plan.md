# Making Artqiy a memorization helper

**Written for:** the person building it, deciding what to do next.

The reader is good. The quiz works. What is missing is the one thing the name
promises: the app does not know **what you have memorized**, so it cannot
tell you what to review today.

---

## 1. What is already here

More than it looks. Nothing below needs building from scratch.

|                           | where                                                   | what it gives                                                                                |
| ------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| per-ayah persisted state  | `services/bookmarkStorage.ts` + `hooks/useBookmarks.ts` | the exact shape to copy: `useSyncExternalStore`, cross-tab `storage` events, a versioned key |
| per-verse right/wrong     | `collectWeakVerses()`                                   | `{ verseKey, missed, asked }` across the last 50 sessions                                    |
| streak and accuracy       | `summarizeQuizProgress()`                               | already on Home                                                                              |
| a quiz over chosen verses | `QuizConfig.focusVerseKeys`                             | hand it a list, get a session                                                                |
| offline recitation        | `services/audioDownloads.ts`                            | review works on a plane                                                                      |
| position memory           | `readerPosition`, `readerRecents`                       | where you were                                                                               |

## 2. What is missing, exactly

**One thing: a record of what you have committed to memory, and when it is
due.** Every storage key the app has today:

```
locale theme reciter tafseer readerPosition readerRecents
bookmarks mushafScale mushafWarmth mushafTajweedColored
quiz-history  artqiy.audio.downloads
```

Nothing there says _I know this page_. So four questions a memorizer asks
every day have no answer:

- what have I memorized, as opposed to read?
- what is due for review today?
- what am I forgetting?
- how far through am I?

`collectWeakVerses()` answers the third, for ayat that happen to have come up
in a quiz. The other three cannot be answered at all.

---

## 3. Two design decisions to make first

### 3.1 The unit is the page, the evidence is the ayah

Hifz is done and reviewed **by page** — a page a day, a juz a month, and you
recite a whole page rather than an isolated ayah. But mistakes happen at
**ayah** level, and that is what tells you _where_ on the page you are shaky.

So: **schedule by page, record strength by ayah.**

This also fits what the app already is. The reader is page-first, the data
has all 604 pages, and `findVersePage` already maps either way.

### 3.2 Leitner, not FSRS

Spaced repetition options, in order of sophistication: Leitner boxes, SM-2,
FSRS. **Start with Leitner.**

```
box 0   new / learning     due tomorrow
box 1   due in 3 days
box 2   due in 7 days
box 3   due in 14 days
box 4   due in 30 days
box 5   due in 60 days
```

A clean review promotes a page one box. A review with mistakes demotes it
**one** box, not to zero — losing a page entirely after one slip is both
wrong about how hifz decays and demoralising.

Why not FSRS: it needs a volume of review history before it beats a simple
ladder, and it cannot explain itself. "Due because you last recited it a week
ago and got it right" is something a person can trust. An opaque interval is
not — and this is an app someone uses on their own, with no teacher to
override it.

FSRS stays possible later: the record below stores review events, which is
what fitting a better model would need.

---

## 4. The phases

Each one ships something usable on its own.

### Phase 1 — the record

The foundation, and the only phase that is pure plumbing.

- `services/memorizationStorage.ts`, mirroring `bookmarkStorage.ts`
- `hooks/useMemorization.ts`, mirroring `useBookmarks.ts`
- One record per page:

```ts
interface PageMemorization {
  page: number; // 1..604
  status: "learning" | "memorized";
  box: number; // 0..5, the Leitner ladder
  lastReviewedAt: string; // ISO
  dueAt: string; // ISO, derived from box
  reviews: number;
}
```

- Versioned under its own key with a schema number, and migrated, not
  replaced, when it changes (INVARIANTS: persisted user data migrates)
- One affordance in the reader: **mark this page memorized**. The folio line
  at the foot of the page is where it belongs — it already states the
  position, and the trailing cell is free.

**Done when:** you can mark a page, reload, and it is still marked.

### Phase 2 — due today

The phase that makes the app worth opening daily.

- `dueToday(records, now)` — pure, and the heart of the whole thing
- Home gains one card above everything else: **"Today — 3 pages to review"**,
  one tap to start
- A review session walks the due pages: show the page, recite or quiz it, and
  record the outcome
- Outcome promotes or demotes the box and sets the next `dueAt`

Feed the outcome from what already exists: a quiz over
`focusVerseKeys = ayat of the due pages`, scored by the engine that is
already there. No new quiz machinery.

**Done when:** marking a page memorized today puts it on tomorrow's list, and
reviewing it cleanly moves it to three days out.

### Phase 3 — the whole Quran at a glance

The "progress over weeks" answer, and the thing that makes it feel like
progress rather than a treadmill.

- 604 pages as a grid, coloured by state: untouched, learning, strong, due
- Juz summaries: "juz 30 — 18 of 23 pages"
- One honest number: pages memorized out of 604

This is also the screen that shows the work was worth something, which is the
part a daily memorizer needs most and the part the app has never had.

### Phase 4 — fold تسميع in

Once `docs/tasmee-investigation.md` lands a working pipeline, a clean recital
of a page is the best possible review signal — much better than a multiple
choice answer. It promotes the page exactly the same way, through the same
`recordReview()` call.

Nothing in Phases 1–3 should assume تسميع exists, and nothing should need
changing when it arrives.

---

## 5. What not to build

- **FSRS, or any tuned model, in v1.** See §3.2.
- **A "plan" feature** (a juz a month, a page a day) before the record
  exists. A plan is a projection over state that is not there yet.
- **A second source of truth for weak ayat.** `collectWeakVerses()` already
  derives them from quiz history. The page record schedules; the quiz history
  says where it hurts. Do not copy one into the other.
- **Per-ayah scheduling.** See §3.1 — it is not how anybody revises, and it
  would multiply 604 records into 6,236.

---

## 6. The first commit

`memorizationStorage.ts` with `recordReview()`, `dueToday()` and the box
ladder as pure functions, under test, with no UI at all.

Everything else in this document is a consumer of those three. Getting the
ladder and the due date right, in isolation, with tests that say what
"tomorrow" means at a month boundary and across a timezone change, is worth
more than any screen built on top of a model that is nearly right.
