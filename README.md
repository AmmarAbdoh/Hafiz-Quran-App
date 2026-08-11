# Hafiz Quran | حافظ القرآن

An Arabic-first, bilingual Quran reading and memorization app built with React 18, TypeScript, Vite, and Tailwind CSS.

The app includes the Editorial Mushaf reader, tafsir, recitation playback, configurable memorization quizzes, Arabic/English interface localization, and light/dark themes. Recitation practice is an isolated, optional build capability and is disabled in the default production build.

## Requirements

- Node.js 24 LTS
- npm 11
- A current evergreen browser

```bash
npm install
npm run dev
```

The development server starts at `http://localhost:5173` by default.

## Architecture

```text
src/
  app/                  router, layouts, global preferences, and i18n
  domain/quran/         Quran models, repository, audio, and passive Mushaf UI
  features/             reader, quiz, practice, home, and settings flows
  shared/               generic UI, storage, hooks, and small helpers
  styles/               design tokens and base styles
```

Dependencies flow from `app` to `features` to `domain` to `shared`. Feature internals are private to their feature; shared and domain code never import feature code. See [`AGENTS.md`](./AGENTS.md) and the repository maintainer skill in `.agents/skills/hafiz-quran-maintainer/` before making changes.

## Quran data

Runtime Quran data is deterministic, versioned, and loaded on demand from `public/data/quran/`:

- one compressed core-data file;
- 604 compressed Mushaf page layouts;
- 912 compressed tafsir/surah bundles covering eight tafsirs.

Generate and verify the runtime data with:

```bash
npm run data:generate
npm run data:verify
```

Generation sources, attribution, and legacy fidelity hashes live under `scripts/quran/source-data/v1/`. Do not hand-edit generated runtime chunks.

## Verification

```bash
npm run check
```

The complete gate checks formatting, both TypeScript projects, zero-warning lint, unit/component coverage, dead code, Quran data invariants, the production dependency audit, default/practice builds, bundle budgets, and Playwright/Axe flows.

Useful focused commands:

| Command                  | Purpose                                                |
| ------------------------ | ------------------------------------------------------ |
| `npm run test`           | Run unit and component tests                           |
| `npm run test:e2e`       | Run browser and accessibility smoke tests              |
| `npm run lint`           | Run type-aware ESLint with zero warnings               |
| `npm run typecheck`      | Check application and tool configuration projects      |
| `npm run build`          | Build the default app without practice model artifacts |
| `npm run build:practice` | Build the optional recitation-practice variant         |
| `npm run build:budget`   | Enforce output size, file-count, and isolation budgets |

Install the Playwright browser once with `npm run test:e2e:install`.

## Privacy and external requests

There are no accounts or analytics. Preferences and quiz history remain in browser storage. Quran text, metadata, layouts, and tafsir are served as local static files. Recitation playback requests audio from the configured Quran audio hosts. When the optional practice build is enabled, speech-model files are downloaded from Hugging Face and microphone audio is processed locally in the browser; it is not uploaded by this app.

These external requests and storage behaviors are also disclosed in Arabic and English in Settings.

## Deployment

The default app is a static SPA in `dist/`. Security headers and client-side route rewrites are configured in `vercel.json`; no deployment is performed by the repository scripts.
