# Artqiy — manual test plan

**Audience: an agent driving a real Chrome window (Claude in Chrome).**

Every check below is written to be executed, not read. Each has steps and one
or more observable expectations. Where an expectation is a number, it is a
number measured on this build — report the number you see, not just pass or
fail.

Report results as a table: `ID | pass/fail | what you actually saw`. For any
failure include the route, the language, the theme, the window width, and a
screenshot.

---

## 0. Setup

### 0.1 Start the app

In a terminal, from the project directory:

```
npm install
npm run dev
```

Vite prints a local URL, normally `http://localhost:5173`. Use whatever it
prints. Everything below is relative to that origin.

### 0.2 Reset to a clean state

Before any check that needs a first-time state, open DevTools → Console on the
app's origin and run:

```js
localStorage.clear();
location.reload();
```

### 0.3 Seeding a returning user

Several checks need saved state. Paste this into the Console, then reload:

```js
localStorage.setItem(
  "artqiy.reader.position",
  JSON.stringify({
    schemaVersion: 1,
    layout: "surah",
    page: 3,
    surah: 2,
    ayah: 25,
    updatedAt: Date.now(),
  }),
);

localStorage.setItem(
  "quiz-history",
  JSON.stringify([
    {
      schemaVersion: 3,
      id: "a",
      completedAt: new Date().toISOString(),
      scope: null,
      sessionMode: "fixed",
      questionCount: 10,
      correctCount: 7,
      accuracyByType: {},
      durationMs: 60000,
      answers: [
        { questionType: "complete_ayah", verseKey: "2:5", isCorrect: false },
        { questionType: "complete_ayah", verseKey: "2:6", isCorrect: false },
        { questionType: "complete_ayah", verseKey: "3:2", isCorrect: false },
      ],
    },
    {
      schemaVersion: 3,
      id: "b",
      completedAt: new Date(Date.now() - 86400000).toISOString(),
      scope: null,
      sessionMode: "fixed",
      questionCount: 10,
      correctCount: 9,
      accuracyByType: {},
      durationMs: 60000,
      answers: [],
    },
  ]),
);

location.reload();
```

### 0.4 Switching language and theme

- **Language**: Settings → Language, or
  `localStorage.setItem("artqiy.locale", "en")` (or `"ar"`) and reload.
- **Theme**: the sun/moon button in the sidebar or the reader menu, or
  `localStorage.setItem("theme", "dark")` (or `"light"`) and reload.

Arabic is the default and is right-to-left. **Run the whole plan in Arabic
first**, then repeat sections 1–3 in English.

### 0.5 Widths

Resize the Chrome window, or use DevTools → Toggle device toolbar. Three
widths matter:

| Name    | Width  | Exercises                                     |
| ------- | ------ | --------------------------------------------- |
| phone   | 400px  | bottom nav, immersive reader, stacked layouts |
| tablet  | 768px  | the middle breakpoint                         |
| desktop | 1440px | the sidebar and the reader's surah rail       |

---

## 1. Home (`/`)

| ID  | Steps                                                              | Expect                                                                                                                                                    |
| --- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | Clear storage, load `/`                                            | Exactly **one** `h1`, and it is the app's own title ("مصحف هادئ للمراجعة المتأنية" / "A quiet Mushaf for thoughtful review") — **not** "Continue reading" |
| H2  | Same state                                                         | The Arabic welcome ayah shows below the primary card                                                                                                      |
| H3  | Seed a reading position (0.3), reload                              | The `h1` is **still** the app title. The card heading becomes "متابعة القراءة" / "Continue reading". The welcome ayah is gone                             |
| H4  | With a position seeded, count links pointing at the saved position | Exactly **one**. Two differently-labelled links to the same place is the bug this guards                                                                  |
| H5  | Clear storage, load `/`                                            | The review panel reads "أكمل أول اختبار ليظهر تقدمك هنا." / "Finish your first quiz and your progress appears here."                                      |
| H6  | Seed quiz history, reload                                          | The panel shows a streak (٢ / 2), recent accuracy (٨٠٪ / 80%), and ayahs needing work (٣ / 3)                                                             |
| H7  | With a backlog seeded                                              | The quiz button reads "راجع ما يحتاج تثبيتاً" / "Review what needs work", not "Set up a quiz"                                                             |
| H8  | At 400px and 1440px                                                | No horizontal scrollbar; the page never scrolls sideways                                                                                                  |

---

## 2. Reader

### 2.1 The page fits

| ID  | Steps                                                     | Expect                                                                                                                                                                                       |
| --- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Go to `/quran/page/3`                                     | The whole page is visible. **No vertical scrolling inside the mushaf**                                                                                                                       |
| R2  | Visit pages 1, 2, 3, 50, 77, 255, 400, 604                | Each fits with no inner scroll, and the Arabic is the **same size on every page**. Measure: `getComputedStyle(document.querySelector(".mushaf-word")).fontSize` — identical across all eight |
| R3  | Page 77 (a surah opening squeezed into one line)          | Fits like any other. Compare `document.querySelector(".mushaf-page--full").getBoundingClientRect().height` with page 3 — within ~8px                                                         |
| R4  | Resize 400px → 1440px while on page 3                     | Type resizes smoothly, the page always fits, nothing is clipped                                                                                                                              |
| R5  | Make the window short and wide (~1000×480), go to page 77 | Still no inner scroll                                                                                                                                                                        |

### 2.2 Gestures (phone width, touch emulation on)

| ID  | Steps                       | Expect                                                                                                         |
| --- | --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| R6  | Swipe left                  | Turns to the **next** page. In Arabic, next means the number goes **up**                                       |
| R7  | Swipe right                 | Back one page                                                                                                  |
| R8  | Drag ~40px and release      | **Nothing happens** — no page turn, no toolbar flash                                                           |
| R9  | Scroll vertically           | The chrome does not appear or disappear                                                                        |
| R10 | Tap once on the page        | Navigation toggles. The **position never disappears** — page number, juz and hizb stay readable in both states |
| R11 | Wait 10s after tapping      | Nothing hides on its own; there is no timer                                                                    |
| R12 | Press and hold a word >0.5s | The verse actions popover opens                                                                                |

### 2.3 Chrome and layout mode

| ID  | Steps                                 | Expect                                                                                                                                                                            |
| --- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R13 | Open the header's "…" menu            | The **first** item is "طريقة العرض" / "Reader layout", with two options                                                                                                           |
| R14 | Read them                             | Each has a second line saying what it does: "صفحة كاملة، اسحب لتقليب الصفحات" / "One mushaf page, swipe to turn", and "السورة كاملة، تمرير متواصل" / "The whole surah, scrolling" |
| R15 | Check which is marked                 | The one in force has a tick and `aria-checked="true"`                                                                                                                             |
| R16 | Choose the other                      | The reader switches and the URL changes to match                                                                                                                                  |
| R17 | Open reading preferences              | Layout is **not** in the sheet; it lives only in the menu                                                                                                                         |
| R18 | Scroll to the bottom of the sheet     | A "تم" / "Done" button closes it                                                                                                                                                  |
| R19 | Click the ⓘ beside the tajweed switch | The colour legend opens                                                                                                                                                           |

### 2.4 Search

| ID  | Steps                                           | Expect                                                                                                                        |
| --- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| R20 | Menu → "بحث آية" / "Search ayah", type `البقرة` | Al-Baqarah is the first result                                                                                                |
| R21 | Type `بقره` (no article, no ta marbuta)         | **Still finds Al-Baqarah**                                                                                                    |
| R22 | Switch to English, reopen, type `Baqarah`       | Finds it. The input text runs **left to right**                                                                               |
| R23 | Type `البقرة` in the English UI                 | The input flips to **right to left** as you type                                                                              |
| R24 | Type `2:255`                                    | Ayat al-Kursi, alone                                                                                                          |
| R25 | Type `٢:٢٥٥`                                    | The same result                                                                                                               |
| R26 | Read any result's second line                   | It names the surah — "سورة البقرة، الآية ٢٥٥" / "Surah Al-Baqarah, ayah 255". It must **not** contain the literal `{{surah}}` |
| R27 | Read the button under the results               | It names the destination, not a bare "Go to"                                                                                  |
| R28 | Press ↓ ↑ Home End                              | The highlighted result moves, wrapping at both ends                                                                           |
| R29 | Press Enter                                     | Navigates to the highlighted ayah                                                                                             |

### 2.5 Listening

| ID  | Steps                                  | Expect                                                                                                      |
| --- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| R30 | Menu → "استماع" / "Listen"             | One obvious action: "شغّل هذه الصفحة" / "Play this page", with the page number beneath. **No tabs visible** |
| R31 | Count the controls                     | Three: play, the "خيارات أخرى" / "Other options" disclosure, and close                                      |
| R32 | Click play                             | The dialog closes and a playback bar appears at the bottom                                                  |
| R33 | Switch to surah mode, reopen Listen    | The action reads "شغّل هذه السورة" / "Play this surah" and names the surah                                  |
| R34 | Open "Other options"                   | Four tabs (surah / juz / page / ayah), a repeat row, and a footer start button                              |
| R35 | Use the ▶ beside a surah in the drawer | Listen opens preset to **that** surah, not the current page                                                 |

### 2.6 Verse actions and keyboard

| ID  | Steps                                      | Expect                                                       |
| --- | ------------------------------------------ | ------------------------------------------------------------ |
| R36 | Click a word                               | A popover with listen / tafsir / copy / share / bookmark     |
| R37 | Measure those buttons                      | Each at least 44px tall                                      |
| R38 | Load `/quran/page/3`, press Tab repeatedly | Focus lands on an ayah of the mushaf, with a visible outline |
| R39 | Press Enter on a focused ayah              | The verse actions open — **this must work with no mouse**    |
| R40 | Press Space on a focused ayah              | Same                                                         |
| R41 | Inspect a glyph inside the page            | It is a `span`, not a `button`, and is `aria-hidden="true"`  |

### 2.7 The desktop rail

| ID  | Steps                                    | Expect                                                                                                                   |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| R42 | At 1279px, load `/quran/page/3`          | **No** surah rail                                                                                                        |
| R43 | Widen past 1280px                        | A surah list appears beside the mushaf at the **inline end** — left in Arabic, right in English                          |
| R44 | Compare type size at 1279px and 1440px   | **Identical.** `getComputedStyle(document.querySelector(".mushaf-word")).fontSize` must not change when the rail appears |
| R45 | Scroll inside the rail                   | The rail scrolls alone; the page behind does not move                                                                    |
| R46 | Search `بقره` in the rail, click a surah | Navigates there                                                                                                          |
| R47 | Check overlap from 1280 to 1920          | The mushaf and the rail never overlap                                                                                    |

### 2.8 Warmth (sepia)

| ID  | Steps                                  | Expect                                                                                 |
| --- | -------------------------------------- | -------------------------------------------------------------------------------------- |
| R48 | Preferences → turn on "الدفء" / warmth | Page, cards, borders and text all warm together. Nothing stays cool grey on warm paper |
| R49 | Switch to dark with warmth on          | A warm dark palette, not a cool one                                                    |
| R50 | Read the muted text in both            | Comfortably readable — report anything washed out                                      |

---

## 3. Quiz (`/quiz`)

### 3.1 Goals

| ID  | Steps                                             | Expect                                                                                               |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Q1  | Clear storage, load `/quiz`                       | **Four goal cards.** No wizard, no step numbers, no "scope"                                          |
| Q2  | Read the first card                               | "راجع ما قرأته" / "Review what you read", naming the page or surah last read (Al-Fatihah if nothing) |
| Q3  | Click its start button                            | **A question appears.** Count the clicks — it must be one                                            |
| Q4  | With no history, read the second card             | "ثبّت ما نسيته" / "Work on what you missed" says nothing needs work and **its button is disabled**   |
| Q5  | Seed history, reload                              | It names the count ("٣ آيات" / "3 ayahs") and the button is enabled                                  |
| Q6  | Click it                                          | **One question per missed ayah** — "السؤال ١ من ٣" / "Question 1 of 3"                               |
| Q7  | Third card                                        | A surah picker with a visible label; choosing one and starting quizzes that surah                    |
| Q8  | Inspect the three start buttons' accessible names | Each names its goal, not just "Start". Check DevTools → Accessibility or read `aria-label`           |

### 3.2 During a quiz

| ID  | Steps                                                                | Expect                                                                                                                 |
| --- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Q9  | Start a quiz, look at the top of the question                        | The **question itself** is a visible heading ("ما رقم هذه الآية؟" / "What is this ayah's number?"), not tiny grey text |
| Q10 | Check the heading                                                    | It is an `h2` and it is **not** `sr-only`                                                                              |
| Q11 | Answer a question                                                    | The verdict appears and "السؤال التالي" / "Next question" is **visible without scrolling**                             |
| Q12 | Answer through to the end                                            | The Next button is in view every time                                                                                  |
| Q13 | Force a `complete_ayah` question (manual setup, tick only that type) | Options are whole ayahs shown **in full** — no truncation, nothing cut mid-word                                        |
| Q14 | With many options                                                    | The grid scrolls rather than pushing the question off screen                                                           |
| Q15 | Force a `fill_blank` question                                        | **Four tappable options.** No search box until asked for                                                               |
| Q16 | Click "لا أرى الإجابة" / "I don't see it"                            | A search box appears and the options hide                                                                              |
| Q17 | Answer fill-blank by tapping                                         | One tap answers. No separate confirm step                                                                              |
| Q18 | Click the X in the quiz header                                       | A confirmation: "إنهاء الجلسة دون حفظ؟" / "Leave without saving?"                                                      |
| Q19 | Choose "تابع الاختبار" / "Keep going"                                | The session continues untouched                                                                                        |
| Q20 | X again, then confirm                                                | The session ends                                                                                                       |
| Q21 | Click "إنهاء الاختبار" / "Finish quiz" instead                       | Ends **without** confirmation and the result is saved                                                                  |

### 3.3 Results

| ID  | Steps                                           | Expect                                                                                  |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| Q22 | Finish a quiz with at least one wrong answer    | The results screen appears                                                              |
| Q23 | Look at accuracy by type                        | **Horizontal bars** with a fraction and a percentage — not a wrapped row of pill badges |
| Q24 | Look at an answer row                           | **One** verdict: a tick or a cross. No badge at the end repeating it in words           |
| Q25 | Check the verdict still reaches a screen reader | Each row has visually-hidden "صحيح" / "Correct" or "غير صحيح" / "Incorrect"             |
| Q26 | Look at the bottom buttons                      | "راجع ..." / "Review ..." is the **filled primary**; retry is outlined                  |
| Q27 | Click Review                                    | A new session asking only about what was missed                                         |
| Q28 | Expand a row                                    | Shows the correct answer, your answer, and the ayah on its page                         |

### 3.4 Manual setup

| ID  | Steps                                                                                        | Expect                                                                                         |
| --- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Q29 | `/quiz` → "إعداد يدوي" / "Set it up myself"                                                  | The three-step wizard, with a way back to the goals                                            |
| Q30 | Questions step: untick all but one type                                                      | One ticked                                                                                     |
| Q31 | Back to Scope → Pages tab → type a page number one digit at a time, then return to Questions | **Your one choice is still the only one ticked.** It must not have reset to three              |
| Q32 | On Pages, clear both fields                                                                  | An error appears, and Continue, Questions and Session are **all disabled**. Scope stays usable |
| Q33 | Inspect either page input while the error shows                                              | `aria-invalid="true"` and an `aria-describedby` pointing at the error's id                     |
| Q34 | Count `role="alert"` elements                                                                | Exactly **one**. The message must not be announced three times                                 |
| Q35 | Type a valid page                                                                            | Everything re-enables                                                                          |

---

## 4. Index and settings

| ID  | Steps                        | Expect                                                       |
| --- | ---------------------------- | ------------------------------------------------------------ |
| I1  | `/index`, search `بقره`      | Finds Al-Baqarah                                             |
| I2  | Search `114`                 | Finds An-Nas                                                 |
| I3  | Any result's meta line       | Names the surah, with no `{{surah}}` left in it              |
| S1  | `/settings`, change language | The interface flips direction immediately                    |
| S2  | Change appearance            | Light/dark applies immediately                               |
| S3  | Tab through settings         | Every control reachable, every one with a visible focus ring |

---

## 5. Cross-cutting

Run these on `/`, `/quran/page/3`, `/quiz`, `/index`, `/settings`.

| ID  | Check                  | Expect                                                                                                        |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| X1  | One `h1` per route     | `document.querySelectorAll("h1").length === 1` everywhere, **including the reader**                           |
| X2  | No horizontal overflow | `document.documentElement.scrollWidth <= window.innerWidth` at 400, 768 and 1440                              |
| X3  | Touch targets          | Every button and link at least 44×44px, except glyphs inside `.mushaf-page`, which are inline reading content |
| X4  | No 12px text           | Nothing in the interface uses 12px type                                                                       |
| X5  | Keyboard only          | Put the mouse aside; reach every action on every route with Tab, Shift+Tab, arrows, Enter, Space and Escape   |
| X6  | Focus visibility       | Every focused control has a clear outline, in both themes                                                     |
| X7  | ar/en × light/dark     | Nothing unreadable, clipped or overlapping                                                                    |
| X8  | Console                | No errors in DevTools → Console on any route                                                                  |
| X9  | Persistence            | Set a reading position, preferences, a bookmark, and finish a quiz; reload. All four survive                  |

Measuring X3 quickly, in the Console:

```js
[...document.querySelectorAll("button, a[href], [role=button]")]
  .filter((el) => !el.closest(".mushaf-page"))
  .map((el) => el.getBoundingClientRect())
  .filter((r) => r.width && r.height && (r.width < 44 || r.height < 44)).length;
// expect 0
```

---

## 6. Deliberate behaviours — do not report these as bugs

- Glyphs inside a mushaf page are **not** 44px and are **not** focusable. They
  are inline reading content; the whole ayah is the keyboard target.
- The reader has **no bottom navigation** on a phone. The header's back arrow
  returns home.
- Layout mode is **not** in the reading preferences sheet. It is in the header
  menu on purpose.
- The surah rail appears only at 1280px and above.
- `sm` buttons are 36px. They appear only inside larger targets such as bars
  and rows, never as a primary action.
- Pages 1 and 2 are centre-aligned and look unlike pages 3 onward. That is how
  the Madani mushaf is printed.
- A first-time visitor sees the welcome ayah on the home page; a returning one
  does not.

---

## 7. What a good report looks like

```
R2  | fail | page 77 font 22.24px, every other page 26.28px (1440x900, ar, light)
R44 | pass | 26.2792px at both 1279px and 1440px
Q15 | fail | fill-blank showed a search box and no options (en, dark, 400px)
```

For every failure include: route, language, theme, window width, what you
expected, what you saw, and a screenshot.
