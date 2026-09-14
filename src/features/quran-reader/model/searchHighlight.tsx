import { type ReactNode } from "react";
import {
  containsArabicScript,
  normalizeArabicForMatch,
} from "@/shared/lib/arabic-normalize";

function wrapMatch(text: string, start: number, end: number): ReactNode {
  if (start < 0 || end <= start) return text;

  return (
    <>
      {text.slice(0, start)}
      <mark className="rounded-sm bg-accent/40 px-0.5 text-inherit">
        {text.slice(start, end)}
      </mark>
      {text.slice(end)}
    </>
  );
}

function mapNormalizedRangeToOriginal(
  text: string,
  normalizedStart: number,
  normalizedLength: number,
): { start: number; end: number } | null {
  let normalizedIndex = 0;
  let start = -1;
  let end = -1;

  for (let index = 0; index < text.length; index += 1) {
    const normalizedChar = normalizeArabicForMatch(text[index] ?? "");
    if (!normalizedChar) continue;

    if (normalizedIndex === normalizedStart && start < 0) {
      start = index;
    }

    normalizedIndex += normalizedChar.length;

    if (start >= 0 && normalizedIndex >= normalizedStart + normalizedLength) {
      end = index + 1;
      break;
    }
  }

  if (start < 0) return null;
  return { start, end: end < 0 ? text.length : end };
}

function highlightArabicMatch(text: string, query: string): ReactNode {
  const normalizedText = normalizeArabicForMatch(text);
  const normalizedQuery = normalizeArabicForMatch(query);
  if (!normalizedQuery) return text;

  const matchIndex = normalizedText.indexOf(normalizedQuery);
  if (matchIndex < 0) return text;

  const range = mapNormalizedRangeToOriginal(
    text,
    matchIndex,
    normalizedQuery.length,
  );
  if (!range) return text;

  return wrapMatch(text, range.start, range.end);
}

export function highlightSearchMatch(text: string, query: string): ReactNode {
  const trimmed = query.trim();
  if (!trimmed) return text;

  if (containsArabicScript(text) || containsArabicScript(trimmed)) {
    return highlightArabicMatch(text, trimmed);
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = trimmed.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerQuery);
  if (matchIndex < 0) return text;

  return wrapMatch(text, matchIndex, matchIndex + trimmed.length);
}

export function textMatchesSearch(text: string, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  if (containsArabicScript(text) || containsArabicScript(trimmed)) {
    const normalizedText = normalizeArabicForMatch(text);
    const normalizedQuery = normalizeArabicForMatch(trimmed);
    return (
      normalizedQuery.length > 0 && normalizedText.includes(normalizedQuery)
    );
  }

  return text.toLowerCase().includes(trimmed.toLowerCase());
}
