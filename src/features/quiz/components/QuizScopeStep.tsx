import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SearchableRtlSelect } from "@/shared/components/SearchableRtlSelect";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
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
  SURAH_NAMES,
  TOTAL_MUSHAF_PAGES,
  type MushafVerse,
  getSurahAyahCount,
} from "@/domain/quran";
import { normalizeArabicForMatch } from "@/shared/lib/arabic-normalize";
import { useQuizFormatters } from "../hooks/useQuizFormatters";
import type { QuizScope, QuizScopeMode } from "../model/types";

interface QuizScopeStepProps {
  mushafData: MushafVerse[];
  scope: QuizScope;
  onScopeChange: (scope: QuizScope) => void;
  onNext: () => void;
}

interface CheckboxGridProps {
  count: number;
  names: readonly string[];
  selected: Set<number>;
  onToggle: (index: number) => void;
  onToggleAll: () => void;
  searchPlaceholder: string;
  groupLabel: string;
}

function CheckboxGrid({
  count,
  names,
  selected,
  onToggle,
  onToggleAll,
  searchPlaceholder,
  groupLabel,
}: CheckboxGridProps) {
  const { t } = useTranslation("quiz");
  const { formatNumber } = useQuizFormatters();
  const [search, setSearch] = useState("");
  const filtered = names
    .map((name, index) => ({ name, index: index + 1 }))
    .filter(({ name }) =>
      normalizeArabicForMatch(name).includes(normalizeArabicForMatch(search)),
    );
  const allSelected = selected.size === count;

  return (
    <fieldset className="space-y-4">
      <legend className="sr-only">{groupLabel}</legend>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={onToggleAll}
        >
          {allSelected ? t("actions.clearAll") : t("actions.selectAll")}
        </Button>
        <Input
          className="min-h-11 min-w-56 flex-1"
          aria-label={searchPlaceholder}
          placeholder={searchPlaceholder}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(({ name, index }) => (
          <label
            key={index}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/50"
          >
            <Checkbox
              checked={selected.has(index)}
              onCheckedChange={() => onToggle(index)}
            />
            <span className="text-sm" dir="rtl" lang="ar">
              {formatNumber(index)}. {name}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function toggleSelection(previous: Set<number>, index: number): Set<number> {
  const next = new Set(previous);
  if (next.has(index)) next.delete(index);
  else next.add(index);
  return next;
}

export function QuizScopeStep({
  mushafData,
  scope,
  onScopeChange,
  onNext,
}: QuizScopeStepProps) {
  const { t } = useTranslation("quiz");
  const { formatNumber } = useQuizFormatters();
  const [mode, setMode] = useState<QuizScopeMode>(scope.mode);
  const [surahSelected, setSurahSelected] = useState(
    () => new Set(scope.surahIndices ?? []),
  );
  const [juzSelected, setJuzSelected] = useState(
    () => new Set(scope.juzIndices ?? []),
  );
  const [pageFrom, setPageFrom] = useState(String(scope.pageFrom ?? 1));
  const [pageTo, setPageTo] = useState(String(scope.pageTo ?? 1));
  const [ayahSurah, setAyahSurah] = useState(String(scope.ayahRangeSurah ?? 1));
  const [ayahFrom, setAyahFrom] = useState(String(scope.ayahFrom ?? 1));
  const [ayahTo, setAyahTo] = useState(String(scope.ayahTo ?? 7));
  const surahOptions = SURAH_NAMES.map((name, index) => ({
    value: String(index + 1),
    label: `${formatNumber(index + 1)}. ${name}`,
  }));
  const maxAyah = getSurahAyahCount(
    mushafData,
    Number.parseInt(ayahSurah, 10) || 1,
  );

  function isValid(): boolean {
    if (mode === "surah") return surahSelected.size > 0;
    if (mode === "juz") return juzSelected.size > 0;
    if (mode === "page") {
      const from = Number.parseInt(pageFrom, 10);
      const to = Number.parseInt(pageTo, 10);
      return from >= 1 && to <= TOTAL_MUSHAF_PAGES && from <= to;
    }
    const from = Number.parseInt(ayahFrom, 10);
    const to = Number.parseInt(ayahTo, 10);
    return from >= 1 && to <= maxAyah && from <= to;
  }

  function confirmScope(): void {
    if (!isValid()) return;
    switch (mode) {
      case "surah":
        onScopeChange({
          mode,
          surahIndices: [...surahSelected].sort((left, right) => left - right),
        });
        break;
      case "juz":
        onScopeChange({
          mode,
          juzIndices: [...juzSelected].sort((left, right) => left - right),
        });
        break;
      case "page":
        onScopeChange({
          mode,
          pageFrom: Number.parseInt(pageFrom, 10),
          pageTo: Number.parseInt(pageTo, 10),
        });
        break;
      case "ayah_range":
        onScopeChange({
          mode,
          ayahRangeSurah: Number.parseInt(ayahSurah, 10),
          ayahFrom: Number.parseInt(ayahFrom, 10),
          ayahTo: Number.parseInt(ayahTo, 10),
        });
        break;
    }
    onNext();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t("scope.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("scope.description")}
        </p>
      </div>
      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value as QuizScopeMode)}
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

        <TabsContent value="surah" className="mt-4">
          <CheckboxGrid
            count={114}
            names={SURAH_NAMES}
            selected={surahSelected}
            groupLabel={t("scope.tabs.surah")}
            searchPlaceholder={t("scope.searchSurah")}
            onToggle={(index) =>
              setSurahSelected((previous) => toggleSelection(previous, index))
            }
            onToggleAll={() =>
              setSurahSelected((previous) =>
                previous.size === 114
                  ? new Set()
                  : new Set(
                      Array.from({ length: 114 }, (_, index) => index + 1),
                    ),
              )
            }
          />
        </TabsContent>
        <TabsContent value="juz" className="mt-4">
          <CheckboxGrid
            count={30}
            names={JUZ_NAMES}
            selected={juzSelected}
            groupLabel={t("scope.tabs.juz")}
            searchPlaceholder={t("scope.searchJuz")}
            onToggle={(index) =>
              setJuzSelected((previous) => toggleSelection(previous, index))
            }
            onToggleAll={() =>
              setJuzSelected((previous) =>
                previous.size === 30
                  ? new Set()
                  : new Set(
                      Array.from({ length: 30 }, (_, index) => index + 1),
                    ),
              )
            }
          />
        </TabsContent>
        <TabsContent value="page" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quiz-page-from">{t("scope.fromPage")}</Label>
              <Input
                id="quiz-page-from"
                type="number"
                min={1}
                max={TOTAL_MUSHAF_PAGES}
                value={pageFrom}
                onChange={(event) => setPageFrom(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quiz-page-to">{t("scope.toPage")}</Label>
              <Input
                id="quiz-page-to"
                type="number"
                min={1}
                max={TOTAL_MUSHAF_PAGES}
                value={pageTo}
                onChange={(event) => setPageTo(event.target.value)}
              />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="ayah_range" className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label>{t("scope.surah")}</Label>
            <SearchableRtlSelect
              value={ayahSurah}
              options={surahOptions}
              onValueChange={setAyahSurah}
              placeholder={t("scope.surah")}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quiz-ayah-from">{t("scope.fromAyah")}</Label>
              <Input
                id="quiz-ayah-from"
                type="number"
                min={1}
                max={maxAyah}
                value={ayahFrom}
                onChange={(event) => setAyahFrom(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quiz-ayah-to">{t("scope.toAyah")}</Label>
              <Input
                id="quiz-ayah-to"
                type="number"
                min={1}
                max={maxAyah}
                value={ayahTo}
                onChange={(event) => setAyahTo(event.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("scope.ayahCount", { count: formatNumber(maxAyah) })}
          </p>
        </TabsContent>
      </Tabs>
      <Button size="lg" disabled={!isValid()} onClick={confirmScope}>
        {t("scope.continue")}
      </Button>
    </div>
  );
}
