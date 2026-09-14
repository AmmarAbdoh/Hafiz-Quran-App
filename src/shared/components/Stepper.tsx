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
        // Height comes from the 44px controls inside, not from the frame.
        "inline-flex items-center gap-1 rounded-md border border-input bg-background p-1",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={decrementLabel}
        disabled={!canDecrement}
        onClick={() => onValueChange(Math.max(min, value - step))}
      >
        <Minus aria-hidden="true" />
      </Button>
      <span
        className="min-w-11 px-2 text-center text-label font-semibold tabular-nums"
        aria-live="polite"
        aria-label={valueLabel}
      >
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={incrementLabel}
        disabled={!canIncrement}
        onClick={() => onValueChange(Math.min(max, value + step))}
      >
        <Plus aria-hidden="true" />
      </Button>
    </div>
  );
}
