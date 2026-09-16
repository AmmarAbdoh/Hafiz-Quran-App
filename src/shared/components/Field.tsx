import type { ReactNode } from "react";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/shared/lib/utils";

interface FieldRenderProps {
  /** Put this on the control so the label points at it. */
  id: string;
  /**
   * Put this on the control so its hint and its error are read with it.
   * Undefined when the field has neither, so it is never an empty attribute.
   */
  "aria-describedby": string | undefined;
  /** Put this on the control so the invalid state is announced, not only seen. */
  "aria-invalid": true | undefined;
}

interface FieldProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  /** Rendered and wired here. Use `errorId` instead when it belongs to a group. */
  error?: ReactNode;
  /**
   * The id of an error rendered elsewhere - one message for a group of fields
   * that share a single rule, such as a range. The control still says it is
   * invalid and still points at the text, but the text is announced once.
   */
  errorId?: string;
  className?: string;
  children: (props: FieldRenderProps) => ReactNode;
}

/**
 * A label, a control, and whatever the control has to say about itself.
 *
 * The app had no aria-describedby and no aria-invalid anywhere: hints sat
 * beside controls without being attached to them, and an invalid page range
 * showed a red sentence that a screen reader never connected to the field that
 * caused it. Passing the control its own wiring is the point of this
 * component; the layout is the lesser half.
 */
export function Field({
  id,
  label,
  hint,
  error,
  errorId,
  className,
  children,
}: FieldProps) {
  const hintId = hint ? `${id}-hint` : null;
  const ownErrorId = error ? `${id}-error` : null;
  const describedBy =
    [hintId, ownErrorId ?? errorId].filter(Boolean).join(" ") || undefined;
  const invalid = Boolean(error) || Boolean(errorId);

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>

      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": invalid || undefined,
      })}

      {hint ? (
        <p id={hintId!} className="text-label text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {error ? (
        // Assertive enough to interrupt, because it is about what was just
        // typed, and tied to the control by id rather than by proximity.
        <p
          id={ownErrorId!}
          role="alert"
          className="text-label font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
