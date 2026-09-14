# Artqiy product invariants

These rules must remain true across Arabic and English UI, light and dark theme, and every screen size.

1. Qur'anic text is never altered by UI logic. Normalization exists only for search and answer comparison, never for display.
2. Increasing mushaf page number always progresses toward the left. Swipes, keyboard arrows, and page controls use the same semantic mapping in every UI language.
3. Switching UI language changes strings, text alignment, and paragraph direction only. It does not change mushaf pagination, ordered quiz sequences, or media progression semantics.
4. Every visible enabled control performs an action.
5. Opening and closing a menu repeatedly always works. Header and overlay state must not be destroyed by unrelated preference or route updates.
6. Every generated quiz question has at least one reachable path to a correct answer.
7. Completing a quiz produces a deterministic score from its recorded answers.
8. Persisted preferences and reading position survive restart. Corrupted stored values degrade to documented defaults instead of invalid routes.
9. Writing a partial reading position must not destroy a more precise stored scroll offset for the same surah.
10. Loading and error states must not leave a control permanently disabled or a spinner permanently visible.
11. At most one recitation stream is audible at a time.
12. Boundary positions (page 1, page 604, surah 1, surah 114, first and last quiz question) never produce dead enabled controls or invalid routes.
13. Search matches on normalized text but highlights and displays the original text.
14. The reader always states the reading position (surah, page, and juz when it applies) without requiring interaction, and its leading navigation control returns to the home page.
