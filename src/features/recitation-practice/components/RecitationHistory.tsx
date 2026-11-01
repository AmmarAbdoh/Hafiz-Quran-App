import { useEffect, useId, useRef, useState } from "react";
import { Download, Headphones, Trash2, Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDate, formatNumber, useLocale } from "@/app/i18n";
import { useSurahNames } from "@/domain/quran";
import { usePracticeKeepRecordings } from "@/features/recitation-practice/hooks/usePracticeKeepRecordings";
import { useRecordingPlayer } from "@/features/recitation-practice/hooks/useRecordingPlayer";
import {
  formatDuration,
  RecordingPlayer,
} from "@/features/recitation-practice/components/RecordingPlayer";
import {
  MissedMistakeToggle,
  WordFeedbackChoice,
} from "@/features/recitation-practice/components/VerdictFeedback";
import {
  deleteAllRecitations,
  deleteRecitation,
  exportRecitation,
  KEEP_RECITATIONS,
  listRecitations,
  recitationAudio,
  updateRecitationFeedback,
  type RecitationFeedback,
  withWordFeedback,
  type SavedRecitation,
} from "@/features/recitation-practice/services/recitationHistory";
import { Panel } from "@/shared/components/Panel";
import { Switch } from "@/shared/components/Switch";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";

/**
 * The recitations kept on this device, to listen back to.
 *
 * Settings rather than the reader, because it is about what the device holds:
 * the switch that decides whether runs are kept at all, the runs themselves,
 * and the way to remove them. The summary after a run plays that run; this is
 * for going back to one later.
 */
export function RecitationHistory() {
  const { t } = useTranslation("settings");
  const { locale } = useLocale();
  const { surahName, language } = useSurahNames();
  const nameDir = language === "ar" ? "rtl" : "ltr";
  const titleId = useId();
  const keepId = useId();
  const { keepRecordings, setKeepRecordings } = usePracticeKeepRecordings();
  const [entries, setEntries] = useState(listRecitations);
  /* The one being listened to; `url` is null when its audio is gone. */
  const [open, setOpen] = useState<{ id: string; url: string | null } | null>(
    null,
  );
  /* Only the newest request may open a recording: the audio is read
     asynchronously, and tapping two in a row must not show the first. */
  const requestRef = useRef(0);
  /* The run whose export just failed, and why, said beside that run. */
  const [exportFailed, setExportFailed] = useState<{
    id: string;
    reason: "unavailable" | "failed";
  } | null>(null);
  const player = useRecordingPlayer(
    open?.url ?? null,
    entries.find((entry) => entry.id === open?.id)?.seconds,
  );

  /* The blob URL is a browser resource; let it go with the recording. */
  useEffect(
    () => () => {
      if (open?.url) URL.revokeObjectURL(open.url);
    },
    [open],
  );

  const toggle = async (id: string) => {
    const request = ++requestRef.current;
    if (open?.id === id) {
      setOpen(null);
      return;
    }
    const audio = await recitationAudio(id);
    if (request !== requestRef.current) return;
    setOpen({ id, url: audio ? URL.createObjectURL(audio) : null });
  };

  const remove = async (id: string) => {
    if (open?.id === id) setOpen(null);
    await deleteRecitation(id);
    setEntries(listRecitations());
  };

  const answer = (
    id: string,
    change: (current: RecitationFeedback) => RecitationFeedback,
  ) => {
    updateRecitationFeedback(id, change);
    setEntries(listRecitations());
  };

  /*
   * Saved as a file the reader can send on. Nothing is uploaded: sharing a
   * recording of their voice is theirs to do, not the app's.
   *
   * The link is put in the page to be clicked, which some browsers require,
   * and the file's URL is kept a while after: Safari starts the download
   * after the click returns, and revoking it at once saved nothing.
   */
  const download = async (id: string) => {
    setExportFailed(null);
    let file: Blob | null;
    try {
      file = await exportRecitation(id);
    } catch {
      setExportFailed({ id, reason: "failed" });
      return;
    }
    if (!file) {
      setExportFailed({ id, reason: "unavailable" });
      return;
    }
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `artqiy-recitation-${id.replace(/[:.]/g, "-")}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 40_000);
  };

  const removeAll = async () => {
    setOpen(null);
    await deleteAllRecitations();
    setEntries([]);
  };

  const describe = (entry: SavedRecitation) => {
    const [fromSurah, fromAyah] = entry.from.split(":").map(Number);
    const [toSurah, toAyah] = entry.to.split(":").map(Number);
    if (!fromSurah || !fromAyah || !toSurah || !toAyah) return "";
    const number = (value: number) => formatNumber(value, locale);
    if (fromSurah !== toSurah) {
      return t("recordings.across", {
        fromSurah: surahName(fromSurah),
        from: number(fromAyah),
        toSurah: surahName(toSurah),
        to: number(toAyah),
      });
    }
    return fromAyah === toAyah
      ? t("recordings.single", {
          surah: surahName(fromSurah),
          ayah: number(fromAyah),
        })
      : t("recordings.range", {
          surah: surahName(fromSurah),
          from: number(fromAyah),
          to: number(toAyah),
        });
  };

  return (
    <Panel
      as="section"
      variant="flush"
      className="overflow-hidden"
      aria-labelledby={titleId}
    >
      <header className="flex items-start gap-4 border-b border-border/80 px-5 py-5 sm:px-6">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Headphones aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2 id={titleId}>{t("recordings.title")}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {t("recordings.description")}
          </p>
        </div>
      </header>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor={keepId}>{t("recordings.keepLabel")}</Label>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t("recordings.keepHint", {
                number: formatNumber(KEEP_RECITATIONS, locale),
              })}
            </p>
          </div>
          <Switch
            id={keepId}
            pressed={keepRecordings}
            onPressedChange={setKeepRecordings}
            aria-label={t("recordings.keepLabel")}
          />
        </div>

        {entries.length === 0 ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {t("recordings.empty")}
          </p>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => {
              const label = describe(entry);
              const isOpen = open?.id === entry.id;
              const rowTitleId = `${titleId}-${entry.id}`;
              return (
                <li
                  key={entry.id}
                  className="space-y-3 rounded-lg border border-border p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <p id={rowTitleId} className="font-semibold">
                        <bdi dir={nameDir}>{label}</bdi>
                      </p>
                      <p className="text-label text-muted-foreground">
                        {formatDate(new Date(entry.recordedAt), locale, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                        {" · "}
                        <span className="tabular-nums">
                          {formatDuration(entry.seconds, locale)}
                        </span>
                      </p>
                      <p className="text-label text-muted-foreground">
                        {entry.words.length > 0
                          ? t("recordings.toReview", {
                              words: formatNumber(entry.words.length, locale),
                            })
                          : t("recordings.clean")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        aria-expanded={isOpen}
                        aria-describedby={rowTitleId}
                        onClick={() => void toggle(entry.id)}
                      >
                        {isOpen ? t("recordings.hide") : t("recordings.listen")}
                      </Button>
                      {/* Not offered once the run is known to have no
                          audio: there would be nothing to send. */}
                      {!(isOpen && !open.url) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t("recordings.exportLabel", { label })}
                          onClick={() => void download(entry.id)}
                        >
                          <Download className="h-4 w-4" aria-hidden />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("recordings.deleteLabel", { label })}
                        onClick={() => void remove(entry.id)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </div>

                  {exportFailed?.id === entry.id && (
                    <p aria-live="polite" className="text-sm text-destructive">
                      {exportFailed.reason === "unavailable"
                        ? t("recordings.unavailable")
                        : t("recordings.exportFailed")}
                    </p>
                  )}

                  {isOpen &&
                    (open.url ? (
                      <div className="space-y-2">
                        <RecordingPlayer player={player} label={label} />
                        {entry.words.length > 0 && (
                          <ul className="space-y-1">
                            {entry.words.map((word) => (
                              <li
                                key={word.location}
                                className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2 odd:bg-surface-sunken"
                              >
                                <div className="min-w-0 space-y-1.5">
                                  <bdi
                                    dir="rtl"
                                    lang="ar"
                                    className="block truncate text-body"
                                  >
                                    {word.text}
                                  </bdi>
                                  <WordFeedbackChoice
                                    word={word.text}
                                    value={entry.feedback?.words[word.location]}
                                    onChange={(value) =>
                                      answer(entry.id, (current) =>
                                        withWordFeedback(
                                          current,
                                          word.location,
                                          value,
                                        ),
                                      )
                                    }
                                  />
                                </div>
                                {word.moment && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t("recordings.listenTo", {
                                      word: word.text,
                                    })}
                                    onClick={() =>
                                      player.playMoment(word.moment!)
                                    }
                                  >
                                    <Volume2 className="h-4 w-4" aria-hidden />
                                  </Button>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                        <MissedMistakeToggle
                          pressed={entry.feedback?.missedMistake ?? false}
                          onPressedChange={(missedMistake) =>
                            answer(entry.id, (current) => ({
                              ...current,
                              missedMistake,
                            }))
                          }
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t("recordings.unavailable")}
                      </p>
                    ))}
                </li>
              );
            })}
          </ul>
        )}

        {entries.length > 0 && (
          <p className="text-sm leading-6 text-muted-foreground">
            {t("recordings.exportHint")}
          </p>
        )}

        {entries.length > 0 && (
          <Button
            size="lg"
            type="button"
            variant="outline"
            className="w-full justify-between"
            onClick={() => void removeAll()}
          >
            {t("recordings.deleteAll")}
            <Trash2 aria-hidden="true" />
          </Button>
        )}
      </div>
    </Panel>
  );
}
