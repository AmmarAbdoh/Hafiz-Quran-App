import { useEffect, useState } from "react";
import { ChevronDown, Infinity, Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber, useLocale } from "@/app/i18n";
import { useQuranPlaybackActions } from "@/features/quran-reader/context/QuranPlaybackContext";
import type {
  ListenPlan,
  ListenPreset,
  ListenScopeType,
  RepeatMode,
  ListenPlanValidationError,
} from "@/features/quran-reader/model/listenPlanTypes";
import {
  buildListenSession,
  defaultPlanFromPreset,
  validateListenPlan,
} from "@/features/quran-reader/model/listenPlan";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import { JUZ_NAMES, searchSurahNumbers, useSurahNames } from "@/domain/quran";
import { cn } from "@/shared/lib/utils";
import { getSurahAyahCount } from "@/domain/quran";
import type { MushafVerse } from "@/domain/quran";

interface ListenOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mushafData: MushafVerse[];
  totalPages: number;
  preset?: ListenPreset | null;
  /** Where the reader is, so listening can start there without being asked. */
  currentPage: number;
  currentSurah: number;
  layoutMode: "page" | "surah";
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
  currentPage,
  currentSurah,
  layoutMode,
}: ListenOptionsDialogProps) {
  const { t } = useTranslation("reader");
  const { t: tCommon } = useTranslation("common");
  const { locale } = useLocale();
  const { names: surahNames, language: surahLanguage } = useSurahNames();
  const { startListening } = useQuranPlaybackActions();
  const [tab, setTab] = useState("surah");
  const [plan, setPlan] = useState<ListenPlan>(() =>
    defaultPlanFromPreset(preset),
  );
  const [ayahRangeMode, setAyahRangeMode] = useState(false);
  const [pageRangeMode, setPageRangeMode] = useState(false);
  const [surahSearch, setSurahSearch] = useState("");
  const [error, setError] = useState<
    ListenPlanValidationError | "buildFailed" | "startFailed" | null
  >(null);
  const [starting, setStarting] = useState(false);
  /*
   * Four tabs, six numeric inputs, a 114-row list and a 30-cell juz grid stood
   * between the reader and hearing anything, while three simpler audio paths
   * already existed elsewhere. Almost always the answer is "what is in front
   * of me", so that is the offer; the rest is still here, one tap away.
   */
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next = defaultPlanFromPreset(preset);
    setPlan(next);
    setTab(scopeToTab(next.scope));
    setAyahRangeMode(next.scope === "ayah-range");
    setPageRangeMode(next.scope === "page-range");
    setSurahSearch("");
    setError(null);
    // A preset names what to play, so it is already a decision - open on the
    // options only when it asked for something the quick action cannot say.
    setShowOptions(false);
  }, [open, preset]);

  const surahMatches = searchSurahNumbers(surahSearch);
  const filteredSurahs = surahNames
    .map((name, index) => ({ name, number: index + 1 }))
    .filter(
      ({ number }) => surahMatches === null || surahMatches.includes(number),
    )
    .sort((left, right) =>
      surahMatches === null
        ? 0
        : surahMatches.indexOf(left.number) -
          surahMatches.indexOf(right.number),
    );

  const setRepeat = (repeatMode: RepeatMode, repeatCount = 1) => {
    setPlan((prev) => ({ ...prev, repeatMode, repeatCount }));
    setError(null);
  };

  const runPlan = async (finalPlan: ListenPlan) => {
    const validationError = validateListenPlan(
      finalPlan,
      mushafData,
      totalPages,
    );
    if (validationError) {
      setError(validationError);
      setShowOptions(true);
      return;
    }

    const session = buildListenSession(finalPlan, mushafData);
    if (!session) {
      setError("buildFailed");
      setShowOptions(true);
      return;
    }

    setStarting(true);
    try {
      await startListening(session);
      onOpenChange(false);
    } catch {
      setError("startFailed");
    } finally {
      setStarting(false);
    }
  };

  /** What is in front of the reader right now, as a plan. */
  const quickPlan: ListenPlan =
    preset?.scope === "surah" && preset.surah
      ? {
          scope: "surah",
          surah: preset.surah,
          ayah: 1,
          repeatMode: "none",
          repeatCount: 1,
        }
      : layoutMode === "surah"
        ? {
            scope: "surah",
            surah: currentSurah,
            ayah: 1,
            repeatMode: "none",
            repeatCount: 1,
          }
        : {
            scope: "page",
            page: currentPage,
            endPage: currentPage,
            repeatMode: "none",
            repeatCount: 1,
          };

  const quickIsSurah = quickPlan.scope === "surah";
  const quickLabel = quickIsSurah
    ? t("listenDialog.playHere.surah")
    : t("listenDialog.playHere.page");
  const quickHint = quickIsSurah
    ? t("listenDialog.playHere.surahHint", {
        surahName: surahNames[(quickPlan.surah ?? 1) - 1] ?? "",
      })
    : t("listenDialog.playHere.pageHint", {
        page: formatNumber(quickPlan.page ?? 1, locale),
      });

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

    await runPlan(finalPlan);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={tCommon("actions.close")}
        className="flex max-h-[min(90vh,720px)] max-w-md flex-col gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="border-b px-4 py-4 text-start">
          <DialogTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-primary" aria-hidden />
            {t("listenDialog.title")}
          </DialogTitle>
          <DialogDescription>{t("listenDialog.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Play first, configure only if that is not what was wanted. */}
          <Button
            type="button"
            size="lg"
            className="w-full justify-start gap-3 text-start"
            disabled={starting}
            onClick={() => void runPlan(quickPlan)}
          >
            <Volume2 className="h-5 w-5 shrink-0" aria-hidden />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-semibold">{quickLabel}</span>
              <span className="truncate text-label font-normal opacity-90">
                {quickHint}
              </span>
            </span>
          </Button>

          <button
            type="button"
            aria-expanded={showOptions}
            aria-controls="listen-more-options"
            onClick={() => setShowOptions((open) => !open)}
            className="mt-4 flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-3 text-start transition-colors duration-fast ease-standard hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-semibold">
                {t("listenDialog.moreOptions")}
              </span>
              <span className="truncate text-label text-muted-foreground">
                {t("listenDialog.moreOptionsHint")}
              </span>
            </span>
            <ChevronDown
              aria-hidden
              className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-fast ease-standard",
                showOptions && "rotate-180",
              )}
            />
          </button>

          <div id="listen-more-options" hidden={!showOptions} className="mt-4">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="mb-4 grid h-auto w-full grid-cols-4 gap-1 p-1">
                <TabsTrigger
                  value="surah"
                  className="min-h-11 text-label sm:text-sm"
                >
                  {t("listenDialog.tabs.surah")}
                </TabsTrigger>
                <TabsTrigger
                  value="juz"
                  className="min-h-11 text-label sm:text-sm"
                >
                  {t("listenDialog.tabs.juz")}
                </TabsTrigger>
                <TabsTrigger
                  value="page"
                  className="min-h-11 text-label sm:text-sm"
                >
                  {t("listenDialog.tabs.page")}
                </TabsTrigger>
                <TabsTrigger
                  value="ayah"
                  className="min-h-11 text-label sm:text-sm"
                >
                  {t("listenDialog.tabs.ayah")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="surah" className="mt-0 space-y-3">
                <Input
                  dir="auto"
                  aria-label={t("listenDialog.searchSurah")}
                  placeholder={t("listenDialog.searchSurah")}
                  value={surahSearch}
                  onChange={(e) => setSurahSearch(e.target.value)}
                />
                <div className="max-h-44 overflow-y-auto rounded-lg border border-border">
                  {filteredSurahs.length === 0 && (
                    <p
                      className="px-3 py-6 text-center text-sm text-muted-foreground"
                      role="status"
                    >
                      {t("navigation.noSurahs")}
                    </p>
                  )}
                  {filteredSurahs.map(({ name, number }) => (
                    <button
                      key={number}
                      type="button"
                      className={cn(
                        "flex min-h-11 w-full items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-muted",
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
                      <span
                        dir={surahLanguage === "ar" ? "rtl" : "ltr"}
                        lang={surahLanguage}
                      >
                        <bdi>{formatNumber(number, locale)}</bdi>. {name}
                      </span>
                      <span className="text-label text-muted-foreground">
                        {t("metadata.ayahCount", {
                          count: getSurahAyahCount(mushafData, number),
                          formattedCount: formatNumber(
                            getSurahAyahCount(mushafData, number),
                            locale,
                          ),
                        })}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="surah-start-ayah">
                    {t("listenDialog.startAyah")}
                  </Label>
                  <Input
                    id="surah-start-ayah"
                    inputMode="numeric"
                    className="min-h-11"
                    placeholder={t("listenDialog.startAyahHint")}
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
                          "min-h-11 rounded-lg border px-2 py-2 text-start text-label transition-colors hover:bg-muted",
                          plan.juz === juz &&
                            "border-primary bg-primary/10 text-primary",
                        )}
                        onClick={() => setPlan((prev) => ({ ...prev, juz }))}
                      >
                        <span className="block font-semibold">
                          {formatNumber(juz, locale)}
                        </span>
                        <span
                          className="line-clamp-2 text-muted-foreground"
                          dir="rtl"
                          lang="ar"
                        >
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
                    {t("listenDialog.onePage")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={pageRangeMode ? "default" : "outline"}
                    onClick={() => setPageRangeMode(true)}
                  >
                    {t("listenDialog.pageRange")}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="listen-start-page">
                      {pageRangeMode
                        ? t("listenDialog.fromPage")
                        : t("listenDialog.pageNumber")}
                    </Label>
                    <Input
                      id="listen-start-page"
                      inputMode="numeric"
                      className="min-h-11"
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
                      <Label htmlFor="listen-end-page">
                        {t("listenDialog.toPage")}
                      </Label>
                      <Input
                        id="listen-end-page"
                        inputMode="numeric"
                        className="min-h-11"
                        value={plan.endPage ? String(plan.endPage) : ""}
                        onChange={(e) => {
                          const endPage = Number.parseInt(
                            e.target.value.replace(/\D/g, ""),
                            10,
                          );
                          setPlan((prev) => ({
                            ...prev,
                            endPage: Number.isFinite(endPage)
                              ? endPage
                              : undefined,
                          }));
                        }}
                      />
                    </div>
                  )}
                </div>
                <p className="text-label text-muted-foreground">
                  {t("listenDialog.totalPages", {
                    count: totalPages,
                    formattedCount: formatNumber(totalPages, locale),
                  })}
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
                    {t("listenDialog.oneAyah")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={ayahRangeMode ? "default" : "outline"}
                    onClick={() => setAyahRangeMode(true)}
                  >
                    {t("listenDialog.ayahRange")}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="listen-start-surah">
                      {t("listenDialog.surah")}
                    </Label>
                    <Input
                      id="listen-start-surah"
                      inputMode="numeric"
                      className="min-h-11"
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
                    <Label htmlFor="listen-start-ayah">
                      {ayahRangeMode
                        ? t("listenDialog.fromAyah")
                        : t("listenDialog.ayah")}
                    </Label>
                    <Input
                      id="listen-start-ayah"
                      inputMode="numeric"
                      className="min-h-11"
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
                      <Label htmlFor="listen-end-surah">
                        {t("listenDialog.toSurah")}
                      </Label>
                      <Input
                        id="listen-end-surah"
                        inputMode="numeric"
                        className="min-h-11"
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
                      <Label htmlFor="listen-end-ayah">
                        {t("listenDialog.toAyah")}
                      </Label>
                      <Input
                        id="listen-end-ayah"
                        inputMode="numeric"
                        className="min-h-11"
                        value={plan.endAyah ? String(plan.endAyah) : ""}
                        onChange={(e) => {
                          const endAyah = Number.parseInt(
                            e.target.value.replace(/\D/g, ""),
                            10,
                          );
                          setPlan((prev) => ({
                            ...prev,
                            endAyah: Number.isFinite(endAyah)
                              ? endAyah
                              : undefined,
                          }));
                        }}
                      />
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="mt-5 space-y-2 border-t border-border pt-4">
              <Label>{t("listenDialog.repeat")}</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={plan.repeatMode === "none" ? "default" : "outline"}
                  onClick={() => setRepeat("none", 1)}
                >
                  {t("listenDialog.noRepeat")}
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
                    {formatNumber(count, locale)}×
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant={
                    plan.repeatMode === "infinite" ? "default" : "outline"
                  }
                  onClick={() => setRepeat("infinite", 1)}
                  className="min-h-11 min-w-11 gap-1"
                  aria-label={t("listenDialog.infiniteRepeat")}
                  title={t("listenDialog.infiniteRepeat")}
                >
                  <Infinity className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              <p className="text-label text-muted-foreground">
                {tab === "ayah" && !ayahRangeMode
                  ? t("listenDialog.repeatAyah")
                  : t("listenDialog.repeatRange")}
              </p>
            </div>
          </div>

          {error && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {t(`listenDialog.errors.${error}`)}
            </p>
          )}
        </div>

        {/* Only the configured plan needs its own start; the quick action is
            its own button and would otherwise be two buttons for one tap. */}
        {showOptions && (
          <DialogFooter className="border-t px-4 py-3">
            <Button
              className="w-full gap-2 sm:w-auto"
              onClick={() => void handleStart()}
              disabled={starting}
            >
              <Volume2 className="h-4 w-4" aria-hidden />
              <span aria-live="polite">
                {starting
                  ? t("listenDialog.starting")
                  : t("listenDialog.start")}
              </span>
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
