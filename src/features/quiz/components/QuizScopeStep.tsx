import { useMemo, useState } from "react";
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
import { SearchableRtlSelect } from "@/shared/components/SearchableRtlSelect";
import {
  JUZ_NAMES,
  SURAH_NAMES,
  TOTAL_MUSHAF_PAGES,
} from "@/shared/constants/quran";
import { getSurahAyahCount } from "@/shared/services/quran-data";
import type { MushafVerse, QuizScope, QuizScopeMode } from "@/shared/types/quran";

interface QuizScopeStepProps {
  mushafData: MushafVerse[];
  scope: QuizScope;
  onScopeChange: (scope: QuizScope) => void;
  onNext: () => void;
}

function CheckboxGrid({
  count,
  names,
  selected,
  onToggle,
  onToggleAll,
  searchPlaceholder,
}: {
  count: number;
  names: readonly string[];
  selected: Set<number>;
  onToggle: (index: number) => void;
  onToggleAll: () => void;
  searchPlaceholder: string;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      names
        .map((name, index) => ({ name, index: index + 1 }))
        .filter(({ name }) => name.includes(search)),
    [names, search],
  );

  const allSelected = selected.size === count;

  return (
    <div className="space-y-4">
      <Button type="button" variant="outline" onClick={onToggleAll}>
        {allSelected ? "إلغاء اختيار الكل" : "اختيار الكل"}
      </Button>
      <Input
        placeholder={searchPlaceholder}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(({ name, index }) => (
          <label
            key={index}
            className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/50"
          >
            <Checkbox
              checked={selected.has(index)}
              onCheckedChange={() => onToggle(index)}
            />
            <span className="text-sm">
              {index}: {name}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function QuizScopeStep({
  mushafData,
  scope,
  onScopeChange,
  onNext,
}: QuizScopeStepProps) {
  const [mode, setMode] = useState<QuizScopeMode>(scope.mode);
  const [surahSelected, setSurahSelected] = useState<Set<number>>(
    () => new Set(scope.surahIndices ?? []),
  );
  const [juzSelected, setJuzSelected] = useState<Set<number>>(
    () => new Set(scope.juzIndices ?? []),
  );
  const [pageFrom, setPageFrom] = useState(String(scope.pageFrom ?? 1));
  const [pageTo, setPageTo] = useState(String(scope.pageTo ?? 1));
  const [ayahSurah, setAyahSurah] = useState(String(scope.ayahRangeSurah ?? 1));
  const [ayahFrom, setAyahFrom] = useState(String(scope.ayahFrom ?? 1));
  const [ayahTo, setAyahTo] = useState(String(scope.ayahTo ?? 7));

  const surahOptions = SURAH_NAMES.map((name, index) => ({
    value: String(index + 1),
    label: `${index + 1}. ${name}`,
  }));

  const maxAyah = getSurahAyahCount(
    mushafData,
    Number.parseInt(ayahSurah, 10) || 1,
  );

  const isValid = useMemo(() => {
    switch (mode) {
      case "surah":
        return surahSelected.size > 0;
      case "juz":
        return juzSelected.size > 0;
      case "page": {
        const from = Number.parseInt(pageFrom, 10);
        const to = Number.parseInt(pageTo, 10);
        return (
          Number.isFinite(from) &&
          Number.isFinite(to) &&
          from >= 1 &&
          to <= TOTAL_MUSHAF_PAGES &&
          from <= to
        );
      }
      case "ayah_range": {
        const surah = Number.parseInt(ayahSurah, 10);
        const from = Number.parseInt(ayahFrom, 10);
        const to = Number.parseInt(ayahTo, 10);
        return (
          Number.isFinite(surah) &&
          Number.isFinite(from) &&
          Number.isFinite(to) &&
          from >= 1 &&
          to <= maxAyah &&
          from <= to
        );
      }
      default:
        return false;
    }
  }, [
    ayahFrom,
    ayahSurah,
    ayahTo,
    juzSelected.size,
    maxAyah,
    mode,
    pageFrom,
    pageTo,
    surahSelected.size,
  ]);

  const handleConfirm = () => {
    if (!isValid) return;

    switch (mode) {
      case "surah":
        onScopeChange({
          mode,
          surahIndices: [...surahSelected].sort((a, b) => a - b),
        });
        break;
      case "juz":
        onScopeChange({
          mode,
          juzIndices: [...juzSelected].sort((a, b) => a - b),
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
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">اختر نطاق الاختبار</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          حدد السور أو الأجزاء أو الصفحات أو نطاق آيات محدد.
        </p>
      </div>

      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value as QuizScopeMode)}
      >
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="surah">السور</TabsTrigger>
          <TabsTrigger value="juz">الأجزاء</TabsTrigger>
          <TabsTrigger value="page">الصفحات</TabsTrigger>
          <TabsTrigger value="ayah_range">نطاق آيات</TabsTrigger>
        </TabsList>

        <TabsContent value="surah" className="mt-4">
          <CheckboxGrid
            count={114}
            names={SURAH_NAMES}
            selected={surahSelected}
            searchPlaceholder="ابحث عن سورة..."
            onToggle={(index) => {
              setSurahSelected((previous) => {
                const next = new Set(previous);
                if (next.has(index)) next.delete(index);
                else next.add(index);
                return next;
              });
            }}
            onToggleAll={() => {
              setSurahSelected((previous) =>
                previous.size === 114
                  ? new Set()
                  : new Set(Array.from({ length: 114 }, (_, index) => index + 1)),
              );
            }}
          />
        </TabsContent>

        <TabsContent value="juz" className="mt-4">
          <CheckboxGrid
            count={30}
            names={JUZ_NAMES}
            selected={juzSelected}
            searchPlaceholder="ابحث عن جزء..."
            onToggle={(index) => {
              setJuzSelected((previous) => {
                const next = new Set(previous);
                if (next.has(index)) next.delete(index);
                else next.add(index);
                return next;
              });
            }}
            onToggleAll={() => {
              setJuzSelected((previous) =>
                previous.size === 30
                  ? new Set()
                  : new Set(Array.from({ length: 30 }, (_, index) => index + 1)),
              );
            }}
          />
        </TabsContent>

        <TabsContent value="page" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="page-from">من صفحة</Label>
              <Input
                id="page-from"
                inputMode="numeric"
                value={pageFrom}
                onChange={(event) => setPageFrom(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="page-to">إلى صفحة</Label>
              <Input
                id="page-to"
                inputMode="numeric"
                value={pageTo}
                onChange={(event) => setPageTo(event.target.value)}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ayah_range" className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label>السورة</Label>
            <SearchableRtlSelect
              value={ayahSurah}
              options={surahOptions}
              onValueChange={setAyahSurah}
              placeholder="اختر السورة"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ayah-from">من آية</Label>
              <Input
                id="ayah-from"
                inputMode="numeric"
                value={ayahFrom}
                onChange={(event) => setAyahFrom(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ayah-to">إلى آية</Label>
              <Input
                id="ayah-to"
                inputMode="numeric"
                value={ayahTo}
                onChange={(event) => setAyahTo(event.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            هذه السورة تحتوي على {maxAyah} آية.
          </p>
        </TabsContent>
      </Tabs>

      <Button size="lg" disabled={!isValid} onClick={handleConfirm}>
        متابعة
      </Button>
    </div>
  );
}
