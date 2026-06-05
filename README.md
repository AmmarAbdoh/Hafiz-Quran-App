# حافظ القرآن — Hafiz Quran

A modern Quran memorization companion built with React, TypeScript, and Tailwind CSS.

## Features

- **Quran Reader** — Browse the Mushaf page by page (604 pages), search surahs, and view tafseer for any ayah
- **Custom Quiz** — Test your memorization with customizable quizzes:
  - Select specific surahs or juz (parts)
  - Multiple question types: fill in the blank, surah name, ayah number, juz number, hizb number, page number
  - Instant feedback with verse metadata after each answer

## Tech Stack

- React 18 + TypeScript
- Vite 6
- Tailwind CSS v4 + shadcn/ui components
- React Router 6
- Vitest + Testing Library

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests |
| `npm run typecheck` | TypeScript type checking |

## Project Structure

```
src/
├── app/              # Router, layout, providers
├── features/
│   ├── home/         # Home page
│   ├── quran-reader/ # Mushaf reader
│   └── quiz/         # Custom quiz
├── shared/
│   ├── components/   # Reusable UI + shadcn components
│   ├── services/     # Quran data access layer
│   ├── types/        # TypeScript types
│   └── constants/    # Surah names, juz names, etc.
└── styles/           # Global CSS + design tokens
```

## Data

Quran JSON data lives in `public/data/quran/` and is loaded lazily via fetch (not bundled into JS). This includes mushaf pages, chapter/juz verses, tafseer, and verse metadata.

## Deployment

The app is a static SPA. Use `npm run build` and deploy the `dist/` folder. Client-side routing is configured via `vercel.json` and `public/_redirects`.
