---
name: hafiz-quran-maintainer
description: Maintain and refactor the Hafiz Quran React application. Use for changes to application architecture, Quran data loading, reader/playback/practice/quiz state, localization, accessibility, styling, tests, tooling, or repository cleanup.
---

# Hafiz Quran Maintainer

Keep changes incremental, readable, accessible, and faithful to the Quran and tafseer source data. Preserve behavior with tests before deleting or reshaping data and state.

## Start With Evidence

1. Read the nearest `AGENTS.md`, relevant public entry points, tests, and configuration.
2. Record the affected user flows, layer boundaries, persisted data, and external effects.
3. Add a characterization or invariant test before changing behavior that is difficult to inspect manually.
4. Prefer the smallest cohesive change that leaves the repository cleaner.

## Preserve Repository Boundaries

- Keep routing, layouts, global providers, and i18n in `src/app`.
- Keep Quran types, repositories, audio services, and passive Mushaf rendering in `src/domain/quran`.
- Keep user workflows in `src/features/<feature>`; do not import another feature's internal files.
- Keep only framework-agnostic UI, hooks, storage, and helpers in `src/shared`.
- Use `model` for pure types and transitions, `services` for browser or network I/O, `hooks` for React wiring, and `components` for rendering.
- Expose cross-layer behavior through a narrow `index.ts` public API. Do not introduce a generic abstraction until two real consumers need it.

## Write Readable React

- Derive values during render when possible. Use effects only to synchronize with a browser API, subscription, timer, network request, media resource, or other external system.
- Model coupled transitions with a reducer or explicit controller instead of several independent booleans.
- Give each setting and media resource one canonical owner. Make async operations cancellable and ignore stale completions with an operation identifier.
- Keep high-frequency telemetry out of broad contexts. Publish playback state only when status, ayah, or active word changes.
- Use `useMemo` only for measured expensive indexes/transforms or a provider value that must remain stable.
- Use `useCallback` only for subscription cleanup, self-referential loops, stable provider actions, or a measured memoized boundary.
- Keep page components as composition layers. Extract pure selectors and cohesive browser logic; avoid pass-through hooks.

## Protect Data And Persisted State

- Preserve Quran and tafseer text byte-for-byte when repacking it.
- Verify 6,236 verses, 114 surahs, 604 pages, 6,236 metadata rows, eight tafseers, and 49,888 tafseer records.
- Cache both in-flight and resolved repository requests; evict rejected requests so retries work.
- Load only route-required Quran chunks. Home and settings must not request Quran data.
- Version persisted schemas and migrate existing values without silently deleting user history or preferences.
- Access browser storage through the shared safe-storage adapter.

## Maintain Accessibility And Localization

- Add every interface string to typed Arabic and English resources; Arabic is the first-run default.
- Update document `lang` and `dir`; keep Quran and tafseer content explicitly Arabic and RTL in either locale.
- Use semantic elements, visible focus, keyboard interaction, live announcements, labelled controls, and at least 44 px touch targets.
- Meet WCAG 2.2 AA contrast and reduced-motion expectations. Test both mobile Arabic and desktop English layouts.
- Render trusted Quran glyph text as text, not `dangerouslySetInnerHTML`.

## Remove Code Safely

- Confirm imports, tests, generated-data dependencies, and runtime reachability before deleting code or assets.
- Remove dead files, exports, dependencies, and superseded datasets in the same change that removes their last consumer.
- Preserve unrelated working-tree changes. Do not perform broad mechanical rewrites during a focused refactor.

## Verify The Change

Run the narrowest relevant tests while iterating, then run the full repository gate before handoff:

```text
npm run check
npm run build
npm run build:practice
```

For data changes, also run `npm run data:verify`. For user-facing flows, run component tests and the relevant Playwright/Axe smoke tests. Verify the default build has no Whisper, Transformers, ONNX, worker, or ORT WASM artifacts and remains within repository budgets.
