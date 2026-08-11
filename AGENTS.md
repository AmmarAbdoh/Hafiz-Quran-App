# Hafiz Quran Repository Rules

- Use `.agents/skills/hafiz-quran-maintainer/SKILL.md` for every code, data, UI, test, or tooling change.
- Preserve the `app -> features -> domain -> shared` dependency direction and public module boundaries.
- Prefer direct readable code over speculative abstractions. Add helpers only when they clarify a real responsibility.
- Do not use `useMemo` or `useCallback` unless computation cost or identity stability requires it.
- Use effects only to synchronize with external systems; keep pure derivations in render or model code.
- Preserve Quran and tafseer fidelity, migrate persisted user data, and keep Arabic content explicitly RTL.
- Build accessible Arabic and English interfaces and verify both directions.
- Remove dead code, data, assets, and dependencies only after proving they are unreferenced or superseded.
- Run `npm run check`, both build modes, and relevant data/UI tests before handoff.
