# Quran data sources

The runtime Quran files are generated from the versioned source packs in
`scripts/quran/source-data/v1`. The packs preserve every text value that was in
the repository's legacy Quran, layout, and Arabic tafseer datasets before they
were consolidated.

- Quran text and metadata came from the legacy files named in the source-pack
  manifest. Their upstream provider was not recorded in the original files, so
  no provider is inferred here.
- Word layout data identifies `https://api.quran.com/api/v4` as its source and
  uses Quran.com mushaf 19.
- The eight Arabic tafseer collections retain their original Arabic names and
  text. Their upstream provider was not recorded in the original files.

`import-legacy-data.mjs` is the one-time importer for the former file layout.
It records SHA-256 hashes of the legacy inputs and refuses data that violates
the 6,236-verse, 114-surah, 604-page, eight-tafseer, or 49,888-record invariants.
It does not trim, normalize, or otherwise rewrite text values.

Use `generate-data.mjs` to deterministically rebuild the compressed runtime
chunks and `verify-data.mjs` to compare every generated Quran/layout record and
tafseer text with the consolidated sources.
