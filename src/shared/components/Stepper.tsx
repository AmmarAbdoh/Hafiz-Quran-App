import { Minus, Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
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
  /** Renders the value - the reader's own numerals, a unit, "2 of 5". */
  formatValue?: (value: number) => string;
  className?: string;
}

/*
 * 44px is the touch floor and stays the default; a mouse does not need it,
 * and at that size a stepper sitting in a row of settings was heavier than
 * everything beside it. Same shape as the reader's page control.
 */
const CONTROL_SIZE =
  "h-11 w-11 pointer-fine:h-9 pointer-fine:w-9 pointer-fine:min-h-9 pointer-fine:min-w-9";

export function Stepper({
  value,
  onValueChange,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  decrementLabel,
  incrementLabel,
  valueLabel,
  formatValue,
  className,
}: StepperProps) {
  const canDecrement = value - step >= min;
  const canIncrement = value + step <= max;

  return (
    <div
      className={cn(
        // Height comes from the 44px controls inside, not from the frame.
        "inline-flex items-center gap-1 rounded-md border border-input bg-background p-1",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={CONTROL_SIZE}
        aria-label={decrementLabel}
        disabled={!canDecrement}
        onClick={() => onValueChange(Math.max(min, value - step))}
      >
        <Minus aria-hidden="true" />
      </Button>
      <span
        className="min-w-9 px-1 text-center text-label font-semibold tabular-nums"
        aria-live="polite"
        aria-label={valueLabel}
      >
        {formatValue ? formatValue(value) : value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={CONTROL_SIZE}
        aria-label={incrementLabel}
        disabled={!canIncrement}
        onClick={() => onValueChange(Math.min(max, value + step))}
      >
        <Plus aria-hidden="true" />
      </Button>
    </div>
  );
}
