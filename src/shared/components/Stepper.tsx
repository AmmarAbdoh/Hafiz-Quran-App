import { Minus, Plus } from "lucide-react";
import { IconButton } from "@/shared/components/ui/IconButton";
import { cn } from "@/shared/lib/utils";

interface StepperProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  decrementLabel: string;
  incrementLabel: string;
  valueLabel?: string;
  className?: string;
}

export function Stepper({
  value,
  onValueChange,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  decrementLabel,
  incrementLabel,
  valueLabel,
  className,
}: StepperProps) {
  const canDecrement = value - step >= min;
  const canIncrement = value + step <= max;

  return (
    <div
      className={cn(
        "inline-flex min-h-11 items-center gap-1 rounded-xl border border-input bg-background p-1 shadow-sm",
        className,
      )}
    >
      <IconButton
        type="button"
        variant="ghost"
        aria-label={decrementLabel}
        disabled={!canDecrement}
        onClick={() => onValueChange(Math.max(min, value - step))}
      >
        <Minus aria-hidden="true" />
      </IconButton>
      <span
        className="min-w-11 px-2 text-center text-sm font-semibold tabular-nums"
        aria-live="polite"
        aria-label={valueLabel}
      >
        {value}
      </span>
      <IconButton
        type="button"
        variant="ghost"
        aria-label={incrementLabel}
        disabled={!canIncrement}
        onClick={() => onValueChange(Math.min(max, value + step))}
      >
        <Plus aria-hidden="true" />
      </IconButton>
    </div>
  );
}
