# Artqiy — UX review

**This is not a conformance checklist.** `docs/manual-test-plan.md` already
asks "does it match the spec". This asks a harder question: **is it good, and
what would make it better for someone memorizing Quran every day?**

You are expected to form opinions and defend them with evidence. A report
that only says "everything works" is a failed review.

---

## How to judge

The user is memorizing the Quran. They open this app daily, often on a phone,
often for short sessions, often in Arabic. Judge everything against that
person — not against a checklist, and not against your own preferences as a
developer.

For each finding, decide which of these it is:

| Kind          | Meaning                                                           |
| ------------- | ----------------------------------------------------------------- |
| **BUG**       | Something is broken or wrong                                      |
| **FRICTION**  | It works, but costs more effort than it should                    |
| **CONFUSING** | It works, but the user cannot tell what it does or what happened  |
| **UGLY**      | It works and is clear, but looks wrong, unbalanced or unfinished  |
| **MISSING**   | A thing a daily memorizer would reasonably expect and cannot find |

And rank it:

- **P1** — hits every session, or blocks something
- **P2** — hits often, or makes someone hesitate
- **P3** — noticed once, then ignored

**Rank by how much it hurts a daily memorizer, not by how easy it is to fix.**
Ten P3 nitpicks are worth less than one P1.

---

## Evidence, not impressions

Every finding needs enough for someone to act on it without re-running your
session:

- Where: route, language (ar/en), theme, window size
- A screenshot
- For anything about type, spacing or position: the actual numbers, from the
  Console. `getComputedStyle(el).fontFamily`, `.fontSize`, the
  `getBoundingClientRect()`, whatever is relevant
- What you expected instead, concretely. "Make it better" is not a finding;
  "the page number should sit centred in the bar, as it does in a printed
  mushaf" is

If you cannot reproduce something, say so and say what you tried.

---

## Setup

```
npm run dev
```

Use the URL Vite prints. See `docs/manual-test-plan.md` §0 for resetting
state, seeding a returning user, and switching language and theme.

Do the whole review **in Arabic first**. Arabic is the default and the primary
language; English is the translation. A problem that only shows in Arabic is
more serious than one that only shows in English.

---

## 1. Arabic typography and rendering

This matters more here than in almost any other app. Quran text rendered badly
is not a cosmetic problem.

|     | Look at                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | **Every place Arabic appears outside the mushaf page**: quiz options, search results, the surah list, the index, dialog titles, the reader header. For each, report the computed `font-family` and whether the glyphs look correct                                                                                                                                                                                                                            |
| 1.2 | **Ayah numbers and markers wherever they appear.** A known report: numbers in the quiz's question/answer area rendered as "بج" instead of digits. Reproduce it. When you find it, capture: the element, its computed `font-family`, the actual characters (`[...el.textContent].map(c => c.codePointAt(0).toString(16))`), and whether `document.fonts.check("16px \"Uthmanic Hafs Local\"")` is true. **Do not guess the cause — gather this and report it** |
| 1.3 | **The per-page mushaf font.** In the reader, and again in the quiz's page preview, check `document.fonts.status` and whether the page glyphs look like real Quran text or like fallback boxes/garbage. The quiz preview and the reader may not behave the same                                                                                                                                                                                                |
| 1.4 | **Numerals.** Arabic-Indic (٢٣) in Arabic, Western (23) in English — everywhere, with no mixing inside one screen                                                                                                                                                                                                                                                                                                                                             |
| 1.5 | **Line height and crowding.** Arabic needs more leading than Latin. Anywhere Arabic text feels cramped or the diacritics collide, say where                                                                                                                                                                                                                                                                                                                   |
| 1.6 | **Mixed text.** Anywhere Arabic and a number or Latin word sit together — does the order read correctly, or does bidi scramble it?                                                                                                                                                                                                                                                                                                                            |
| 1.7 | **Font size.** Is anything too small to read comfortably in Arabic at arm's length on a phone?                                                                                                                                                                                                                                                                                                                                                                |

---

## 2. Layout, balance and position

Judge like a designer looking at a page, not a tester looking at a list.

|     | Look at                                                                                                                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | **The reader's bottom bar.** A specific complaint: page navigation looks wrong where it sits and may belong centred. Look at it, decide, and say what you would do — with a screenshot and the measured positions of each element in the bar |
| 2.2 | **Every screen at 400px and at 1440px.** Anything unbalanced, floating, stranded, or hugging one edge for no reason                                                                                                                          |
| 2.3 | **The reader on a wide screen.** The mushaf page is ~460px of a 1900px screen with a surah rail beside it. Is that a good use of the space? What else would you put there, if anything?                                                      |
| 2.4 | **Alignment.** Do things line up down the page, or do edges wander?                                                                                                                                                                          |
| 2.5 | **Density.** Too much on screen anywhere? Too little?                                                                                                                                                                                        |
| 2.6 | **The quiz question screen.** Where do the eyes go first? Should they?                                                                                                                                                                       |
| 2.7 | **Home.** Is the most important thing the most prominent thing?                                                                                                                                                                              |

---

## 3. Friction — count the taps

For each of these, count the taps from a cold open and time it:

|      | Task                                                        |
| ---- | ----------------------------------------------------------- |
| 3.1  | Open the app and resume reading where you left off          |
| 3.2  | Go to a specific ayah you have memorized — say 2:255        |
| 3.3  | Jump to Surah Al-Mulk from anywhere                         |
| 3.4  | Start listening to the page you are reading                 |
| 3.5  | Hear one ayah repeated ten times (a real memorization need) |
| 3.6  | Quiz yourself on what you read today                        |
| 3.7  | Quiz yourself on the ayahs you keep getting wrong           |
| 3.8  | Bookmark an ayah and come back to it tomorrow               |
| 3.9  | Change the reciter                                          |
| 3.10 | Make the Arabic bigger                                      |

For any task over three taps, say what you would cut.

---

## 4. Can you tell what happened?

|     | Check                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 | After every action — did the app make clear what it did?                                                                                                                                    |
| 4.2 | Anything that changes silently, with no feedback                                                                                                                                            |
| 4.3 | Any control whose purpose you cannot guess from its label or icon                                                                                                                           |
| 4.4 | Any dead end, where the only way on is Back                                                                                                                                                 |
| 4.5 | Error states. Break things deliberately: go offline, enter a page number of 9999, start a quiz on a single ayah, search for nonsense. Is every message something a person would understand? |
| 4.6 | Loading. What do you see while data loads? Is it reassuring or alarming?                                                                                                                    |
| 4.7 | Empty states. Clear all storage and visit every route                                                                                                                                       |

---

## 5. What is missing

This is the most valuable section. Think about what a person memorizing Quran
does, and what this app does not yet help with.

Prompts to think against — not a list to fill in:

- How does someone track _what they have memorized_ versus what they have read?
- Repetition is the core of memorization. Is there enough support for it?
- Spaced repetition — is what exists enough, or guesswork?
- What happens over weeks? Is there any sense of progress beyond a streak?
- Reciting aloud and being corrected — the app has something here; is it
  findable, and does it help?
- Reading with a teacher, or a plan (a juz a month, a page a day)?
- Anything a physical mushaf gives you that this does not?
- Anything you personally wanted while using it and could not find?

For each: what it is, why a memorizer would want it, and how big a change it
looks like from the outside.

---

## 6. Taste

Spend real time here. Use the app as though it were yours, for twenty minutes,
in Arabic, on a phone-sized window.

- Does it feel calm, or busy?
- Does it feel like a tool for scripture, or like a generic app?
- Does anything feel cheap, unfinished or inconsistent?
- What is the single best thing about it?
- What is the single worst thing about it?
- Would you use it daily? Why or why not?

Answer honestly. Encouraging noise is worth nothing.

---

## 7. The report

Structure it like this:

1. **Verdict** — three or four sentences. Would a daily memorizer keep using
   this? What is the one thing holding it back?
2. **P1 findings** — each with kind, evidence, and a concrete proposal
3. **P2 findings** — same
4. **P3 findings** — one line each, no ceremony
5. **Missing features** — ranked by value to a memorizer
6. **The one change** — if only one thing could be done, what and why?

Order findings by impact within each priority. Do not pad. A short report with
five real findings beats a long one with fifty observations.
