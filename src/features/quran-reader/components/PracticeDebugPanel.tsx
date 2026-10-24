/*
 * What the recogniser heard, and what the microphone is really sending.
 *
 * Two questions a reciter cannot tell apart from the page alone: "did it hear
 * me at all" and "did it hear me *right*". A level meter answers neither - it
 * moves whether the audio is usable or clipped into mush, and it says nothing
 * about which phonemes came out.
 *
 * So this shows both sides. The heard phonemes are in the model's own
 * phonetic alphabet, which is deliberately not translated: it is what the
 * recogniser emitted, and prettifying it would hide the thing being
 * diagnosed. Beside them sits what the page expects at the cursor, which is
 * what turns a list of symbols into an answer.
 */
import { useTranslation } from "react-i18next";
import {
  PRACTICE_SAMPLE_RATE,
  useRecitationPracticeTelemetry,
} from "@/features/recitation-practice";
import { formatNumber, useLocale } from "@/app/i18n";

/** Below this a phoneme is the model's doubt rather than the reciter's word. */
const UNSURE_BELOW = 0.45;

/** Above this share of clipped samples the microphone is turned up too far. */
const CLIPPING_CONCERN = 0.001;

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-end font-mono text-label break-all">
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

      {/* The phonemes themselves stay LTR-neutral but are Arabic glyphs, so
          the run is marked RTL to keep the order the model emitted. */}
      <Row label={t("practice.debugHeard")}>
        {heard.length === 0 ? (
          <span className="text-muted-foreground">
            {t("practice.debugNothingYet")}
          </span>
        ) : (
          <span dir="rtl" lang="ar">
            {heard.map((phoneme, index) => (
              <span
                key={`${index}-${phoneme.symbol}`}
                className={
                  phoneme.confidence < UNSURE_BELOW
                    ? "text-muted-foreground"
                    : undefined
                }
                title={`${Math.round(phoneme.confidence * 100)}%`}
              >
                {phoneme.symbol}{" "}
              </span>
            ))}
          </span>
        )}
      </Row>

      <Row label={t("practice.debugExpected")}>
        {expected.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span dir="rtl" lang="ar">
            {expected.join(" ")}
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
