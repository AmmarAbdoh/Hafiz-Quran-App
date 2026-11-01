import { Pause, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber, useLocale, type Locale } from "@/app/i18n";
import type { RecordingPlayback } from "@/features/recitation-practice/hooks/useRecordingPlayer";
import { Button } from "@/shared/components/ui/button";

/** `1:05`, in the reader's numerals. */
export function formatDuration(seconds: number, locale: Locale): string {
  const whole = Math.round(seconds);
  return `${formatNumber(Math.floor(whole / 60), locale)}:${formatNumber(
    whole % 60,
    locale,
    { minimumIntegerDigits: 2 },
  )}`;
}

/** Play, pause, and move through a recording. */
export function RecordingPlayer({
  player,
  label,
}: {
  player: RecordingPlayback;
  /** What is being played, for the position slider. */
  label: string;
}) {
  const { t: tCommon } = useTranslation("common");
  const { locale } = useLocale();
  const time = `${formatDuration(player.position, locale)} / ${formatDuration(
    player.duration,
    locale,
  )}`;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border px-2 py-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={player.toggle}
        aria-label={
          player.playing ? tCommon("actions.pause") : tCommon("actions.play")
        }
      >
        {player.playing ? (
          <Pause className="h-4 w-4" aria-hidden />
        ) : (
          <Play className="h-4 w-4" aria-hidden />
        )}
      </Button>
      <input
        type="range"
        min={0}
        max={player.duration}
        step={0.1}
        value={Math.min(player.position, player.duration)}
        onChange={(event) => player.seek(Number(event.target.value))}
        aria-label={label}
        aria-valuetext={time}
        className="h-11 min-w-0 flex-1 accent-primary"
      />
      <span className="shrink-0 text-label tabular-nums text-muted-foreground">
        {time}
      </span>
    </div>
  );
}
