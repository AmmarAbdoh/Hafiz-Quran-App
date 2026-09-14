import { useState } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SearchableSelect } from "@/shared/components/SearchableSelect";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import {
  JUZ_NAMES,
  TOTAL_MUSHAF_PAGES,
  type MushafVerse,
  getSurahAyahCount,
} from "@/domain/quran";
import { normalizeArabicForMatch } from "@/shared/lib/arabic-normalize";
import { cn } from "@/shared/lib/utils";
import { useQuizFormatters } from "../hooks/useQuizFormatters";
import { validateScope } from "../model/scopeValidation";
import type { QuizScope, QuizScopeMode } from "../model/types";
import { QuizScopeChips } from "./QuizScopeChips";

interface QuizScopeStepProps {
  mushafData: MushafVerse[];
  scope: QuizScope;
  ayahCount: number;
  onScopeChange: (scope: QuizScope) => void;
  onNext: () => void;
}

type ScopePresetId = "shortSurahs" | "lastJuz" | "fatihah";

/** Starting points that match what most people are memorizing. */
const SCOPE_PRESETS: readonly { id: ScopePresetId; scope: QuizScope }[] = [
  {
    id: "shortSurahs",
    scope: {
      mode: "surah",
      surahIndices: Array.from({ length: 37 }, (_, index) => index + 78),
    },
  },
  { id: "lastJuz", scope: { mode: "juz", juzIndices: [30] } },
  { id: "fatihah", scope: { mode: "surah", surahIndices: [1] } },
];

interface ToggleGridProps {
  total: number;
  names: readonly string[];
  nameLanguage: "ar" | "en";
  selected: number[];
  ayahCountFor?: (index: number) => number;
  onToggle: (index: number) => void;
  onSelectAll: () => void;
  searchPlaceholder: string;
  groupLabel: string;
}

/**
 * Whole cells are the control: a tinted, checked card says "selected" from
 * across the screen, which a small checkbox in a 114-row list does not.
 */
function ToggleGrid({
  total,
  names,
  nameLanguage,
  selected,
  ayahCountFor,
  onToggle,
  onSelectAll,
  searchPlaceholder,
  groupLabel,
}: ToggleGridProps) {
  const { t } = useTranslation("quiz");
  const { formatNumber } = useQuizFormatters();
  const [search, setSearch] = useState("");
  const normalizedSearch = normalizeArabicForMatch(search);
  const selectedSet = new Set(selected);
  const filtered = names
    .map((name, index) => ({ name, index: index + 1 }))
    .filter(
      ({ name, index }) =>
        normalizeArabicForMatch(name).includes(normalizedSearch) ||
        String(index).includes(search.trim()),
    );

  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">{groupLabel}</legend>
      <div className="flex flex-wrap gap-2">
        <Input
          className="min-h-11 min-w-48 flex-1"
          type="search"
          aria-label={searchPlaceholder}
          placeholder={searchPlaceholder}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button type="button" variant="outline" onClick={onSelectAll}>
          {t("actions.selectAll")}
        </Button>
      </div>

      <div className="max-h-72 overflow-y-auto rounded-xl border border-border p-1">
        {filtered.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground" role="status">
            {t("scope.noMatches")}
          </p>
        ) : (
          <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(({ name, index }) => {
              const isSelected = selectedSet.has(index);
              return (
                <li key={index}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    onClick={() => onToggle(index)}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-2 rounded-lg border px-2.5 py-1 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected
                        ? "border-primary bg-primary/10 font-semibold text-primary"
                        : "border-transparent hover:border-border hover:bg-muted/60",
                    )}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      <span
                        className={
                          isSelected ? "font-normal" : "text-muted-foreground"
                        }
                      >
                        {formatNumber(index)}.
                      </span>{" "}
                      <bdi
                        dir={nameLanguage === "ar" ? "rtl" : "ltr"}
                        lang={nameLanguage}
                      >
                        {name}
                      </bdi>
                    </span>
                    {ayahCountFor && (
                      <span
                        className={cn(
                          "shrink-0 text-label",
                          isSelected ? "font-normal" : "text-muted-foreground",
                        )}
                      >
                        {t("summary.ayahs", {
                          count: ayahCountFor(index),
                          formattedCount: formatNumber(ayahCountFor(index)),
                        })}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="text-label text-muted-foreground">
        {t("scope.listHint", {
          count: total,
          formattedCount: formatNumber(total),
        })}
      </p>
    </fieldset>
  );
}

function toggleIndex(values: number[], index: number): number[] {
  return values.includes(index)
    ? values.filter((value) => value !== index)
    : [...values, index].sort((left, right) => left - right);
}

export function QuizScopeStep({
  mushafData,
  scope,
  ayahCount,
  onScopeChange,
  onNext,
}: QuizScopeStepProps) {
  const { t } = useTranslation("quiz");
  const { formatNumber, surahNames, surahNameLanguage } = useQuizFormatters();
  const [mode, setMode] = useState<QuizScopeMode>(scope.mode);
  // Drafts hold what is on screen; the committed scope only ever takes valid
  // values, so leaving the step mid-edit cannot lose a selection or store one
  // that makes no sense.
  const [draft, setDraft] = useState<QuizScope>(scope);
  const surahIndices = draft.surahIndices ?? [];
  const juzIndices = draft.juzIndices ?? [];
  const surahOptions = surahNames.map((name, index) => ({
    value: String(index + 1),
    label: `${formatNumber(index + 1)}. ${name}`,
  }));
  const rangeSurah = draft.ayahRangeSurah ?? 1;
  const maxAyah = getSurahAyahCount(mushafData, rangeSurah);

  function update(changes: Partial<QuizScope>, nextMode = mode): void {
    const next: QuizScope = { ...draft, ...changes, mode: nextMode };
    setDraft(next);
    if (validateScope(next, mushafData) === null) onScopeChange(next);
  }

  function applyPreset(preset: QuizScope): void {
    setMode(preset.mode);
    update(preset, preset.mode);
  }

  const error = validateScope({ ...draft, mode }, mushafData);

  return (
    <div className="space-y-5">
      <div>
        <h2 tabIndex={-1} className="text-xl font-semibold outline-none">
          {t("scope.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("scope.description")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-label font-semibold text-muted-foreground">
          {t("scope.presetsLabel")}
        </span>
        {SCOPE_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => applyPreset(preset.scope)}
          >
            {t(`scope.presets.${preset.id}`)}
          </Button>
        ))}
      </div>

      <Tabs
        value={mode}
        onValueChange={(value) => {
          const nextMode = value as QuizScopeMode;
          setMode(nextMode);
          update({}, nextMode);
        }}
      >
        <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger className="min-h-11" value="surah">
            {t("scope.tabs.surah")}
          </TabsTrigger>
          <TabsTrigger className="min-h-11" value="juz">
            {t("scope.tabs.juz")}
          </TabsTrigger>
          <TabsTrigger className="min-h-11" value="page">
            {t("scope.tabs.page")}
          </TabsTrigger>
          <TabsTrigger className="min-h-11" value="ayah_range">
            {t("scope.tabs.ayahRange")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="surah" className="mt-4 space-y-3">
          <QuizScopeChips
            selected={surahIndices}
            names={surahNames}
            nameLanguage={surahNameLanguage}
            emptyLabel={t("scope.pickSurah")}
            onRemove={(index) =>
              update({ surahIndices: toggleIndex(surahIndices, index) })
            }
            onClear={() => update({ surahIndices: [] })}
          />
          <ToggleGrid
            total={114}
            names={surahNames}
            nameLanguage={surahNameLanguage}
            selected={surahIndices}
            ayahCountFor={(index) => getSurahAyahCount(mushafData, index)}
            groupLabel={t("scope.tabs.surah")}
            searchPlaceholder={t("scope.searchSurah")}
            onToggle={(index) =>
              update({ surahIndices: toggleIndex(surahIndices, index) })
            }
            onSelectAll={() =>
              update({
                surahIndices: Array.from(
                  { length: 114 },
                  (_, index) => index + 1,
                ),
              })
            }
          />
        </TabsContent>

        <TabsContent value="juz" className="mt-4 space-y-3">
          <QuizScopeChips
            selected={juzIndices}
            names={JUZ_NAMES}
            nameLanguage="ar"
            emptyLabel={t("scope.pickJuz")}
            onRemove={(index) =>
              update({ juzIndices: toggleIndex(juzIndices, index) })
            }
            onClear={() => update({ juzIndices: [] })}
          />
          <ToggleGrid
            total={30}
            names={JUZ_NAMES}
            nameLanguage="ar"
            selected={juzIndices}
            groupLabel={t("scope.tabs.juz")}
            searchPlaceholder={t("scope.searchJuz")}
            onToggle={(index) =>
              update({ juzIndices: toggleIndex(juzIndices, index) })
            }
            onSelectAll={() =>
              update({
                juzIndices: Array.from({ length: 30 }, (_, index) => index + 1),
              })
            }
          />
        </TabsContent>

        <TabsContent value="page" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quiz-page-from">{t("scope.fromPage")}</Label>
              <Input
                id="quiz-page-from"
                className="min-h-11"
                type="number"
                inputMode="numeric"
                min={1}
                max={TOTAL_MUSHAF_PAGES}
                value={draft.pageFrom ?? ""}
                onChange={(event) =>
                  update({
                    pageFrom: Number.parseInt(event.target.value, 10),
                    pageTo:
                      draft.pageTo ?? Number.parseInt(event.target.value, 10),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quiz-page-to">{t("scope.toPage")}</Label>
              <Input
                id="quiz-page-to"
                className="min-h-11"
                type="number"
                inputMode="numeric"
                min={1}
                max={TOTAL_MUSHAF_PAGES}
                value={draft.pageTo ?? ""}
                onChange={(event) =>
                  update({ pageTo: Number.parseInt(event.target.value, 10) })
                }
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ayah_range" className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label>{t("scope.surah")}</Label>
            <SearchableSelect
              value={String(rangeSurah)}
              options={surahOptions}
              onValueChange={(value) =>
                update({ ayahRangeSurah: Number.parseInt(value, 10) })
              }
              placeholder={t("scope.surah")}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quiz-ayah-from">{t("scope.fromAyah")}</Label>
              <Input
                id="quiz-ayah-from"
                className="min-h-11"
                type="number"
                inputMode="numeric"
                min={1}
                max={maxAyah}
                value={draft.ayahFrom ?? ""}
                onChange={(event) =>
                  update({ ayahFrom: Number.parseInt(event.target.value, 10) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quiz-ayah-to">{t("scope.toAyah")}</Label>
              <Input
                id="quiz-ayah-to"
                className="min-h-11"
                type="number"
                inputMode="numeric"
                min={1}
                max={maxAyah}
                value={draft.ayahTo ?? ""}
                onChange={(event) =>
                  update({ ayahTo: Number.parseInt(event.target.value, 10) })
                }
              />
            </div>
          </div>
          <p className="text-label text-muted-foreground">
            {t("scope.ayahCount", { count: formatNumber(maxAyah) })}
          </p>
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p
          className={
            error
              ? "text-sm font-medium text-destructive"
              : "text-sm text-muted-foreground"
          }
          role={error ? "alert" : "status"}
        >
          {error
            ? t(`scope.errors.${error}`, {
                maxPage: formatNumber(TOTAL_MUSHAF_PAGES),
                maxAyah: formatNumber(maxAyah),
              })
            : t("scope.poolSize", {
                count: ayahCount,
                formattedCount: formatNumber(ayahCount),
              })}
        </p>
        <Button size="lg" disabled={Boolean(error)} onClick={onNext}>
          {t("scope.continue")}
        </Button>
      </div>
    </div>
  );
}
