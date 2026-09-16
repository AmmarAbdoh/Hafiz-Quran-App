# Artqiy — full review

One review covering everything: does it work, is it correct, is it fast, is it
safe, can everyone use it, is it good to use, and what is missing.

There are two other plans in this folder and this one supersedes both for a
full pass. `manual-test-plan.md` is the narrow conformance run — use it when
you only want to know whether a change broke something. `ux-review-plan.md` is
section 7 of this document, expanded.

**You are expected to form opinions and defend them with evidence.** A report
that says "everything works" is a failed review.

---

## 0. Setup

```
npm install
npm run dev          # the app; note the URL it prints
```

In a second terminal, for the parts that need the real build:

```
npm run build && npm run preview
```

Reset state in DevTools → Console on the app's origin:

```js
localStorage.clear();
location.reload();
```

Seed a returning user (a saved position and two quiz sessions): see
`manual-test-plan.md` §0.3 — copy the block from there.

Switch language in Settings, or `localStorage.setItem("artqiy.locale","en")`.
Switch theme with the sun/moon, or `localStorage.setItem("theme","dark")`.

**Do everything in Arabic first.** It is the default and the primary language;
English is the translation. A fault that only appears in Arabic is worse than
one that only appears in English.

Widths that matter: **400px** (phone), **768px** (tablet), **1440px**
(desktop, where the reader gains a surah rail).

---

## 1. How to report

Classify every finding:

| Kind          | Meaning                                                    |
| ------------- | ---------------------------------------------------------- |
| **BUG**       | Broken, wrong, or lying to the user                        |
| **DATA**      | Quran text, numbering or metadata is incorrect — always P1 |
| **A11Y**      | Someone cannot use it                                      |
| **PERF**      | Slow, heavy, or wasteful enough to notice                  |
| **SECURITY**  | Exposure, injection, or unsafe handling                    |
| **FRICTION**  | Works, costs more effort than it should                    |
| **CONFUSING** | Works, but you cannot tell what it did                     |
| **UGLY**      | Works and is clear, but looks wrong or unfinished          |
| **MISSING**   | A thing a daily memorizer would expect and cannot find     |

Rank **P1 / P2 / P3** by how much it hurts someone memorizing Quran daily —
not by how easy it is to fix. Ten P3s are worth less than one P1.

Every finding needs: route, language, theme, window size, a screenshot, and
the actual numbers where numbers apply (`getComputedStyle`,
`getBoundingClientRect`, timings, byte counts). "It felt slow" is not a
finding; "the reader took 4.2s to first ayah on a cold load" is.

If you cannot reproduce something, say so and say what you tried.

---

## 2. Quran correctness — the highest bar

Nothing else in this document matters as much. This app has one job.

|     | Check                                                                                                                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | Spot-check well-known ayat against a printed mushaf or quran.com: 1:1–7, 2:255, 36:1–5, 112, 114. Text, diacritics, and ayah numbering                                                                                                                                                                                             |
| 2.2 | **Ayah-number ornaments.** The mushaf text encodes them as single codepoints from U+FC00 up. In any font but the Quran face they render as Arabic ligatures — U+FC00 is BEH WITH JEEM, so ayah 1 reads "جب". Hunt for any place this still happens: quiz options, feedback, results, search results, tafsir, share and copy output |
| 2.3 | **Copy and share.** Copy an ayah, paste it into a plain text field. Is it clean Quran text, or does it carry ornament codepoints and non-breaking spaces?                                                                                                                                                                          |
| 2.4 | Page boundaries: does page N end where page N+1 begins, with nothing lost or repeated? Check 5 random boundaries                                                                                                                                                                                                                   |
| 2.5 | Surah openings: bismillah present where it should be, absent for Al-Fatihah and At-Tawbah                                                                                                                                                                                                                                          |
| 2.6 | Juz, hizb and page numbers against a known reference for several ayat                                                                                                                                                                                                                                                              |
| 2.7 | The quiz never asks a question whose answer it shows on screen                                                                                                                                                                                                                                                                     |
| 2.8 | Tafsir: does the text shown belong to the ayah you opened it from?                                                                                                                                                                                                                                                                 |

---

## 3. Does it work

|     | Check                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | Every route: `/`, `/quran/page/{1,2,3,604}`, `/quran/surah/{1,2,114}`, `/index`, `/quiz`, `/settings`, and a nonsense URL |
| 3.2 | Every control on every screen. Anything that does nothing is a bug                                                        |
| 3.3 | Browser Back and Forward everywhere, including mid-quiz and with a dialog open                                            |
| 3.4 | Deep links: paste a reader URL into a fresh tab                                                                           |
| 3.5 | Reload on every route — does state survive?                                                                               |
| 3.6 | Two tabs at once: change a setting in one, does the other cope?                                                           |
| 3.7 | Play a quiz to completion, several times, with each question type                                                         |
| 3.8 | Audio: play, pause, resume, stop, skip, repeat 3×/10×/non-stop, and let a repeat finish                                   |
| 3.9 | Bookmarks: add, find, remove, survive a reload                                                                            |

### Break it on purpose

|      | Check                                                                                                            |
| ---- | ---------------------------------------------------------------------------------------------------------------- |
| 3.10 | Page 0, page 9999, surah 0, surah 999, ayah 9999                                                                 |
| 3.11 | Offline: DevTools → Network → Offline, then use every route. What works, what fails, and does it explain itself? |
| 3.12 | Throttle to Slow 3G and load the reader cold                                                                     |
| 3.13 | Block the font CDN (`verses.quran.foundation`) and load a page. Graceful, or garbage glyphs?                     |
| 3.14 | Corrupt storage: `localStorage.setItem("quiz-history","{{{")` then reload                                        |
| 3.15 | Storage full: fill localStorage to the quota, then finish a quiz                                                 |
| 3.16 | Rapid input: double-tap every primary button; swipe fast repeatedly; spam next/prev                              |

---

## 4. Performance

Use DevTools → Performance and Network, with the **production build**
(`npm run preview`), not the dev server.

|     | Measure                                             | Report                                                                                                        |
| --- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 4.1 | Cold load of `/` — Slow 3G, cache disabled          | First Contentful Paint, Largest Contentful Paint, Total Blocking Time                                         |
| 4.2 | Cold load of `/quran/page/3`                        | Time until Arabic text is actually readable on screen                                                         |
| 4.3 | Turning pages                                       | Is it instant? Any flash, reflow, or type resize?                                                             |
| 4.4 | Bytes on a cold reader load                         | Total transferred, and the three largest files                                                                |
| 4.5 | Long session                                        | Read 20 pages, run 2 quizzes, then check memory in DevTools. Does it climb and stay climbed?                  |
| 4.6 | Scrolling in surah mode, and the desktop surah rail | Any jank? Record a Performance trace and report dropped frames                                                |
| 4.7 | Quiz question generation                            | Any pause between answering and the next question?                                                            |
| 4.8 | Animations                                          | Anything that stutters, or continues when the OS asks for reduced motion (emulate it in DevTools → Rendering) |

---

## 5. Accessibility

Beyond what axe checks — the automated suite already passes, so look for what
it cannot see.

|     | Check                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1 | **Keyboard only.** Put the mouse away entirely. Reach every action on every route. Report anything unreachable, any trap, and anywhere the focus order is illogical                                                 |
| 5.2 | Focus is always visible, in both themes                                                                                                                                                                             |
| 5.3 | A screen reader, if you can run one (NVDA on Windows, VoiceOver on macOS). Otherwise use DevTools → Accessibility tree: does every control have a sensible name? Any name that is a raw key, a codepoint, or empty? |
| 5.4 | Zoom the browser to 200%. Is anything lost, clipped or overlapping?                                                                                                                                                 |
| 5.5 | Emulate `prefers-reduced-motion` and `prefers-contrast: more`                                                                                                                                                       |
| 5.6 | Emulate colour blindness (DevTools → Rendering → Emulate vision deficiencies). Is any state shown by colour alone?                                                                                                  |
| 5.7 | Text contrast in sepia, dark, and dark+sepia                                                                                                                                                                        |
| 5.8 | Touch targets: anything under 44px that a finger is meant to hit                                                                                                                                                    |

---

## 6. Data, storage and privacy

|     | Check                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------ |
| 6.1 | List every key the app writes: `Object.keys(localStorage)`. Is each one necessary, and is any of it sensitive?           |
| 6.2 | Does anything leave the device? Network tab on a full session — every request, to whom, carrying what                    |
| 6.3 | Any analytics, telemetry or third-party script? The app claims "no account needed, stays on this device" — is that true? |
| 6.4 | Quiz history growth over many sessions — is it bounded?                                                                  |
| 6.5 | Does clearing site data leave the app in a working state?                                                                |
| 6.6 | PWA: install it, use it offline, then ship an update and see whether the running app notices                             |
| 6.7 | Service worker: does a stale cache ever serve stale Quran data?                                                          |

---

## 7. Security

|     | Check                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------ |
| 7.1 | Is any user-supplied or remote string rendered as HTML? Search the code for `dangerouslySetInnerHTML` and judge each use |
| 7.2 | Tafsir comes from a remote source — is it sanitised before display?                                                      |
| 7.3 | Content-Security-Policy: is one set, and does the Console report violations?                                             |
| 7.4 | External links: `rel="noopener"` where `target="_blank"`                                                                 |
| 7.5 | Are any URLs built from user input without encoding?                                                                     |
| 7.6 | `npm audit` — report anything high or critical with a real path to exploitation                                          |

---

## 8. Arabic and internationalisation

|     | Check                                                                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8.1 | Every screen in Arabic: is anything laid out as though it were English — arrows pointing the wrong way, things on the wrong side, padding mirrored incorrectly? |
| 8.2 | Numerals: Arabic-Indic in Arabic, Western in English, never mixed on one screen                                                                                 |
| 8.3 | Mixed Arabic and Latin or digits in one line — does bidi order read correctly?                                                                                  |
| 8.4 | Any untranslated string, any raw translation key, any English left in the Arabic UI                                                                             |
| 8.5 | Arabic line height and diacritic collisions                                                                                                                     |
| 8.6 | Switching language mid-flow — mid-quiz, with a dialog open, while audio plays                                                                                   |
| 8.7 | Does anything overflow because the Arabic string is longer or shorter than the English?                                                                         |

---

## 9. Is it good to use

Use the app as though it were yours, for at least twenty minutes, in Arabic,
on a phone-sized window, before writing this section.

### Count the taps

From a cold open, count taps and time each:

resume reading · go to 2:255 · jump to Al-Mulk · listen to this page · repeat
one ayah ten times · quiz today's reading · quiz your mistakes · bookmark an
ayah and return to it tomorrow · change reciter · make the Arabic bigger

Anything over three taps: say what you would cut.

### Judge it

|     | Look at                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------- |
| 9.1 | Typography everywhere Arabic appears. Which face, which size, which leading — and is each right for what it is? |
| 9.2 | Layout and balance at 400px and 1440px. Anything stranded, floating, or hugging an edge for no reason           |
| 9.3 | The reader on a wide screen: the page is a fraction of the width. Good use of the space, or not?                |
| 9.4 | Where do your eyes go first on each screen? Should they?                                                        |
| 9.5 | After every action, can you tell what happened?                                                                 |
| 9.6 | Every empty state, every error state, every loading state                                                       |
| 9.7 | Does it feel calm, or busy? Like a tool for scripture, or a generic app?                                        |
| 9.8 | Best thing about it. Worst thing about it. Would you use it daily?                                              |

---

## 10. What is missing

The most valuable section. Think about what memorizing Quran actually
involves, and what this app does not yet help with.

Prompts to think against, not a list to fill in:

- Tracking what is **memorized** versus merely read
- Repetition and spaced review — is what exists enough, or guesswork?
- A plan: a page a day, a juz a month, finish by Ramadan
- Progress over weeks — which surahs are strengthening, which decaying
- Reciting aloud and being corrected (the code has something here — is it
  shipped, and is it findable?)
- Revision of old memorization versus new
- Anything a physical mushaf gives that this does not
- Anything you wanted while using it and could not find

For each: what it is, why a memorizer wants it, and how large it looks from
outside.

---

## 11. Code health

Only after using the app. Judge against `AGENTS.md` and `INVARIANTS.md`.

|      | Check                                                                |
| ---- | -------------------------------------------------------------------- |
| 11.1 | Run `npm run check`. Report anything that fails                      |
| 11.2 | Are the 14 invariants in `INVARIANTS.md` actually held? Test each    |
| 11.3 | Anything that looks duplicated, dead, or overgrown                   |
| 11.4 | Comments that contradict the code — this repo has had several        |
| 11.5 | Tests that assert nothing, or would pass if the feature were deleted |
| 11.6 | Anywhere a bug fixed once could return without a test catching it    |

---

## 12. The report

1. **Verdict** — four sentences. Would a daily memorizer keep using this? What
   is the single thing holding it back?
2. **P1** — each with kind, evidence, and a concrete proposal
3. **P2** — same
4. **P3** — one line each
5. **Missing features** — ranked by value to a memorizer
6. **The one change** — if only one thing could be done, what and why?

Order by impact within each priority. Do not pad. A short report with six real
findings beats a long one with sixty observations.
