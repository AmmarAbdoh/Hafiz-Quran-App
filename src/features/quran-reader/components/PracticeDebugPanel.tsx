/*
 * What the recogniser heard, and what the microphone is really sending.
 *
 * Two questions a reciter cannot tell apart from the page alone: "did it hear
 * me at all" and "did it hear me *right*". A level meter answers neither - it
 * moves whether the audio is usable or clipped into mush, and it says nothing
 * about which phonemes came out.
 *
 * So this shows both sides: what was heard, and beside it what the page
 * expects at the cursor, which is what turns a list of sounds into an
 * answer. Both are written as Arabic letters, as the summary writes them,
 * and what was heard is split into words where the cursor moved on: in the
 * model's phonetic alphabet, a sound at a time, nobody could read it. The
 * symbol itself is kept on each sound, with how sure the model was, for
 * the one thing letters lose - how long a madd was held.
 */
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import {
  PRACTICE_SAMPLE_RATE,
  phonemesAsLetters,
  useRecitationPracticeTelemetry,
} from "@/features/recitation-practice";
import { formatNumber, useLocale } from "@/app/i18n";

/** Below this a phoneme is the model's doubt rather than the reciter's word. */
const UNSURE_BELOW = 0.45;

/** Above this share of clipped samples the microphone is turned up too far. */
const CLIPPING_CONCERN = 0.001;

function Row({
  label,
  arabic = false,
  children,
}: {
  label: string;
  /** Words to read, so set as text rather than as a code readout. */
  arabic?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span
        className={
          arabic
            ? "text-end text-base leading-relaxed"
            : "text-end font-mono text-label break-all"
        }
      >
        {children}
      </span>
    </div>
  );
}

export function PracticeDebugPanel() {
  const { t } = useTranslation("reader");
  const { locale } = useLocale();
  const { heard, expected, mic, micLevel } = useRecitationPracticeTelemetry();
  /* One decimal place, with the sign the locale uses. */
  const percent = (share: number) =>
    `${formatNumber(Math.round(share * 1000) / 10, locale)}${
      locale === "ar" ? "٪" : "%"
    }`;

  return (
    <div
      className="bg-muted/40 text-foreground/90 mt-2 space-y-2 rounded-lg p-3 text-sm"
      /* A diagnostic readout, not part of the reading flow. */
      role="status"
      aria-live="off"
      aria-label={t("practice.debugTitle")}
    >
      <p className="text-muted-foreground text-label">
        {t("practice.debugHint")}
      </p>

      {/* Arabic in either locale, and in the order the model emitted it.
          Each sound is its own span so a doubtful one can be dimmed; the
          letters still join across them. */}
      <Row label={t("practice.debugHeard")} arabic={heard.length > 0}>
        {heard.length === 0 ? (
          <span className="text-muted-foreground">
            {t("practice.debugNothingYet")}
          </span>
        ) : (
          <span dir="rtl" lang="ar">
            {heard.map((phoneme, index) => (
              <Fragment key={`${index}-${phoneme.symbol}`}>
                <span
                  className={
                    phoneme.confidence < UNSURE_BELOW
                      ? "text-muted-foreground"
                      : undefined
                  }
                  title={`${phoneme.symbol} · ${Math.round(phoneme.confidence * 100)}%`}
                >
                  {phonemesAsLetters([phoneme.symbol])}
                </span>
                {phoneme.endsWord ? " " : null}
              </Fragment>
            ))}
          </span>
        )}
      </Row>

      <Row label={t("practice.debugExpected")} arabic={expected.length > 0}>
        {expected.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span dir="rtl" lang="ar" title={expected.join(" ")}>
            {phonemesAsLetters(expected)}
          </span>
        )}
      </Row>

      <Row label={t("practice.debugLevel")}>
        {percent(micLevel)}
        {mic ? ` · ${t("practice.debugPeak")} ${percent(mic.peak)}` : ""}
      </Row>

      {mic && (
        <>
          <Row label={t("practice.debugAccepted")}>
            {percent(mic.acceptedShare)} · {formatNumber(mic.blocks, locale)}{" "}
            {t("practice.debugBlocks")}
          </Row>
          <Row label={t("practice.debugClipped")}>
            <span
              className={
                mic.clippedShare > CLIPPING_CONCERN
                  ? "text-destructive"
                  : undefined
              }
            >
              {percent(mic.clippedShare)}
            </span>
          </Row>
          <Row label={t("practice.debugRate")}>
            <span
              className={
                mic.contextSampleRate !== PRACTICE_SAMPLE_RATE
                  ? "text-destructive"
                  : undefined
              }
            >
              {formatNumber(mic.contextSampleRate, locale)}
            </span>
          </Row>
          {mic.deviceLabel && (
            <Row label={t("practice.debugDevice")}>{mic.deviceLabel}</Row>
          )}
        </>
      )}
    </div>
  );
}
