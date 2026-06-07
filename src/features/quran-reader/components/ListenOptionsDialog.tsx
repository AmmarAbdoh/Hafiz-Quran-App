import { useEffect, useMemo, useState } from "react";
import { Infinity, Volume2 } from "lucide-react";
import { useQuranPlayback } from "@/features/quran-reader/context/QuranPlaybackContext";
import type {
  ListenPlan,
  ListenPreset,
  ListenScopeType,
  RepeatMode,
} from "@/features/quran-reader/types/listenPlan";
import {
  buildListenSession,
  defaultPlanFromPreset,
  validateListenPlan,
} from "@/features/quran-reader/utils/listenPlanUtils";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { JUZ_NAMES, SURAH_NAMES } from "@/shared/constants/quran";
import { cn } from "@/shared/lib/utils";
import { toArabicNumerals } from "@/shared/lib/arabic-numerals";
import { formatAyahCount } from "@/shared/lib/arabic-count";
import {
  getSurahAyahCount,
} from "@/shared/services/quran-data";
import type { MushafVerse } from "@/shared/types/quran";

interface ListenOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mushafData: MushafVerse[];
  totalPages: number;
  preset?: ListenPreset | null;
}

const REPEAT_PRESETS = [2, 3, 5, 10] as const;

function scopeToTab(scope: ListenScopeType): string {
  if (scope === "ayah" || scope === "ayah-range") return "ayah";
  if (scope === "page" || scope === "page-range") return "page";
  if (scope === "juz") return "juz";
  return "surah";
}

export function ListenOptionsDialog({
  open,
  onOpenChange,
  mushafData,
  totalPages,
  preset,
}: ListenOptionsDialogProps) {
  const playback = useQuranPlayback();
  const [tab, setTab] = useState("surah");
  const [plan, setPlan] = useState<ListenPlan>(() => defaultPlanFromPreset(preset));
  const [ayahRangeMode, setAyahRangeMode] = useState(false);
  const [pageRangeMode, setPageRangeMode] = useState(false);
  const [surahSearch, setSurahSearch] = useState("");
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next = defaultPlanFromPreset(preset);
    setPlan(next);
    setTab(scopeToTab(next.scope));
    setAyahRangeMode(next.scope === "ayah-range");
    setPageRangeMode(next.scope === "page-range");
    setSurahSearch("");
    setError("");
  }, [open, preset]);

  const filteredSurahs = useMemo(
    () =>
      SURAH_NAMES.map((name, index) => ({ name, number: index + 1 })).filter(
        ({ name }) => name.includes(surahSearch),
      ),
    [surahSearch],
  );

  const setRepeat = (repeatMode: RepeatMode, repeatCount = 1) => {
    setPlan((prev) => ({ ...prev, repeatMode, repeatCount }));
    setError("");
  };

  const handleStart = async () => {
    const finalPlan: ListenPlan = { ...plan };

    if (tab === "ayah") {
      finalPlan.scope = ayahRangeMode ? "ayah-range" : "ayah";
      if (ayahRangeMode) {
        finalPlan.endSurah = finalPlan.endSurah ?? finalPlan.surah;
        finalPlan.endAyah = finalPlan.endAyah ?? finalPlan.ayah;
      }
    } else if (tab === "page") {
      finalPlan.scope = pageRangeMode ? "page-range" : "page";
      finalPlan.endPage = pageRangeMode
        ? (finalPlan.endPage ?? finalPlan.page)
        : finalPlan.page;
    } else if (tab === "surah") {
      finalPlan.scope = "surah";
    } else if (tab === "juz") {
      finalPlan.scope = "juz";
      finalPlan.juz = finalPlan.juz ?? 1;
    }

    const validationError = validateListenPlan(finalPlan, mushafData, totalPages);
    if (validationError) {
      setError(validationError);
      return;
    }

    const session = buildListenSession(finalPlan, mushafData);
    if (!session) {
      setError("تعذر تجهيز قائمة الاستماع");
      return;
    }

    setStarting(true);
    try {
      await playback.startListening(session);
      onOpenChange(false);
    } finally {
      setStarting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] max-w-md flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-4 py-4 text-start">
          <DialogTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-primary" />
            خيارات الاستماع
          </DialogTitle>
          <DialogDescription>
            اختر ما تريد سماعه وعدد مرات التكرار
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4 grid h-auto w-full grid-cols-4 gap-1 p-1">
              <TabsTrigger value="surah" className="text-xs sm:text-sm">
                سورة
              </TabsTrigger>
              <TabsTrigger value="juz" className="text-xs sm:text-sm">
                جزء
              </TabsTrigger>
              <TabsTrigger value="page" className="text-xs sm:text-sm">
                صفحة
              </TabsTrigger>
              <TabsTrigger value="ayah" className="text-xs sm:text-sm">
                آية
              </TabsTrigger>
            </TabsList>

            <TabsContent value="surah" className="mt-0 space-y-3">
              <Input
                placeholder="ابحث عن السورة..."
                value={surahSearch}
                onChange={(e) => setSurahSearch(e.target.value)}
              />
              <div className="max-h-44 overflow-y-auto rounded-lg border border-border">
                {filteredSurahs.map(({ name, number }) => (
                  <button
                    key={number}
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-muted",
                      plan.surah === number && "bg-primary/10 text-primary",
                    )}
                    onClick={() =>
                      setPlan((prev) => ({
                        ...prev,
                        surah: number,
                        ayah: 1,
                      }))
                    }
                  >
                    <span>
                      {toArabicNumerals(number)}. {name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatAyahCount(getSurahAyahCount(mushafData, number), {
                        arabicNumerals: false,
                      })}
                    </span>
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <Label htmlFor="surah-start-ayah">من الآية (اختياري)</Label>
                <Input
                  id="surah-start-ayah"
                  inputMode="numeric"
                  placeholder="١ = من البداية"
                  value={plan.ayah && plan.ayah > 1 ? String(plan.ayah) : ""}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    setPlan((prev) => ({
                      ...prev,
                      ayah: value ? Number.parseInt(value, 10) : 1,
                    }));
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="juz" className="mt-0 space-y-3">
              <div className="grid max-h-52 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                {JUZ_NAMES.map((name, index) => {
                  const juz = index + 1;
                  return (
                    <button
                      key={juz}
                      type="button"
                      className={cn(
                        "rounded-lg border px-2 py-2 text-start text-xs transition-colors hover:bg-muted",
                        plan.juz === juz &&
                          "border-primary bg-primary/10 text-primary",
                      )}
                      onClick={() => setPlan((prev) => ({ ...prev, juz }))}
                    >
                      <span className="block font-semibold">
                        {toArabicNumerals(juz)}
                      </span>
                      <span className="line-clamp-2 text-muted-foreground">
                        {name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="page" className="mt-0 space-y-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={!pageRangeMode ? "default" : "outline"}
                  onClick={() => setPageRangeMode(false)}
                >
                  صفحة واحدة
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={pageRangeMode ? "default" : "outline"}
                  onClick={() => setPageRangeMode(true)}
                >
                  نطاق صفحات
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{pageRangeMode ? "من صفحة" : "رقم الصفحة"}</Label>
                  <Input
                    inputMode="numeric"
                    value={plan.page ? String(plan.page) : ""}
                    onChange={(e) => {
                      const page = Number.parseInt(
                        e.target.value.replace(/\D/g, ""),
                        10,
                      );
                      setPlan((prev) => ({
                        ...prev,
                        page: Number.isFinite(page) ? page : undefined,
                      }));
                    }}
                  />
                </div>
                {pageRangeMode && (
                  <div className="space-y-2">
                    <Label>إلى صفحة</Label>
                    <Input
                      inputMode="numeric"
                      value={plan.endPage ? String(plan.endPage) : ""}
                      onChange={(e) => {
                        const endPage = Number.parseInt(
                          e.target.value.replace(/\D/g, ""),
                          10,
                        );
                        setPlan((prev) => ({
                          ...prev,
                          endPage: Number.isFinite(endPage) ? endPage : undefined,
                        }));
                      }}
                    />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                المجموع {toArabicNumerals(totalPages)} صفحة في المصحف
              </p>
            </TabsContent>

            <TabsContent value="ayah" className="mt-0 space-y-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={!ayahRangeMode ? "default" : "outline"}
                  onClick={() => setAyahRangeMode(false)}
                >
                  آية واحدة
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={ayahRangeMode ? "default" : "outline"}
                  onClick={() => setAyahRangeMode(true)}
                >
                  نطاق آيات
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>سورة</Label>
                  <Input
                    inputMode="numeric"
                    value={plan.surah ? String(plan.surah) : ""}
                    onChange={(e) => {
                      const surah = Number.parseInt(
                        e.target.value.replace(/\D/g, ""),
                        10,
                      );
                      setPlan((prev) => ({
                        ...prev,
                        surah: Number.isFinite(surah) ? surah : undefined,
                      }));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{ayahRangeMode ? "من آية" : "آية"}</Label>
                  <Input
                    inputMode="numeric"
                    value={plan.ayah ? String(plan.ayah) : ""}
                    onChange={(e) => {
                      const ayah = Number.parseInt(
                        e.target.value.replace(/\D/g, ""),
                        10,
                      );
                      setPlan((prev) => ({
                        ...prev,
                        ayah: Number.isFinite(ayah) ? ayah : undefined,
                      }));
                    }}
                  />
                </div>
              </div>
              {ayahRangeMode && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>إلى سورة</Label>
                    <Input
                      inputMode="numeric"
                      value={plan.endSurah ? String(plan.endSurah) : ""}
                      onChange={(e) => {
                        const endSurah = Number.parseInt(
                          e.target.value.replace(/\D/g, ""),
                          10,
                        );
                        setPlan((prev) => ({
                          ...prev,
                          endSurah: Number.isFinite(endSurah)
                            ? endSurah
                            : undefined,
                        }));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>إلى آية</Label>
                    <Input
                      inputMode="numeric"
                      value={plan.endAyah ? String(plan.endAyah) : ""}
                      onChange={(e) => {
                        const endAyah = Number.parseInt(
                          e.target.value.replace(/\D/g, ""),
                          10,
                        );
                        setPlan((prev) => ({
                          ...prev,
                          endAyah: Number.isFinite(endAyah) ? endAyah : undefined,
                        }));
                      }}
                    />
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="mt-5 space-y-2 border-t border-border pt-4">
            <Label>التكرار</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={plan.repeatMode === "none" ? "default" : "outline"}
                onClick={() => setRepeat("none", 1)}
              >
                بدون
              </Button>
              {REPEAT_PRESETS.map((count) => (
                <Button
                  key={count}
                  type="button"
                  size="sm"
                  variant={
                    plan.repeatMode === "count" && plan.repeatCount === count
                      ? "default"
                      : "outline"
                  }
                  onClick={() => setRepeat("count", count)}
                >
                  {toArabicNumerals(count)}×
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant={
                  plan.repeatMode === "infinite" ? "default" : "outline"
                }
                onClick={() => setRepeat("infinite", 1)}
                className="gap-1"
              >
                <Infinity className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {tab === "ayah" && !ayahRangeMode
                ? "يُكرّر الآية المحددة"
                : "يُكرّر النطاق كاملاً ثم يعيد من البداية"}
            </p>
          </div>

          {error && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="border-t px-4 py-3">
          <Button
            className="w-full gap-2 sm:w-auto"
            onClick={() => void handleStart()}
            disabled={starting}
          >
            <Volume2 className="h-4 w-4" />
            {starting ? "جاري التشغيل…" : "ابدأ الاستماع"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
