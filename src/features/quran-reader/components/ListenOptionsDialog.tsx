import { useEffect, useState } from "react";
import { Infinity, Volume2 } from "lucide-react";
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
import { JUZ_NAMES, SURAH_NAMES } from "@/domain/quran";
import { cn } from "@/shared/lib/utils";
import { getSurahAyahCount } from "@/domain/quran";
import type { MushafVerse } from "@/domain/quran";

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
  const { t } = useTranslation("reader");
  const { t: tCommon } = useTranslation("common");
  const { locale } = useLocale();
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

  useEffect(() => {
    if (!open) return;
    const next = defaultPlanFromPreset(preset);
    setPlan(next);
    setTab(scopeToTab(next.scope));
    setAyahRangeMode(next.scope === "ayah-range");
    setPageRangeMode(next.scope === "page-range");
    setSurahSearch("");
    setError(null);
  }, [open, preset]);

  const filteredSurahs = SURAH_NAMES.map((name, index) => ({
    name,
    number: index + 1,
  })).filter(({ name }) => name.includes(surahSearch));

  const setRepeat = (repeatMode: RepeatMode, repeatCount = 1) => {
    setPlan((prev) => ({ ...prev, repeatMode, repeatCount }));
    setError(null);
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

    const validationError = validateListenPlan(
      finalPlan,
      mushafData,
      totalPages,
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    const session = buildListenSession(finalPlan, mushafData);
    if (!session) {
      setError("buildFailed");
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
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4 grid h-auto w-full grid-cols-4 gap-1 p-1">
              <TabsTrigger
                value="surah"
                className="min-h-11 text-xs sm:text-sm"
              >
                {t("listenDialog.tabs.surah")}
              </TabsTrigger>
              <TabsTrigger value="juz" className="min-h-11 text-xs sm:text-sm">
                {t("listenDialog.tabs.juz")}
              </TabsTrigger>
              <TabsTrigger value="page" className="min-h-11 text-xs sm:text-sm">
                {t("listenDialog.tabs.page")}
              </TabsTrigger>
              <TabsTrigger value="ayah" className="min-h-11 text-xs sm:text-sm">
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
                    <span dir="rtl" lang="ar">
                      <bdi>{formatNumber(number, locale)}</bdi>. {name}
                    </span>
                    <span className="text-xs text-muted-foreground">
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
                        "min-h-11 rounded-lg border px-2 py-2 text-start text-xs transition-colors hover:bg-muted",
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
                  className="min-h-11"
                  onClick={() => setPageRangeMode(false)}
                >
                  {t("listenDialog.onePage")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={pageRangeMode ? "default" : "outline"}
                  className="min-h-11"
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
              <p className="text-xs text-muted-foreground">
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
                  className="min-h-11"
                  onClick={() => setAyahRangeMode(false)}
                >
                  {t("listenDialog.oneAyah")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={ayahRangeMode ? "default" : "outline"}
                  className="min-h-11"
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
                className="min-h-11"
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
                  className="min-h-11"
                  onClick={() => setRepeat("count", count)}
                >
                  {formatNumber(count, locale)}×
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant={plan.repeatMode === "infinite" ? "default" : "outline"}
                onClick={() => setRepeat("infinite", 1)}
                className="min-h-11 min-w-11 gap-1"
                aria-label={t("listenDialog.infiniteRepeat")}
                title={t("listenDialog.infiniteRepeat")}
              >
                <Infinity className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {tab === "ayah" && !ayahRangeMode
                ? t("listenDialog.repeatAyah")
                : t("listenDialog.repeatRange")}
            </p>
          </div>

          {error && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {t(`listenDialog.errors.${error}`)}
            </p>
          )}
        </div>

        <DialogFooter className="border-t px-4 py-3">
          <Button
            className="min-h-11 w-full gap-2 sm:w-auto"
            onClick={() => void handleStart()}
            disabled={starting}
          >
            <Volume2 className="h-4 w-4" aria-hidden />
            <span aria-live="polite">
              {starting ? t("listenDialog.starting") : t("listenDialog.start")}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
